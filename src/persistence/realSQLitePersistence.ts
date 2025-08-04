import Database from 'better-sqlite3';
import { Logger } from '../utils/logger.js';
import { Chat, ChatMessage, AgentIdentity, ChatSummary } from '../managers/chatManager.js';
import { PersistenceProvider, ListOptions, MessageQueryOptions } from './sqlitePersistence.js';
import * as path from 'path';
import * as fs from 'fs';

export class RealSQLitePersistence implements PersistenceProvider {
  private db!: Database.Database;
  private prepared!: {
    insertChat: Database.Statement;
    updateChat: Database.Statement;
    selectChat: Database.Statement;
    deleteChat: Database.Statement;
    listChats: Database.Statement;
    insertParticipant: Database.Statement;
    selectParticipants: Database.Statement;
    deleteParticipants: Database.Statement;
    insertMessage: Database.Statement;
    selectMessages: Database.Statement;
    countMessages: Database.Statement;
    deleteMessages: Database.Statement;
  };

  constructor(private dbPath: string = ':memory:') {
    this.initializeDatabase();
    this.prepareStatements();
    Logger.info(`RealSQLitePersistence initialized with database: ${dbPath}`);
  }

  private initializeDatabase(): void {
    // Ensure directory exists for file-based databases
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrent access
    this.db.pragma('foreign_keys = ON');  // Enable foreign key constraints
    
    this.createTables();
  }

  private createTables(): void {
    // Create chats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_activity TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'))
      )
    `);

    // Create participants table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS participants (
        chat_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        capabilities TEXT, -- JSON array
        cryptographic_key TEXT,
        joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chat_id, agent_id),
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        sanitized BOOLEAN DEFAULT 1,
        audit_trail TEXT, -- JSON array
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
      CREATE INDEX IF NOT EXISTS idx_chats_last_activity ON chats(last_activity);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_participants_chat_id ON participants(chat_id);
    `);
  }

  private prepareStatements(): void {
    this.prepared = {
      insertChat: this.db.prepare(`
        INSERT INTO chats (id, title, created_at, last_activity, status)
        VALUES (?, ?, ?, ?, ?)
      `),
      
      updateChat: this.db.prepare(`
        UPDATE chats 
        SET title = ?, last_activity = ?, status = ?
        WHERE id = ?
      `),
      
      selectChat: this.db.prepare(`
        SELECT * FROM chats WHERE id = ?
      `),
      
      deleteChat: this.db.prepare(`
        DELETE FROM chats WHERE id = ?
      `),
      
      listChats: this.db.prepare(`
        SELECT 
          c.id, c.title, c.created_at, c.last_activity, c.status,
          COUNT(DISTINCT p.agent_id) as participant_count,
          COUNT(m.id) as message_count
        FROM chats c
        LEFT JOIN participants p ON c.id = p.chat_id
        LEFT JOIN messages m ON c.id = m.chat_id
        WHERE c.status = ? OR ? = 'all'
        GROUP BY c.id, c.title, c.created_at, c.last_activity, c.status
        ORDER BY c.last_activity DESC
        LIMIT ?
      `),
      
      insertParticipant: this.db.prepare(`
        INSERT OR REPLACE INTO participants 
        (chat_id, agent_id, agent_name, role, capabilities, cryptographic_key)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      
      selectParticipants: this.db.prepare(`
        SELECT * FROM participants WHERE chat_id = ?
      `),
      
      deleteParticipants: this.db.prepare(`
        DELETE FROM participants WHERE chat_id = ?
      `),
      
      insertMessage: this.db.prepare(`
        INSERT INTO messages (id, chat_id, sender_id, content, timestamp, sanitized, audit_trail)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      
      selectMessages: this.db.prepare(`
        SELECT * FROM messages 
        WHERE chat_id = ? 
        ORDER BY timestamp ASC
        LIMIT ? OFFSET ?
      `),
      
      countMessages: this.db.prepare(`
        SELECT COUNT(*) as count FROM messages WHERE chat_id = ?
      `),
      
      deleteMessages: this.db.prepare(`
        DELETE FROM messages WHERE chat_id = ?
      `)
    };
  }

  async saveChat(chat: Chat): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Save chat
      this.prepared.insertChat.run(
        chat.id,
        chat.title,
        chat.created.toISOString(),
        chat.lastActivity.toISOString(),
        chat.status
      );

      // Save participants
      for (const participant of chat.participants) {
        this.prepared.insertParticipant.run(
          chat.id,
          participant.id,
          participant.name,
          participant.role,
          JSON.stringify(participant.capabilities),
          participant.cryptographicKey || null
        );
      }

      // Save messages
      for (const message of chat.messages) {
        this.prepared.insertMessage.run(
          message.id,
          message.chatId,
          message.senderId,
          message.content,
          message.timestamp.toISOString(),
          message.sanitized ? 1 : 0,
          message.auditTrail ? JSON.stringify(message.auditTrail) : null
        );
      }
    });

    try {
      transaction();
      Logger.info(`Chat saved to database: ${chat.id}`);
    } catch (error) {
      Logger.error(`Failed to save chat ${chat.id}:`, error);
      throw new Error(`Database save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateChat(chat: Chat): Promise<void> {
    try {
      this.prepared.updateChat.run(
        chat.title,
        chat.lastActivity.toISOString(),
        chat.status,
        chat.id
      );
      Logger.info(`Chat updated in database: ${chat.id}`);
    } catch (error) {
      Logger.error(`Failed to update chat ${chat.id}:`, error);
      throw new Error(`Database update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadChat(chatId: string): Promise<Chat | null> {
    try {
      const chatRow = this.prepared.selectChat.get(chatId) as any;
      if (!chatRow) {
        return null;
      }

      // Load participants
      const participantRows = this.prepared.selectParticipants.all(chatId) as any[];
      const participants: AgentIdentity[] = participantRows.map(row => ({
        id: row.agent_id,
        name: row.agent_name,
        role: row.role,
        capabilities: JSON.parse(row.capabilities || '[]'),
        cryptographicKey: row.cryptographic_key
      }));

      // Load messages
      const messageRows = this.prepared.selectMessages.all(chatId, 1000, 0) as any[];
      const messages: ChatMessage[] = messageRows.map(row => ({
        id: row.id,
        chatId: row.chat_id,
        senderId: row.sender_id,
        content: row.content,
        timestamp: new Date(row.timestamp),
        sanitized: row.sanitized === 1,
        auditTrail: row.audit_trail ? JSON.parse(row.audit_trail) : undefined
      }));

      const chat: Chat = {
        id: chatRow.id,
        title: chatRow.title,
        participants,
        messages,
        created: new Date(chatRow.created_at),
        lastActivity: new Date(chatRow.last_activity),
        status: chatRow.status
      };

      return chat;
    } catch (error) {
      Logger.error(`Failed to load chat ${chatId}:`, error);
      throw new Error(`Database load failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      this.prepared.deleteChat.run(chatId);
      Logger.info(`Chat deleted from database: ${chatId}`);
    } catch (error) {
      Logger.error(`Failed to delete chat ${chatId}:`, error);
      throw new Error(`Database delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listChats(options: ListOptions = {}): Promise<ChatSummary[]> {
    try {
      const status = options.status || 'active';
      const limit = options.limit || 50;

      const rows = this.prepared.listChats.all(status, status, limit) as any[];
      
      return rows.map(row => ({
        id: parseInt(row.id), // Convert to number for compatibility
        title: row.title,
        participantCount: row.participant_count || 0,
        messageCount: row.message_count || 0,
        lastActivity: new Date(row.last_activity),
        status: row.status
      }));
    } catch (error) {
      Logger.error('Failed to list chats:', error);
      throw new Error(`Database list failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    try {
      this.prepared.insertMessage.run(
        message.id,
        message.chatId,
        message.senderId,
        message.content,
        message.timestamp.toISOString(),
        message.sanitized ? 1 : 0,
        message.auditTrail ? JSON.stringify(message.auditTrail) : null
      );

      // Update chat's last activity
      this.db.prepare(`
        UPDATE chats SET last_activity = ? WHERE id = ?
      `).run(message.timestamp.toISOString(), message.chatId);

      Logger.info(`Message saved to database: ${message.id} in chat ${message.chatId}`);
    } catch (error) {
      Logger.error(`Failed to save message ${message.id}:`, error);
      throw new Error(`Message save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadMessages(chatId: string, options: MessageQueryOptions = {}): Promise<ChatMessage[]> {
    try {
      const limit = options.limit || 1000;
      const offset = options.offset || 0;

      const rows = this.prepared.selectMessages.all(chatId, limit, offset) as any[];
      
      return rows.map(row => ({
        id: row.id,
        chatId: row.chat_id,
        senderId: row.sender_id,
        content: row.content,
        timestamp: new Date(row.timestamp),
        sanitized: row.sanitized === 1,
        auditTrail: row.audit_trail ? JSON.parse(row.audit_trail) : undefined
      }));
    } catch (error) {
      Logger.error(`Failed to load messages for chat ${chatId}:`, error);
      throw new Error(`Message load failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Additional utility methods
  close(): void {
    this.db.close();
    Logger.info('SQLite database connection closed');
  }

  getStats(): { chatCount: number; messageCount: number; dbSize: number } {
    try {
      const chatCount = this.db.prepare('SELECT COUNT(*) as count FROM chats').get() as any;
      const messageCount = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as any;
      
      // Get database size (file-based only)
      let dbSize = 0;
      if (this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
        dbSize = fs.statSync(this.dbPath).size;
      }

      return {
        chatCount: chatCount.count,
        messageCount: messageCount.count,
        dbSize
      };
    } catch (error) {
      Logger.error('Failed to get database stats:', error);
      return { chatCount: 0, messageCount: 0, dbSize: 0 };
    }
  }

  // Backup and maintenance methods
  async backup(backupPath: string): Promise<void> {
    try {
      this.db.backup(backupPath);
      Logger.info(`Database backed up to: ${backupPath}`);
    } catch (error) {
      Logger.error('Database backup failed:', error);
      throw new Error(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  vacuum(): void {
    try {
      this.db.pragma('vacuum');
      Logger.info('Database vacuum completed');
    } catch (error) {
      Logger.error('Database vacuum failed:', error);
      throw new Error(`Vacuum failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // For testing purposes
  reset(): void {
    const transaction = this.db.transaction(() => {
      this.db.exec('DELETE FROM messages');
      this.db.exec('DELETE FROM participants');
      this.db.exec('DELETE FROM chats');
    });
    
    try {
      transaction();
      Logger.info('Database reset completed');
    } catch (error) {
      Logger.error('Database reset failed:', error);
      throw new Error(`Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}