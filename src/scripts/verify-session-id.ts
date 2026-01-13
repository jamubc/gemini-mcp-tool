import { getLastSessionId } from '../utils/geminiExecutor.js';
import { executeCommand } from '../utils/commandExecutor.js';
import { CLI } from '../constants.js';

async function verify() {
    console.log('--- Verifying Session ID Logic ---');

    // 1. Check current sessions
    console.log('1. Checking gemini --list-sessions...');
    try {
        // We can't import executeCommand easily if it's not exported or if we are outside module context,
        // but since we are in src/scripts, we can use relative imports as defined above.
        const rawOutput = await executeCommand(CLI.COMMANDS.GEMINI, ['--list-sessions'], undefined, { captureStderr: true });
        console.log('RAW OUTPUT:\n', rawOutput);
    } catch (e: any) {
        console.log('No sessions found or error:', e.message);
    }

    // 2. Test Parser
    console.log('\n2. Testing getLastSessionId()...');
    const id = await getLastSessionId();
    console.log(`\nResult: getLastSessionId() returned: "${id}"`);

    if (id) {
        console.log('✅ SUCCESS: Found a session ID.');
    } else {
        console.log('ℹ️ NOTICE: No session ID found. This is normal if you haven\'t run a gemini command yet.');
        console.log('   Try running: gemini "hello"');
        console.log('   Then run this script again.');
    }
}

verify().catch(console.error);
