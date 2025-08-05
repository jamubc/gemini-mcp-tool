import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// import { executeCommand } from './package/dist/utils/commandExecutor.js'; // Removed - using built-in spawn
import { spawn } from 'child_process';
import fs from 'fs';
// import { Logger } from './package/dist/utils/logger.js'; // Removed - using console instead
import { ERROR_MESSAGES, STATUS_MESSAGES, MODELS, CLI } from './fixed-constants.js';
// import { parseChangeModeOutput, validateChangeModeEdits } from './package/dist/utils/changeModeParser.js'; // Removed - simplified
// import { formatChangeModeResponse, summarizeChangeModeEdits } from './package/dist/utils/changeModeTranslator.js'; // Removed - simplified
// import { chunkChangeModeEdits } from './package/dist/utils/changeModeChunker.js'; // Removed - simplified
// import { cacheChunks, getChunks } from './package/dist/utils/chunkCache.js'; // Removed - simplified

// Simple chunk cache implementation
const chunkCache = new Map();

// Function to get PowerShell executable based on platform
function getPowerShellExecutable(customPath = null) {
    // If custom path is provided, use it directly
    if (customPath) {
        console.log(`[GMCPT] Using custom PowerShell path: ${customPath}`);
        return customPath;
    }
    if (process.platform === 'win32') {
        // Try multiple PowerShell paths to ensure compatibility
        const possiblePaths = [
            'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
            'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
            'powershell.exe',
            'pwsh.exe'
        ];
        
        // Try to find a working PowerShell executable
        for (const path of possiblePaths) {
            try {
                if (path.includes(':\\')) {
                     // Use full path directly
                     console.log(`[GMCPT] Using full path: ${path}`);
                     return path;
                 } else {
                     // Use relative path
                     console.log(`[GMCPT] Will try relative path: ${path}`);
                     return path;
                 }
            } catch (error) {
                console.log(`[GMCPT] Failed to check path ${path}: ${error.message}`);
                continue;
            }
        }
        
        // Fallback to the first full path
        console.log(`[GMCPT] Using fallback PowerShell path: ${possiblePaths[0]}`);
        return possiblePaths[0];
    }
    // On other platforms, use pwsh (PowerShell Core)
    return 'pwsh';
}

const POWERSHELL_EXECUTABLE = getPowerShellExecutable();
console.log(`[GMCPT] Using PowerShell executable: ${POWERSHELL_EXECUTABLE}`);

function cacheChunks(key, chunks) {
    chunkCache.set(key, chunks);
}

function getChunks(key) {
    return chunkCache.get(key) || [];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug: Check if environment variable is loaded
console.log('GEMINI_API_KEY loaded:', process.env.GEMINI_API_KEY ? 'YES' : 'NO');
console.log('Current working directory:', process.cwd());
console.log('Script directory:', __dirname);
console.log('Env file path:', path.join(__dirname, '.env'));

// Custom executeCommand function that accepts custom environment variables
async function executeCommandWithPipedInput(command, input, env, onProgress, customPowershellPath = null) {
    return new Promise((resolve, reject) => {
        console.log(`[GMCPT] Executing command with piped input: ${command}`);
        console.log(`[GMCPT] Input length: ${input.length}`);
        console.log(`[GMCPT] GEMINI_API_KEY in env: ${env.GEMINI_API_KEY ? 'YES' : 'NO'}`);
        
        // Ensure we have a complete environment with PATH and system variables
        // Add common Node.js installation paths to ensure compatibility across different terminals
        const commonNodePaths = [
            'C:\\Program Files\\nodejs',
            'C:\\Program Files (x86)\\nodejs', 
            'C:\\Users\\admin\\AppData\\Roaming\\npm',
            'C:\\nodejs',
            process.env.APPDATA ? `${process.env.APPDATA}\\npm` : null
        ].filter(Boolean);
        
        const currentPath = process.env.PATH || '';
        const enhancedPath = [currentPath, ...commonNodePaths].join(';');
        
        const completeEnv = {
            ...process.env,  // Include all system environment variables
            ...env,          // Override with provided environment variables
            PATH: enhancedPath,  // Enhanced PATH with Node.js paths
            SYSTEMROOT: process.env.SYSTEMROOT || 'C:\\WINDOWS',  // Required for Windows
            WINDIR: process.env.WINDIR || 'C:\\WINDOWS'  // Required for Windows
        };
        
        console.log(`[GMCPT] Enhanced PATH with Node.js paths: ${commonNodePaths.join(', ')}`);
        
        console.log(`[GMCPT] Environment PATH: ${completeEnv.PATH ? 'Available' : 'Missing'}`);
        console.log(`[GMCPT] Environment GEMINI_API_KEY: ${completeEnv.GEMINI_API_KEY ? 'Available' : 'Missing'}`);
        
        const powershellExe = customPowershellPath || POWERSHELL_EXECUTABLE;
        console.log(`[GMCPT] Using PowerShell executable: ${powershellExe}`);
        
        const childProcess = spawn(powershellExe, ['-Command', command], {
            env: completeEnv,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false  // Don't use shell to avoid additional layer
        });
        
        console.log(`[GMCPT] Spawned process with command: ${powershellExe} -Command "${command}"`);
        
        let stdout = '';
        let stderr = '';
        
        // Write input to stdin and close it
        childProcess.stdin.write(input);
        childProcess.stdin.end();
        
        childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            if (onProgress) {
                onProgress(data.toString());
            }
        });
        
        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        childProcess.on('error', (error) => {
            console.log(`[GMCPT] Command execution error: ${error.message}`);
            reject(error);
        });
        
        childProcess.on('close', (code) => {
            console.log(`[GMCPT] Command exited with code: ${code}`);
            console.log(`[GMCPT] stdout length: ${stdout.length}`);
            console.log(`[GMCPT] stderr length: ${stderr.length}`);
            console.log(`[GMCPT] stdout content: ${stdout && typeof stdout === 'string' ? stdout.substring(0, 500) + '...' : 'undefined'}`);
            console.log(`[GMCPT] stderr content: ${stderr && typeof stderr === 'string' ? stderr.substring(0, 200) + '...' : 'undefined'}`);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
            }
        });
    });
}

async function executeCommandWithEnv(command, args, env, onProgress, customPowershellPath = null) {
    return new Promise((resolve, reject) => {
        console.log(`[GMCPT] Executing command: ${command} ${args.join(' ')}`);
        console.log(`[GMCPT] Environment variables count: ${Object.keys(env).length}`);
        console.log(`[GMCPT] GEMINI_API_KEY in env: ${env.GEMINI_API_KEY ? 'YES' : 'NO'}`);
        console.log(`Executing with custom env: ${command} ${args.join(' ')}`);
        
        // Handle Windows-specific gemini command path resolution
        let resolvedCommand = command;
        if (process.platform === 'win32' && command === 'gemini') {
            const geminiCmdPath = 'C:\\Users\\admin\\AppData\\Roaming\\npm\\gemini.cmd';
            try {
                if (fs.existsSync(geminiCmdPath)) {
                    resolvedCommand = geminiCmdPath;
                    console.log(`[GMCPT] Using full gemini path: ${resolvedCommand}`);
                } else {
                    console.log(`[GMCPT] Gemini cmd not found at ${geminiCmdPath}, using default command`);
                }
            } catch (error) {
                console.log(`[GMCPT] Error checking gemini path: ${error.message}, using default command`);
            }
        }
        
        // Ensure we have a complete environment with PATH and system variables
        // Add common Node.js installation paths to ensure compatibility across different terminals
        const commonNodePaths = [
            'C:\\Program Files\\nodejs',
            'C:\\Program Files (x86)\\nodejs', 
            'C:\\Users\\admin\\AppData\\Roaming\\npm',
            'C:\\nodejs',
            process.env.APPDATA ? `${process.env.APPDATA}\\npm` : null
        ].filter(Boolean);

        const currentPath = process.env.PATH || '';
        const enhancedPath = [currentPath, ...commonNodePaths].join(';');

        const completeEnv = {
            ...process.env,  // Include all system environment variables
            ...env,          // Override with provided environment variables
            PATH: enhancedPath,  // Enhanced PATH with Node.js paths
            SYSTEMROOT: process.env.SYSTEMROOT || 'C:\\WINDOWS',  // Required for Windows
            WINDIR: process.env.WINDIR || 'C:\\WINDOWS'  // Required for Windows
        };

        console.log(`[GMCPT] Enhanced PATH with Node.js paths: ${commonNodePaths.join(', ')}`);
        
        console.log(`[GMCPT] Environment PATH: ${completeEnv.PATH ? 'Available' : 'Missing'}`);
        console.log(`[GMCPT] Environment GEMINI_API_KEY: ${completeEnv.GEMINI_API_KEY ? 'Available' : 'Missing'}`);
        
        // Use custom PowerShell path if provided, otherwise use default
        const powershellExe = customPowershellPath || POWERSHELL_EXECUTABLE;
        console.log(`[GMCPT] Using PowerShell executable: ${powershellExe}`);
        
        // Escape arguments properly for PowerShell
        const escapedArgs = args.map(arg => {
            // Simple escaping for all arguments to avoid complex encoding issues
            // Ensure arg is a string and handle undefined/null values
            const argStr = arg != null ? String(arg) : '';
            return `'${argStr.replace(/'/g, "''").replace(/\n/g, ' ').replace(/\r/g, ' ')}'`;
        });
        
        // Explicitly set GEMINI_API_KEY in the PowerShell command to ensure it's available
        const apiKeyCommand = completeEnv.GEMINI_API_KEY ? `$env:GEMINI_API_KEY='${completeEnv.GEMINI_API_KEY}'; ` : '';
        const psCommand = `${apiKeyCommand}& "${resolvedCommand}" ${escapedArgs.join(' ')}`;
        
        console.log(`[GMCPT] PowerShell command with API key: ${apiKeyCommand ? 'API key set inline' : 'No API key'}`);
        
        const childProcess = spawn(powershellExe, ['-Command', psCommand], {
            env: completeEnv,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false  // Don't use shell to avoid additional layer
        });
        
        console.log(`[GMCPT] Executing with PowerShell: ${psCommand}`);
        
        // Set timeout for command execution (200 seconds)
        const timeout = setTimeout(() => {
            console.log('[GMCPT] Command execution timeout after 200 seconds');
            if (childProcess && !childProcess.killed) {
                childProcess.kill('SIGTERM');
            }
            reject(new Error('Command execution timeout after 200 seconds'));
        }, 200000);
        
        let stdout = '';
        let stderr = '';
        
        childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            if (onProgress) {
                onProgress(data.toString());
            }
        });
        
        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        childProcess.on('error', (error) => {
            clearTimeout(timeout);  // Clear timeout on error
            console.error(`Command execution error: ${error.message}`);
            reject(error);
        });
        
        childProcess.on('close', (code) => {
            clearTimeout(timeout);  // Clear timeout when process completes
            console.log(`[GMCPT] Command exited with code: ${code}`);
            console.log(`[GMCPT] stdout length: ${stdout.length}`);
            console.log(`[GMCPT] stderr length: ${stderr.length}`);
            console.log(`[GMCPT] stdout content: ${stdout && typeof stdout === 'string' ? stdout.substring(0, 200) + '...' : 'undefined'}`);
            console.log(`[GMCPT] stderr content: ${stderr && typeof stderr === 'string' ? stderr.substring(0, 200) + '...' : 'undefined'}`);
            console.log(`Command exited with code: ${code}`);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
            }
        });
    });
}

export async function executeGeminiCLI(prompt, model, sandbox, changeMode, powershellPath, onProgress) {
    console.log('executeGeminiCLI called with prompt: ' + (prompt && typeof prompt === 'string' ? prompt.substring(0, 50) + '...' : 'undefined'));
    console.log('API Key available: ' + (process.env.GEMINI_API_KEY ? 'YES' : 'NO'));
    console.log('Gemini CLI path: C:\\Users\\admin\\AppData\\Roaming\\npm\\node_modules\\@google\\gemini-cli\\dist\\index.js');
    console.log('PowerShell path: ' + (powershellPath || POWERSHELL_EXECUTABLE));
    let prompt_processed = prompt;
    if (changeMode) {
        console.log('[GMCPT] ChangeMode enabled, processing prompt...');
        prompt_processed = prompt.replace(/file:(\S+)/g, '@$1');
        const changeModeInstructions = `CHANGEMODE: Provide structured code edits in this format:\n\nFILE: filename:line\nOLD: exact code to replace\nNEW: replacement code\n\nExample:\nFILE: app.js:10\nOLD: console.log("hello");\nNEW: console.log("updated");`;
        prompt_processed = changeModeInstructions + "\n\n" + prompt_processed;
        console.log('[GMCPT] Processed prompt length:', prompt_processed.length);
        console.log('[GMCPT] First 200 chars of processed prompt:', prompt_processed && typeof prompt_processed === 'string' ? prompt_processed.substring(0, 200) : 'undefined');
    }
    
    const args = [];
    
    // Add the -p flag for non-interactive mode
    args.push('-p', prompt_processed);
    
    // Use gemini-2.5-pro as default model if no model is specified
    const selectedModel = model || MODELS.PRO;
    args.push(CLI.FLAGS.MODEL, selectedModel);
    
    if (sandbox) {
        args.push(CLI.FLAGS.SANDBOX);
    }
    
    console.log(`Executing: ${CLI.COMMANDS.GEMINI} ${args.join(' ')}`);
    
    try {
        // Create custom environment with GEMINI_API_KEY explicitly set
        const customEnv = {
            ...process.env,
            GEMINI_API_KEY: process.env.GEMINI_API_KEY
        };
        
        console.log('[GMCPT] Using GEMINI_API_KEY: ' + (customEnv.GEMINI_API_KEY ? 'SET' : 'NOT SET'));
        console.log('[GMCPT] API Key first 10 chars: ' + (customEnv.GEMINI_API_KEY && typeof customEnv.GEMINI_API_KEY === 'string' ? customEnv.GEMINI_API_KEY.substring(0, 10) + '...' : 'NONE'));
        console.log('[GMCPT] Executing gemini command: ' + CLI.COMMANDS.GEMINI + ' ' + args.join(' '));
        console.log('[GMCPT] Full command args: ' + JSON.stringify(args));
        
        // Execute gemini command directly with custom environment
        const result = await executeCommandWithEnv(CLI.COMMANDS.GEMINI, args, customEnv, onProgress, powershellPath);
        
        if (changeMode && result.stdout) {
            try {
                // Simple change mode processing - split by lines for chunking
                const lines = result.stdout.split('\n');
                const chunks = [];
                const chunkSize = 50; // lines per chunk
                
                for (let i = 0; i < lines.length; i += chunkSize) {
                    chunks.push(lines.slice(i, i + chunkSize).join('\n'));
                }
                
                if (chunks.length > 1) {
                    const cacheKey = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    cacheChunks(cacheKey, chunks);
                    
                    return `CHUNK 1/${chunks.length} (Cache Key: ${cacheKey})\n\n${chunks[0]}\n\n[Use fetch-chunk tool with cacheKey "${cacheKey}" and chunkIndex 2-${chunks.length} to get remaining chunks]`;
                } else {
                    return result.stdout;
                }
            } catch (parseError) {
                console.error(`Failed to parse change mode output: ${parseError.message}`);
                return result.stdout;
            }
        }
        
        // Ensure we return a valid string even if stdout is empty or undefined
        if (!result.stdout || result.stdout.trim() === '') {
            console.log('[GMCPT] stdout is empty, checking stderr for potential API response');
            if (result.stderr && result.stderr.includes('API response')) {
                return result.stderr;
            }
            return 'No output received from Gemini CLI. Please check your API key and try again.';
        }
        return result.stdout;
    } catch (error) {
        console.error(`Gemini CLI execution failed: ${error.message}`);
        throw error;
    }
}

export function getChunkedEdits(cacheKey, chunkIndex) {
    try {
        const chunks = getChunks(cacheKey);
        if (!chunks || chunks.length === 0) {
            throw new Error('No cached chunks found for the provided cache key');
        }
        
        const chunk = chunks[chunkIndex - 1]; // Convert to 0-based index
        if (!chunk) {
            throw new Error(`Chunk ${chunkIndex} not found. Available chunks: 1-${chunks.length}`);
        }
        
        return {
            content: chunk,
            chunk: chunkIndex,
            totalChunks: chunks.length,
            cacheKey: cacheKey,
            hasMore: chunkIndex < chunks.length
        };
    } catch (error) {
        console.error(`Failed to retrieve chunk: ${error.message}`);
        throw error;
    }
}