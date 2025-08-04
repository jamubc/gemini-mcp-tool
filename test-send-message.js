// Test the send-message tool (we'll simulate Gemini error to avoid API calls)
import './dist/tools/index.js';
import { executeTool } from './dist/tools/registry.js';

async function testSendMessage() {
  try {
    console.log('🧪 Testing send-message tool...\n');

    // First create a chat
    console.log('Creating test chat...');
    await executeTool('start-chat', {
      title: 'Message Test Chat',
      agentName: 'test-agent-bob'
    });

    // Try to send a message - this will work but Gemini CLI will fail (expected)
    console.log('\nSending test message...');
    const sendResult = await executeTool('send-message', {
      chatId: '1',
      agentName: 'test-agent-bob',
      message: 'Hello from the inter-agent chat system! This is a test message.',
      includeHistory: true
    });
    console.log(sendResult);

    // Show the updated chat
    console.log('\nShowing updated chat...');
    const showResult = await executeTool('show-chat', {
      chatId: '1',
      agentName: 'test-agent-bob',
      limit: 10
    });
    console.log(showResult);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSendMessage();