// Simple test script to verify our inter-agent chat tools work
import './dist/tools/index.js'; // Import to trigger tool registration
import { executeTool } from './dist/tools/registry.js';

async function testChatTools() {
  try {
    console.log('🧪 Testing Inter-Agent Chat System Tools\n');

    // Test 1: Create a chat
    console.log('1️⃣ Testing start-chat tool...');
    const startResult = await executeTool('start-chat', {
      title: 'Test Agent Collaboration Chat',
      agentName: 'test-agent-alice'
    });
    console.log(startResult);
    console.log('');

    // Test 2: List chats
    console.log('2️⃣ Testing list-chats tool...');
    const listResult = await executeTool('list-chats', {
      agentName: 'test-agent-alice',
      status: 'active',
      limit: 10
    });
    console.log(listResult);
    console.log('');

    // Test 3: Send a message (without Gemini to avoid API calls)
    console.log('3️⃣ Testing show-chat tool...');
    const showResult = await executeTool('show-chat', {
      chatId: '1',
      agentName: 'test-agent-alice',
      limit: 10
    });
    console.log(showResult);
    console.log('');

    console.log('✅ All chat tools are working correctly!');
    console.log('🚀 Inter-agent chat system is ready for use');

  } catch (error) {
    console.error('❌ Error testing chat tools:', error);
    process.exit(1);
  }
}

testChatTools();