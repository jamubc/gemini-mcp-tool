import { describe, it, expect } from 'vitest';
import { processFileReferences } from '../src/utils/fileReferenceProcessor.js';
import { readFileSync, existsSync } from 'fs';

/**
 * Integration test for file reference processing
 * 
 * This test validates that our file processing works with real files
 * and produces the expected output format.
 */
describe('File Reference Processing Integration', () => {
  it('should process real files from the project', async () => {
    // Test with actual package.json file
    const prompt = '@package.json explain the project configuration';
    
    // Only run this test if package.json exists
    if (!existsSync('package.json')) {
      console.log('Skipping integration test - package.json not found');
      return;
    }

    const result = await processFileReferences(prompt);

    expect(result.hasFileReferences).toBe(true);
    expect(result.processedFiles).toContain('package.json');
    expect(result.failedFiles).toHaveLength(0);
    
    // Should contain actual package.json content
    expect(result.processedPrompt).toContain('"name": "gemini-mcp-tool"');
    expect(result.processedPrompt).toContain('[File: package.json]');
    expect(result.processedPrompt).toContain('[End: package.json]');
    expect(result.processedPrompt).toContain('explain the project configuration');
    
    // Should not contain the @ reference
    expect(result.processedPrompt).not.toContain('@package.json');
  });

  it('should handle mixed real and non-existent files', async () => {
    const prompt = 'Compare @package.json and @nonexistent.txt files';
    
    if (!existsSync('package.json')) {
      console.log('Skipping integration test - package.json not found');
      return;
    }

    const result = await processFileReferences(prompt);

    expect(result.hasFileReferences).toBe(true);
    expect(result.processedFiles).toHaveLength(1);
    expect(result.processedFiles).toContain('package.json');
    expect(result.failedFiles).toHaveLength(1);
    expect(result.failedFiles[0].path).toBe('nonexistent.txt');
    
    // Should contain package.json content and error for nonexistent file
    expect(result.processedPrompt).toContain('"name": "gemini-mcp-tool"');
    expect(result.processedPrompt).toContain('[ERROR: Could not read nonexistent.txt:');
    expect(result.processedPrompt).toContain('Compare ');
    expect(result.processedPrompt).toContain(' files');
  });

  it('should process src files with proper paths', async () => {
    const prompt = '@src/constants.ts what constants are defined?';
    
    if (!existsSync('src/constants.ts')) {
      console.log('Skipping integration test - src/constants.ts not found');
      return;
    }

    const result = await processFileReferences(prompt);

    expect(result.hasFileReferences).toBe(true);
    expect(result.processedFiles).toContain('src/constants.ts');
    expect(result.failedFiles).toHaveLength(0);
    
    // Should contain constants.ts content
    expect(result.processedPrompt).toContain('ERROR_MESSAGES');
    expect(result.processedPrompt).toContain('[File: src/constants.ts]');
    expect(result.processedPrompt).toContain('what constants are defined?');
  });

  it('should demonstrate the complete bug fix', async () => {
    // This shows the difference between the old behavior and new behavior
    const userPrompt = '@package.json explain this configuration';
    
    if (!existsSync('package.json')) {
      console.log('Skipping integration test - package.json not found');
      return;
    }
    
    // OLD BEHAVIOR (what was happening before the fix):
    // The @ syntax would be passed literally to Gemini CLI
    const oldBehavior = userPrompt; // No processing
    expect(oldBehavior).toContain('@package.json'); // Literal @ syntax
    
    // NEW BEHAVIOR (after the fix):
    // File content is substituted before sending to Gemini
    const result = await processFileReferences(userPrompt);
    const newBehavior = result.processedPrompt;
    
    expect(newBehavior).not.toContain('@package.json'); // @ syntax removed
    expect(newBehavior).toContain('[File: package.json]'); // File boundary markers
    expect(newBehavior).toContain('"name": "gemini-mcp-tool"'); // Actual file content
    expect(newBehavior).toContain('explain this configuration'); // Original text preserved
    
    console.log('✅ BUG FIX VALIDATED:');
    console.log('   → @ syntax is now processed into file content');
    console.log('   → File boundaries are clearly marked');
    console.log('   → Original prompt text is preserved');
    console.log('   → Gemini will receive actual file content, not literal @ references');
  });
});