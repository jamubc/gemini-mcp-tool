# Gemini @ Syntax Bug - Test Reproduction Summary

## Bug Description
The ask-gemini tool advertises support for @ syntax file references (e.g., `@filename.js explain this code`) but does not actually process these references. Instead, it passes the literal `@filename` string to Gemini CLI, which responds with confusion asking "which files?"

## Test Files Created

### 1. `tests/gemini-at-syntax-bug.test.ts` 
**Primary bug reproduction test** - This test PROVES the bug exists by:
- Creating test files with known content
- Using ask-gemini tool with @ syntax references  
- Mocking geminiExecutor to capture the actual prompt sent
- Verifying that literal @ strings are passed instead of file content
- Demonstrating the confusing user experience

### 2. `tests/gemini-at-syntax-expected-behavior.test.ts`
**Reference specification test** - This test shows what @ syntax SHOULD do:
- Demonstrates correct file processing behavior
- Serves as specification for the fix
- Currently skipped (will pass when bug is fixed)

## Test Results

✅ **All bug reproduction tests are PASSING** - This confirms the bug exists:
- File content is NOT processed
- Literal @ strings are passed to Gemini CLI  
- Users get confused responses from Gemini
- Multiple scenarios (single file, relative paths, multiple files) all fail

## Key Test Evidence

The test captures and validates:
1. **Actual prompt sent:** Contains `@filename` literal strings
2. **Missing file content:** No actual file content in the prompt  
3. **Gemini response:** Confusion about "which files?" 
4. **User impact:** Broken feature despite being documented

## Running the Tests

```bash
# Run bug reproduction tests
npm test tests/gemini-at-syntax-bug.test.ts

# Run specific test  
npm test tests/gemini-at-syntax-bug.test.ts -- -t "should reproduce"
```

## Expected Fix

The ask-gemini tool needs to:
1. Parse @ syntax references in prompts before sending to Gemini
2. Read referenced file contents  
3. Replace `@filename` with actual file content
4. Send processed prompt to Gemini CLI

When fixed, the reference test in `gemini-at-syntax-expected-behavior.test.ts` can be un-skipped and should pass.

## Impact

This bug breaks a documented feature that users expect to work, causing:
- User confusion when @ syntax doesn't work as advertised
- Manual copy-paste workarounds  
- Loss of confidence in tool reliability
- Wasted user time diagnosing the issue