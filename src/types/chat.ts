// Chat type definitions
export interface ChatMessage {
  id: string;
  chatId: string;
  agent: string;
  message: string;
  timestamp: Date;
  sanitized?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  participants: string[];
  messages: ChatMessage[];
  created: Date;
  lastActivity: Date;
  status: 'active' | 'archived';
  agentsWithHistory?: Set<string>;
}

export interface ChatSummary {
  chatId: string;
  title: string;
  participantCount: number;
  messageCount: number;
  lastActivity: Date;
  status: 'active' | 'archived';
}

export interface AgentIdentity {
  id: string;
  name: string;
  role: string;
  capabilities?: string[];
  cryptographicKey?: string;
}