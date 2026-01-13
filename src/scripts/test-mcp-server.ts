import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the built server
const SERVER_PATH = resolve(__dirname, '../../dist/index.js');

async function runMcpTest() {
    console.log(`Starting MCP Server: ${SERVER_PATH}`);

    const server = spawn('node', [SERVER_PATH], {
        stdio: ['pipe', 'pipe', process.stderr]
    });

    let validSessionId: string | null = null;
    let buffer = '';

    server.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line);
                handleMessage(msg);
            } catch (e) {
                console.log('Received non-JSON:', line);
            }
        }
    });

    // Helper to send JSON-RPC
    let msgId = 0;
    function send(method: string, params?: any) {
        const msg = {
            jsonrpc: '2.0',
            id: msgId++,
            method,
            params
        };
        const str = JSON.stringify(msg) + '\n';
        server.stdin.write(str);
    }

    function handleMessage(msg: any) {
        // console.log('Received:', JSON.stringify(msg, null, 2));

        if (msg.id === 0) { // Initialize response
            console.log('✅ Initialized');
            // List tools to verify ask-gemini exists
            send('tools/list');
        } else if (msg.id === 1) { // tools/list response
            const tools = msg.result.tools;
            const askGemini = tools.find((t: any) => t.name === 'ask-gemini');
            if (askGemini) {
                console.log('✅ Found ask-gemini tool');
                // Test 1: Ask without session ID
                console.log('Testing: ask-gemini (new session)...');
                send('tools/call', {
                    name: 'ask-gemini',
                    arguments: { prompt: 'What is 2+2? Answer briefly.' }
                });
            } else {
                console.error('❌ ask-gemini tool not found');
                process.exit(1);
            }
        } else if (msg.id === 2) { // First call response
            if (msg.error) {
                console.error('❌ Error in first call:', msg.error);
                process.exit(1);
            }

            const content = msg.result.content[0].text;
            console.log('Response 1:', content);

            // Extract Session ID
            const match = content.match(/\*\*Session ID:\*\* (\d+)/);
            if (match) {
                validSessionId = match[1];
                console.log(`✅ Found Session ID: ${validSessionId}`);

                // Test 2: Ask WITH session ID
                console.log(`Testing: ask-gemini (resume session ${validSessionId})...`);
                send('tools/call', {
                    name: 'ask-gemini',
                    arguments: {
                        prompt: 'Multiply that by 10.',
                        sessionId: validSessionId
                    }
                });
            } else {
                console.warn('⚠️ No Session ID found in response. (Did "gemini" CLI run successfully?)');
                // Close server anyway
                process.exit(0);
            }
        } else if (msg.id === 3) { // Second call response
            if (msg.error) {
                console.error('❌ Error in second call:', msg.error);
            } else {
                const content = msg.result.content[0].text;
                console.log('Response 2:', content);
                if (content.includes('40')) { // 4 * 10 = 40
                    console.log('✅ Context preserved! (Expected 40)');
                } else {
                    console.log('❓ Could not automatically verify context (check output manually).');
                }
            }
            process.exit(0);
        }
    }

    // Start initialization
    send('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-script', version: '1.0.0' }
    });
}

runMcpTest().catch(console.error);
