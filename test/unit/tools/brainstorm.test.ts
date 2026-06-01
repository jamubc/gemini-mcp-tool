import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildBrainstormPrompt,
  getMethodologyInstructions,
} from "../../../src/tools/brainstorm.tool.js";

describe("MCP Tool: brainstorm Prompt", () => {
  test("getMethodologyInstructions returns the requested framework", () => {
    assert.match(getMethodologyInstructions("scamper"), /SCAMPER/);
    assert.match(getMethodologyInstructions("scamper"), /Substitute/);
    assert.match(getMethodologyInstructions("divergent"), /Divergent Thinking/);
    assert.match(getMethodologyInstructions("design-thinking"), /Empathize/);
  });

  test("getMethodologyInstructions falls back to the auto framework for unknown methodologies", () => {
    const out = getMethodologyInstructions("not-a-real-methodology");
    assert.match(out, /AI-Optimized Approach/);
  });

  test("getMethodologyInstructions weaves the domain into the auto framework", () => {
    assert.match(getMethodologyInstructions("auto", "fintech"), /fintech/);
  });

  test("buildBrainstormPrompt embeds the challenge, idea count, and chosen framework", () => {
    const prompt = buildBrainstormPrompt({
      prompt: "How do we reduce churn?",
      methodology: "scamper",
      ideaCount: 7,
      includeAnalysis: true,
    });
    assert.match(prompt, /# BRAINSTORMING SESSION/);
    assert.ok(prompt.includes("How do we reduce churn?"));
    assert.match(prompt, /Generate 7 distinct/);
    assert.match(prompt, /SCAMPER/);
    assert.match(prompt, /## Analysis Framework/); // analysis requested
  });

  test("buildBrainstormPrompt omits the analysis framework when not requested", () => {
    const prompt = buildBrainstormPrompt({
      prompt: "ideas",
      methodology: "divergent",
      ideaCount: 5,
      includeAnalysis: false,
    });
    assert.doesNotMatch(prompt, /## Analysis Framework/);
  });

  test("buildBrainstormPrompt injects optional domain, constraints, and context", () => {
    const prompt = buildBrainstormPrompt({
      prompt: "ideas",
      methodology: "auto",
      domain: "healthcare",
      constraints: "HIPAA compliant",
      existingContext: "prior pilot failed",
      ideaCount: 3,
      includeAnalysis: false,
    });
    assert.ok(prompt.includes("healthcare"));
    assert.ok(prompt.includes("HIPAA compliant"));
    assert.ok(prompt.includes("prior pilot failed"));
  });
});

