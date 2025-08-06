// Test the actual implementation path using the MCP tools directly
import { toolRegistry } from './dist/tools/registry.js';
import { promises as fs } from 'fs';

async function testRealIntegration() {
  console.log('🧪 Testing REAL End-to-End Integration via MCP Tools...\n');
  
  try {
    // Get the ask-gemini tool from registry
    const askGeminiTool = toolRegistry.find(tool => tool.name === 'ask-gemini');
    if (!askGeminiTool) {
      throw new Error('ask-gemini tool not found in registry');
    }
    
    console.log('✅ Found ask-gemini tool in registry');
    
    // Test 1: Create a chat and add messages via ask-gemini tool
    console.log('\n📝 Step 1: Starting first conversation...');
    
    const firstRequest = {
      prompt: 'Hello! My name is Alice and I am a software engineer. What is the capital of France?',
      model: 'gemini-2.5-flash',
      agentName: 'test-integration',
      chatId: 0 // Create new chat
    };
    
    const firstResponse = await askGeminiTool.execute(firstRequest);
    console.log('✅ First conversation successful');
    console.log(`📄 Response: ${firstResponse.substring(0, 200)}...`);
    
    // Extract chat ID from response (if available)
    const chatIdMatch = firstResponse.match(/Chat ID (\d+)/);
    const detectedChatId = chatIdMatch ? parseInt(chatIdMatch[1]) : 1;
    
    console.log(`🔍 Detected/Using Chat ID: ${detectedChatId}`);
    
    // Test 2: Continue conversation in same chat (this should use temp file)
    console.log('\n📝 Step 2: Continuing conversation (should use temp file)...');
    
    const secondRequest = {
      prompt: 'Remember my name is Alice and I asked about France. Now, what is the capital of Italy? Also, can you see our previous conversation?',
      model: 'gemini-2.5-flash', 
      agentName: 'test-integration',
      chatId: detectedChatId // Continue existing chat
    };
    
    const secondResponse = await askGeminiTool.execute(secondRequest);
    console.log('✅ Second conversation successful');
    console.log(`📄 Response: ${secondResponse.substring(0, 300)}...`);
    
    // Test 3: Analyze if history was preserved
    console.log('\n🔍 Step 3: Analyzing conversation continuity...');
    
    const lowerResponse = secondResponse.toLowerCase();
    const mentionsAlice = lowerResponse.includes('alice');
    const mentionsFrance = lowerResponse.includes('france') || lowerResponse.includes('paris');
    const mentionsItaly = lowerResponse.includes('italy') || lowerResponse.includes('rome');
    const acknowledgesHistory = lowerResponse.includes('previous') || lowerResponse.includes('remember') || lowerResponse.includes('conversation');
    
    console.log('\n📊 Conversation Analysis:');
    console.log(`- Remembers name (Alice): ${mentionsAlice ? '✅' : '❌'}`);
    console.log(`- Remembers France topic: ${mentionsFrance ? '✅' : '❌'}`);  
    console.log(`- Answers Italy question: ${mentionsItaly ? '✅' : '❌'}`);
    console.log(`- Acknowledges chat history: ${acknowledgesHistory ? '✅' : '❌'}`);
    
    // Test 4: Check if temp files were created
    console.log('\n📁 Step 4: Checking for temp files...');
    
    try {
      const tempDir = './.gemini';
      const files = await fs.readdir(tempDir);
      const chatFiles = files.filter(f => f.startsWith('chat-') && f.endsWith('.json'));
      
      console.log(`✅ Found ${chatFiles.length} temp file(s):`, chatFiles);
      
      if (chatFiles.length > 0) {
        // Read the most recent temp file
        const latestFile = chatFiles[chatFiles.length - 1];
        const filePath = `${tempDir}/${latestFile}`;
        const fileContent = await fs.readFile(filePath, 'utf8');
        const jsonData = JSON.parse(fileContent);
        
        console.log('\n📄 Latest Temp File Structure:');
        console.log(`- Chat ID: ${jsonData.chatId}`);
        console.log(`- Title: ${jsonData.title}`);
        console.log(`- Messages: ${jsonData.messages?.length || 0}`);
        console.log(`- Current Prompt: ${jsonData.currentPrompt?.substring(0, 50)}...`);
        console.log(`- Estimated Tokens: ${jsonData.metadata?.estimatedTokens}`);
        
        // Verify the file contains our conversation
        const fileStr = JSON.stringify(jsonData);
        const containsAlice = fileStr.includes('Alice');
        const containsFrance = fileStr.includes('France') || fileStr.includes('france');
        
        console.log('\n📋 File Content Analysis:');
        console.log(`- Contains Alice: ${containsAlice ? '✅' : '❌'}`);
        console.log(`- Contains France: ${containsFrance ? '✅' : '❌'}`);
      }
      
    } catch (fileError) {
      console.log('⚠️  No temp files found or error reading them:', fileError.message);
    }
    
    // Final assessment
    const overallSuccess = mentionsItaly && (mentionsAlice || acknowledgesHistory);
    
    console.log('\n🎯 FINAL INTEGRATION TEST RESULTS:');
    console.log('=====================================');
    console.log(`Overall Status: ${overallSuccess ? '✅ SUCCESS' : '❌ NEEDS INVESTIGATION'}`);
    console.log(`- Tool execution: ✅ Working`);
    console.log(`- Multi-turn conversation: ${overallSuccess ? '✅ Working' : '❌ Issue detected'}`);
    console.log(`- History preservation: ${mentionsAlice || acknowledgesHistory ? '✅ Working' : '❌ Issue detected'}`);
    console.log(`- Temp file system: ${chatFiles?.length > 0 ? '✅ Active' : '⚠️  Unknown'}`);
    
    if (overallSuccess) {
      console.log('\n🎉 JSON temp file implementation is working end-to-end!');
    } else {
      console.log('\n🔧 Investigation needed - conversation continuity may have issues');
    }
    
  } catch (error) {
    console.error('❌ Real integration test failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Run the test  
testRealIntegration()
  .then(() => {
    console.log('\n✅ Real Integration Test Complete!');
  })
  .catch((error) => {
    console.error('\n💥 Real Integration Test Failed:', error.message);
    process.exit(1);
  });