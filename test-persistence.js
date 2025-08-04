// Test the new SQLite persistence system
import './dist/tools/index.js';
import { executeTool } from './dist/tools/registry.js';
import fs from 'fs';

async function testPersistence() {
  try {
    console.log('🧪 Testing SQLite Persistence System\n');

    // Check for existing test database
    if (fs.existsSync('./data/chats.db')) {
      console.log('📁 Using existing database file');
    } else {
      console.log('🆕 Creating new database file');
    }

    // Test 1: Create a chat (should persist to database)
    console.log('1️⃣ Creating a persistent chat...');
    const createResult = await executeTool('start-chat', {
      title: 'Persistent Test Chat',
      agentName: 'test-agent-persistence'
    });
    console.log(createResult);
    console.log('');

    // Test 2: Add some messages
    console.log('2️⃣ Adding messages...');
    const sendResult1 = await executeTool('send-message', {
      chatId: '1',
      agentName: 'test-agent-persistence',
      message: 'This message should be persisted to SQLite database!',
      includeHistory: false // Skip Gemini to avoid API costs
    });
    console.log('Message 1 result:', sendResult1.split('\n')[0]); // Just show first line
    
    // Test 3: List chats (should come from database)
    console.log('\n3️⃣ Listing chats from database...');
    const listResult = await executeTool('list-chats', {
      agentName: 'test-agent-persistence',
      status: 'active',
      limit: 10
    });
    console.log(listResult);

    // Test 4: Check if database file was created
    console.log('\n4️⃣ Database file check...');
    if (fs.existsSync('./data/chats.db')) {
      const stats = fs.statSync('./data/chats.db');
      console.log(`✅ Database file created: ${stats.size} bytes`);
    } else {
      console.log('❌ Database file not found');
    }

    console.log('\n🎉 Persistence testing complete!');

  } catch (error) {
    console.error('❌ Error testing persistence:', error);
  }
}

testPersistence();