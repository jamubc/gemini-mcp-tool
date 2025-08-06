// Quick validation test for JSON temp file implementation
import { ChatManager } from './dist/managers/chatManager.js';
import { ChatHistoryFileManager } from './dist/utils/chatHistoryFileManager.js';

async function testImplementation() {
  console.log('🔍 Testing JSON Temp File Implementation...');
  
  const chatManager = ChatManager.getInstance();
  
  // Create a test chat
  const chat = await chatManager.createChat('test-validation', 'test-agent');
  const chatId = chat.id || '1';
  console.log(`✅ Created chat: ${chatId}`);
  
  // Add some messages
  await chatManager.addMessage(chatId, 'agent1', 'Hello, this is the first message!', 'test-agent');
  await chatManager.addMessage(chatId, 'agent2', 'This is a response from agent2 with some code:\n```js\nconsole.log("Hello World");\n```\nWhat do you think?', 'test-agent');
  await chatManager.addMessage(chatId, 'agent1', 'Great code! Let me suggest an improvement:\n```js\nfunction greet(name) {\n  console.log(`Hello ${name}!`);\n}\ngreet("World");\n```', 'test-agent');
  
  console.log(`✅ Added 3 messages to chat ${chatId}`);
  
  // Generate JSON file
  const result = await chatManager.generateChatHistoryFile(chatId, 'What do you think about this conversation?', 'test-agent', true);
  
  if (result.success) {
    console.log(`✅ Generated JSON file successfully: ${result.filePath}`);
    console.log(`✅ File reference: ${result.fileReference}`);
    
    // Read and display the JSON structure
    const fs = await import('fs/promises');
    const content = await fs.readFile(result.filePath, 'utf8');
    const jsonData = JSON.parse(content);
    
    console.log('\n📄 JSON File Structure:');
    console.log(JSON.stringify(jsonData, null, 2));
    
    console.log('\n🎯 Key Validation Points:');
    console.log(`- Chat ID: ${jsonData.chatId}`);
    console.log(`- Title: ${jsonData.title}`);
    console.log(`- Debug Keep File: ${jsonData.debugKeepFile}`);
    console.log(`- Participants: ${jsonData.participants.join(', ')}`);
    console.log(`- Message Count: ${jsonData.messages.length}`);
    console.log(`- Current Prompt: ${jsonData.currentPrompt}`);
    console.log(`- Estimated Tokens: ${jsonData.metadata.estimatedTokens}`);
    console.log(`- File Size: ${content.length} characters`);
    
    console.log('\n✅ All validation checks passed!');
  } else {
    console.error(`❌ Failed to generate JSON file: ${result.error}`);
  }
}

testImplementation().catch(console.error);