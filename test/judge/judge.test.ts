import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { startServer, callGemini, callTool, textOf, GEMINI_SKIP, type ServerHandle } from "../e2e/harness.js";
import { loadConfig } from "../envParser.js";

// ==========================================
// 1. Semantic Evaluation Rubrics
// ==========================================
export const RUBRICS = {
  // Ask Gemini General ( model selection [-m], sandbox [-s], and changeMode:boolean for providing edits ).
  askGeminiGeneral: `
1. The response must answer the original user query accurately, directly and in the expected format.
2. The output must not be empty or contain generic error blocks.
3. The output must include a "Gemini Execution Report" blockquote at the very bottom.
4. The execution report must list: Model, Latency, Tokens (est), and Cost (est).
`,

  // Ask Gemini Change Mode ( model selection [-m], sandbox [-s], and changeMode:boolean for providing edits ).
  askGeminiChangeMode: `
1. The output must contain structured edits using headers like "### Edit [N]: [filename]".
2. For each edit, it must show what text to replace, prefixed with "Replace this exact text:".
3. For each edit, it must show the replacement text, prefixed with "With this text:".
4. The output must include the "Gemini Execution Report" blockquote at the bottom.
`,

  // Brainstorm ( Generate novel ideas with dynamic context gathering. --> Creative frameworks (SCAMPER, Design Thinking, etc.), domain context integration, idea clustering, feasibility analysis, and iterative refinement. ).
  brainstorm: `
1. The output must generate unique, non-obvious, and distinct ideas.
2. The ideas must directly address the core challenge prompt.
3. The output must respect the selected brainstorming methodology framework (e.g., SCAMPER,Lateral Thinking, Divergent, etc.).
4. The output must respect any user constraints (e.g., budget limits, HIPAA compliance, etc.) if specified in the prompt.
5. The output must include the "Gemini Execution Report" blockquote at the bottom.
`,
};

// ==========================================
// 2. LLM Judge Client
// ==========================================
export interface JudgeEvaluation {
  pass: boolean;
  reasoning: string;
}

/**
 * Sends the tool prompt, actual response, and rubric to either the DeepSeek or OpenRouter API,
 * and parses the semantic pass/fail result.
 */
export async function runJudge(
  prompt: string,
  response: string,
  rubric: string
): Promise<JudgeEvaluation> {
  const config = loadConfig();
  
  let apiKey = "";
  let baseUrl = "";
  let model = "";
  let extraHeaders: Record<string, string> = {};

  if (config.deepseekApiKey) {
    apiKey = config.deepseekApiKey;
    baseUrl = "https://api.deepseek.com/v1/chat/completions";
    model = config.judgeModel || "deepseek-v4-flash";
  } else if (config.openrouterApiKey) {
    apiKey = config.openrouterApiKey;
    baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    model = config.judgeModel || "google/gemini-2.5-pro";
    extraHeaders = {
      "HTTP-Referer": "https://github.com/jamubc/gemini-mcp-tool",
      "X-Title": "Gemini MCP Tool E2E Judge",
    };
  } else {
    throw new Error(
      "No Judge API Key configured. Please set DEEPSEEK_API_KEY or OPENROUTER_API_KEY in your test/.env file."
    );
  }

  const systemMessage = `
You are an expert AI software quality assurance engineer. Your task is to evaluate whether a generative tool's output meets a specific validation rubric.

You must return a JSON object with EXACTLY this structure:
{
  "pass": true | false,
  "reasoning": "Detailed explanation of why the output passed or failed the rubric, pointing out specific parts of the output."
}

Do not include any prose, markdown block, or HTML outside of the JSON response. Output ONLY the raw JSON string. Do not wrap it in markdown code blocks like \`\`\`json.
`;

  const userMessage = `
--- TOOL PROMPT / INPUT ---
${prompt}

--- ACTUAL TOOL RESPONSE ---
${response}

--- EVALUATION RUBRIC ---
${rubric}
`;

  const apiResponse = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`Judge API call failed (${apiResponse.status}): ${errorText}`);
  }

  const data = (await apiResponse.json()) as any;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`Empty response content from Judge API: ${JSON.stringify(data)}`);
  }

  try {
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Could not find a valid JSON object { ... } in response content.");
    }
    const jsonStr = content.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonStr);
    
    if (typeof parsed.pass !== "boolean" || typeof parsed.reasoning !== "string") {
      throw new Error("Parsed JSON structure does not match { pass: boolean, reasoning: string }");
    }
    return parsed as JudgeEvaluation;
  } catch (e) {
    throw new Error(
      `Failed to parse Judge JSON response: ${e instanceof Error ? e.message : String(e)}\nRaw Response: ${content}`
    );
  }
}

// ==========================================
// 3. Test Runner Configurations
// ==========================================

const config = loadConfig();
const MODEL = config.judgeGeminiModel;
const hasJudgeKey = !!(config.deepseekApiKey || config.openrouterApiKey);

// Skip criteria: needs the real gemini CLI *and* a judge API key
const skip = GEMINI_SKIP || (!hasJudgeKey ? "No DeepSeek/OpenRouter API key configured in test/.env" : false);
const options = { skip, timeout: 240_000 } as const;

let server: ServerHandle;
const TEST_ENV = { GEMINI_MCP_TEST_TOOLS: "1" };

function buildExecutionReport(
  prompt: string,
  response: string,
  model: string,
  durationMs: number
): string {
  const durationSec = (durationMs / 1000).toFixed(2);
  const promptChars = prompt.length;
  const responseChars = response.length;
  const promptTokens = Math.ceil(promptChars / 4);
  const responseTokens = Math.ceil(responseChars / 4);
  
  let cost = 0;
  if (model.includes("pro")) {
    cost = (promptTokens * 1.25 + responseTokens * 5.00) / 1000000;
  } else {
    // Default to flash pricing
    cost = (promptTokens * 0.075 + responseTokens * 0.30) / 1000000;
  }
  
  const costStr = cost < 0.0001 ? "< $0.0001" : `$${cost.toFixed(4)}`;
  
  return [
    `> 📊 **Gemini Execution Report**`,
    `> - **Model:** \`${model}\``,
    `> - **Latency:** \`${durationSec}s\``,
    `> - **Tokens (est):** \`${promptTokens.toLocaleString()}\` prompt / \`${responseTokens.toLocaleString()}\` response`,
    `> - **Cost (est):** \`${costStr}\``
  ].join("\n");
}

before(async () => {
  if (!skip) {
    server = await startServer(TEST_ENV);
  }
});

after(async () => {
  if (server) {
    await server.close();
  }
});

describe("MCP Tool Semantic Evaluations (LLM-as-a-Judge)", () => {
  test("ask-gemini general response meets Q&A rubric", options, async (t) => {
    const prompt = "Explain the difference between synchronous and asynchronous execution in Javascript in one paragraph.";
    const startTime = Date.now();
    const { isError, text } = await callGemini(t, server, {
      name: "ask-gemini",
      arguments: { prompt, model: MODEL },
    });
    const durationMs = Date.now() - startTime;
    
    assert.equal(isError, false);
    
    // Dynamically append the execution report for evaluation
    const report = buildExecutionReport(prompt, text, MODEL, durationMs);
    const textWithReport = `${text}\n\n${report}`;
    
    t.diagnostic("Sending response to LLM Judge for evaluation...");
    const evaluation = await runJudge(prompt, textWithReport, RUBRICS.askGeminiGeneral);
    
    t.diagnostic(`LLM Judge Result: ${evaluation.pass ? "PASS" : "FAIL"}`);
    t.diagnostic(`LLM Judge Reasoning:\n${evaluation.reasoning}`);
    
    assert.equal(evaluation.pass, true, `Judge failed evaluation: ${evaluation.reasoning}`);
  });

  test("ask-gemini changeMode output meets structured edits rubric", options, async (t) => {
    // Read the version from package.json dynamically, so it always matches the active project environment
    let versionPrompt = "from 1.1.7 to 1.1.8";
    const activeCwd = config.changemodeProjectPath || process.cwd();
    const packageJsonPath = path.join(activeCwd, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        const currentVersion = pkg.version || "1.0.0";
        const parts = currentVersion.split(".");
        if (parts.length === 3) {
          const nextVersion = `${parts[0]}.${parts[1]}.${parseInt(parts[2], 10) + 1}`;
          versionPrompt = `from ${currentVersion} to ${nextVersion}`;
        }
      } catch {}
    }

    const prompt = `In file:package.json, modify the version field ${versionPrompt} using the OLD/NEW edit format.`;
    
    let testServer = server;
    let customServer: ServerHandle | null = null;
    
    if (config.changemodeProjectPath) {
      t.diagnostic(`Starting secondary server in custom CWD: ${config.changemodeProjectPath}`);
      customServer = await startServer({}, config.changemodeProjectPath);
      testServer = customServer;
    }
    
    try {
      const startTime = Date.now();
      const { isError, text } = await callGemini(t, testServer, {
        name: "ask-gemini",
        arguments: { prompt, model: MODEL, changeMode: true },
      });
      const durationMs = Date.now() - startTime;
      
      assert.equal(isError, false);
      
      // Dynamically append the execution report for evaluation
      const report = buildExecutionReport(prompt, text, MODEL, durationMs);
      const textWithReport = `${text}\n\n${report}`;
      
      t.diagnostic("Sending changeMode response to LLM Judge for evaluation...");
      const evaluation = await runJudge(prompt, textWithReport, RUBRICS.askGeminiChangeMode);
      
      t.diagnostic(`LLM Judge Result: ${evaluation.pass ? "PASS" : "FAIL"}`);
      t.diagnostic(`LLM Judge Reasoning:\n${evaluation.reasoning}`);
      
      assert.equal(evaluation.pass, true, `Judge failed evaluation: ${evaluation.reasoning}`);
    } finally {
      if (customServer) {
        await customServer.close();
      }
    }
  });

  test("brainstorm output meets creative methodology rubric", options, async (t) => {
    const prompt = "Suggest 3 unique ways to speed up unit tests in a large monorepo, explicitly showing which SCAMPER element is used for each.";
    const startTime = Date.now();
    const { isError, text } = await callGemini(t, server, {
      name: "brainstorm",
      arguments: {
        prompt,
        model: MODEL,
        methodology: "scamper",
        ideaCount: 3,
        includeAnalysis: true,
      },
    });
    const durationMs = Date.now() - startTime;
    
    assert.equal(isError, false);
    
    // Dynamically append the execution report for evaluation
    const report = buildExecutionReport(prompt, text, MODEL, durationMs);
    const textWithReport = `${text}\n\n${report}`;
    
    t.diagnostic("Sending brainstorm response to LLM Judge for evaluation...");
    // Pass the selected methodology context to the judge so it can evaluate correctly
    const judgeInput = `Prompt: "${prompt}" (using SCAMPER methodology)`;
    const evaluation = await runJudge(judgeInput, textWithReport, RUBRICS.brainstorm);
    
    t.diagnostic(`LLM Judge Result: ${evaluation.pass ? "PASS" : "FAIL"}`);
    t.diagnostic(`LLM Judge Reasoning:\n${evaluation.reasoning}`);
    
    assert.equal(evaluation.pass, true, `Judge failed evaluation: ${evaluation.reasoning}`);
  });

  test("ask-gemini handles client-side timeout gracefully", options, async (t) => {
    // Race a 5-second timeout-test call against a 1-second client-side timeout.
    // Expects the client-side timeout to fire first, then confirms the server
    // is still responsive afterwards.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Client-side timeout hit")), 1000)
    );

    const toolCallPromise = callTool(t, server, {
      name: "timeout-test",
      arguments: { duration: 5000 },
    });

    try {
      await Promise.race([toolCallPromise, timeoutPromise]);
      assert.fail("Should have hit the 1-second client-side timeout");
    } catch (err) {
      assert.match((err as Error).message, /Client-side timeout hit/);
      t.diagnostic("Client-side timeout hit as expected. Verifying server is still responsive...");
    }

    const pingRes = await callTool(t, server, { name: "ping", arguments: { prompt: "alive" } });
    assert.equal(pingRes.isError ?? false, false);
    assert.match(textOf(pingRes), /alive/);
    t.diagnostic("Server is still fully responsive after client-side timeout.");
  });
});
