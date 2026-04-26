#!/usr/bin/env node
import { spawn } from "node:child_process";

const iterations = Number.parseInt(process.argv[2] ?? "10", 10);

async function runGeminiPing(iteration) {
  return new Promise((resolve, reject) => {
    const child = spawn("gemini", ["-p", `Reply with exactly: pong ${iteration}`], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`iteration ${iteration} timed out`));
    }, 300_000);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.error(`iteration ${iteration}: ok`);
        resolve(stdout.trim());
        return;
      }

      reject(new Error(`iteration ${iteration} failed with ${code}: ${stderr.trim()}`));
    });
  });
}

for (let iteration = 1; iteration <= iterations; iteration += 1) {
  const output = await runGeminiPing(iteration);
  if (!output.includes(`pong ${iteration}`)) {
    throw new Error(`iteration ${iteration} returned unexpected output: ${output}`);
  }
}

console.error(`${iterations} Gemini CLI OAuth calls completed successfully`);
