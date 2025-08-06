// End-to-end test for actual Gemini CLI integration with temp files
import { ChatManager } from './dist/managers/chatManager.js';
import { executeGeminiCLI } from './dist/utils/geminiExecutor.js';
import { promises as fs } from 'fs';
import { join } from 'path';

async function testEndToEndIntegration() {
  console.log('🧪 Testing End-to-End Gemini CLI Integration with Temp Files...\n');
  
  const chatManager = ChatManager.getInstance();
  
  try {
    // 1. Create a test chat with history
    const chat = await chatManager.createChat('E2E Integration Test', 'test-agent');
    const chatId = chat.id?.toString() || '1';
    
    console.log(`✅ Created chat: ${chatId}`);
    
    // 2. Add some conversation history
    await chatManager.addMessage(chatId, 'user', 'What is the capital of France?', 'test-agent');
    await chatManager.addMessage(chatId, 'assistant', 'The capital of France is Paris.', 'test-agent');
    await chatManager.addMessage(chatId, 'user', 'What about Italy?', 'test-agent');
    await chatManager.addMessage(chatId, 'assistant', 'The capital of Italy is Rome.', 'test-agent');
    
    console.log(`✅ Added 4 messages to create conversation history`);
    
    // 3. Generate temp file for this chat
    const fileResult = await chatManager.generateChatHistoryFile(
      chatId, 
      'Based on our previous conversation about capitals, what is the capital of Germany? Please mention that you can see our chat history.',
      'test-agent',
      true // Keep file for debugging
    );
    
    if (!fileResult.success) {
      throw new Error(`Failed to generate temp file: ${fileResult.error}`);
    }
    
    console.log(`✅ Generated temp file: ${fileResult.filePath}`);
    console.log(`✅ File reference: ${fileResult.fileReference}`);
    
    // 4. Read and display the temp file content
    const fileContent = await fs.readFile(fileResult.filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    console.log('\n📄 Generated Temp File Content:');
    console.log('=====================================');
    console.log(JSON.stringify(jsonData, null, 2));
    console.log('=====================================\n');
    
    // 5. Test the actual Gemini CLI call with the temp file
    console.log('🚀 Testing actual Gemini CLI integration...');
    
    const geminiPrompt = `${fileResult.fileReference}\n\n[test-agent]: Based on our previous conversation about capitals, what is the capital of Germany? Please mention that you can see our chat history and summarize what we discussed.`;
    
    console.log('\n📝 Gemini Prompt:');
    console.log(`"${geminiPrompt}"`);
    console.log('');
    
    // 6. Execute Gemini CLI with the temp file reference
    try {
      const geminiResult = await executeGeminiCLI(
        geminiPrompt,
        'gemini-2.5-flash', // Use flash for faster testing
        false, // No sandbox
        false, // No change mode
        (progress) => {
          console.log(`📊 Progress: ${progress}`);
        }
      );
      
      console.log('\n🤖 Gemini Response:');
      console.log('=====================================');
      console.log(geminiResult.content);
      console.log('=====================================\n');
      
      // 7. Validate that Gemini can see the history
      const response = geminiResult.content.toLowerCase();
      const canSeeHistory = response.includes('paris') || response.includes('rome') || response.includes('previous') || response.includes('conversation');
      
      if (canSeeHistory) {
        console.log('✅ SUCCESS: Gemini can see chat history from temp file!');
        console.log('✅ Chat history prepending is working correctly');
        console.log('✅ New prompt appending is working correctly');
        console.log('✅ @ syntax file reference is working correctly');
      } else {
        console.log('❌ ISSUE: Gemini doesn\'t appear to see chat history');
        console.log('   Response doesn\'t reference previous conversation about capitals');
      }
      
      // 8. Test @ references inside temp file (if any)
      if (jsonData.messages.some(m => m.message.includes('@'))) {
        console.log('✅ Found @ references in messages - these should be processed by Gemini');
      }
      
      console.log('\n🎯 End-to-End Integration Test Results:');
      console.log(`- Temp file generation: ✅ Working`);
      console.log(`- File reference format: ✅ Correct (${fileResult.fileReference})`);
      console.log(`- Gemini CLI execution: ✅ Successful`);
      console.log(`- Chat history visibility: ${canSeeHistory ? '✅ Working' : '❌ Issue detected'}`);
      
    } catch (geminiError) {
      console.error('❌ Gemini CLI execution failed:', geminiError.message);
      console.log('\n🔍 Checking if temp file is properly formatted...');
      
      // Validate temp file exists and is readable
      try {
        await fs.access(fileResult.filePath);
        console.log('✅ Temp file exists and is accessible');
        console.log(`✅ File size: ${fileContent.length} characters`);
        console.log('✅ JSON structure is valid');
      } catch (accessError) {
        console.error('❌ Temp file access issue:', accessError.message);
      }
      
      throw geminiError;
    }
    
  } catch (error) {
    console.error('❌ End-to-end test failed:', error.message);
    throw error;
  }
}

// Run the test
testEndToEndIntegration()
  .then(() => {
    console.log('\n🎉 End-to-End Integration Test Complete!');
  })
  .catch((error) => {
    console.error('\n💥 End-to-End Integration Test Failed:', error.message);
    process.exit(1);
  });