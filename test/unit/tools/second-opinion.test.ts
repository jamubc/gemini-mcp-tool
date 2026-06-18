import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSolvePrompt,
  buildComparePrompt,
  formatResult,
} from '../../../src/utils/secondOpinion.js';
import { createSecondOpinionTool } from '../../../src/tools/second-opinion.tool.js';
import { toolExists, getToolDefinitions } from '../../../src/tools/index.js';

// ---------------------------------------------------------------------------
// Pure helpers: secondOpinion.ts
// ---------------------------------------------------------------------------

describe('secondOpinion: buildSolvePrompt', () => {
  test('only depends on problem — no answer parameter in signature', () => {
    // TypeScript enforces single-arg at compile time; here we confirm the
    // runtime output only reflects the problem.
    const problem = 'How should we handle distributed transactions?';
    const prompt = buildSolvePrompt(problem);
    assert.ok(prompt.includes(problem), 'prompt contains the problem text');
  });

  test('does not contain any known-answer sentinel', () => {
    const sentinel = 'ORCHESTRATOR_OWN_ANSWER_SENTINEL_XYZ_12345';
    const prompt = buildSolvePrompt('some problem');
    assert.ok(
      !prompt.includes(sentinel),
      'buildSolvePrompt must not include any answer text'
    );
  });

  test('instructs the solver to reason independently', () => {
    const prompt = buildSolvePrompt('explain caching strategies');
    assert.match(prompt, /independent/i);
  });
});

describe('secondOpinion: buildComparePrompt', () => {
  test('includes problem, ownAnswer, and independentAnswer', () => {
    const problem = 'What is the best sorting algorithm?';
    const ownAnswer = 'Quicksort for average cases.';
    const independentAnswer = 'Mergesort for stability guarantees.';
    const prompt = buildComparePrompt(problem, ownAnswer, independentAnswer);
    assert.ok(prompt.includes(problem), 'contains problem');
    assert.ok(prompt.includes(ownAnswer), 'contains ownAnswer');
    assert.ok(prompt.includes(independentAnswer), 'contains independentAnswer');
  });

  test('asks for agreement and divergence analysis', () => {
    const prompt = buildComparePrompt('p', 'a', 'b');
    assert.match(prompt, /agree/i);
    assert.match(prompt, /diverge/i);
  });
});

describe('secondOpinion: formatResult', () => {
  test('renders "Independent answer" section always', () => {
    const out = formatResult({ independentAnswer: 'The answer is 42.' });
    assert.match(out, /## Independent answer/);
    assert.ok(out.includes('The answer is 42.'));
  });

  test('omits "Points of divergence" when comparison is absent', () => {
    const out = formatResult({ independentAnswer: 'Answer here.' });
    assert.ok(!out.includes('Points of divergence'));
  });

  test('includes "Points of divergence" section when comparison is provided', () => {
    const out = formatResult({
      independentAnswer: 'Answer A.',
      comparison: 'They agree on X but differ on Y.',
    });
    assert.match(out, /## Points of divergence/);
    assert.ok(out.includes('They agree on X but differ on Y.'));
  });

  test('omits "Points of divergence" when comparison is an empty string', () => {
    const out = formatResult({ independentAnswer: 'Answer.', comparison: '' });
    assert.ok(!out.includes('Points of divergence'));
  });
});

// ---------------------------------------------------------------------------
// ANTI-ANCHORING INVARIANT — core correctness test
// ---------------------------------------------------------------------------

describe('second-opinion tool: anti-anchoring invariant', () => {
  test('the SOLVE call never receives ownAnswer — even with a distinctive sentinel', async () => {
    const SENTINEL = 'ORCHESTRATOR_ANSWER_SENTINEL_MUST_NOT_APPEAR_IN_SOLVE_1A2B3C';

    const capturedSolvePrompts: string[] = [];
    let callCount = 0;

    const fakeExecutor = async (prompt: string): Promise<string> => {
      callCount++;
      // First call is the solve call; capture it for inspection.
      if (callCount === 1) {
        capturedSolvePrompts.push(prompt);
        return 'Independent answer text.';
      }
      // Second call is the compare call; just return something.
      return 'Comparison text.';
    };

    const tool = createSecondOpinionTool(fakeExecutor);
    await tool.execute({
      problem: 'Describe the CAP theorem.',
      ownAnswer: SENTINEL,
      compare: true,
    });

    // Exactly one solve call must have been made.
    assert.equal(capturedSolvePrompts.length, 1, 'exactly one solve call made');

    // CRITICAL: the sentinel must NOT appear in the solve prompt.
    assert.ok(
      !capturedSolvePrompts[0].includes(SENTINEL),
      `The solve prompt must not contain the orchestrator's own answer. Got:\n${capturedSolvePrompts[0]}`
    );
  });

  test('compare call DOES receive ownAnswer and independentAnswer', async () => {
    const OWN = 'OWN_ANSWER_TEXT';
    const INDEPENDENT = 'INDEPENDENT_ANSWER_FROM_GEMINI';

    const capturedPrompts: string[] = [];

    const fakeExecutor = async (prompt: string): Promise<string> => {
      capturedPrompts.push(prompt);
      if (capturedPrompts.length === 1) return INDEPENDENT;
      return 'Comparison result.';
    };

    const tool = createSecondOpinionTool(fakeExecutor);
    await tool.execute({
      problem: 'Explain eventual consistency.',
      ownAnswer: OWN,
      compare: true,
    });

    assert.equal(capturedPrompts.length, 2, 'solve + compare = 2 calls');
    const comparePrompt = capturedPrompts[1];
    assert.ok(comparePrompt.includes(OWN), 'compare prompt contains ownAnswer');
    assert.ok(
      comparePrompt.includes(INDEPENDENT),
      'compare prompt contains independentAnswer'
    );
  });

  test('no compare call when compare=false', async () => {
    let callCount = 0;
    const fakeExecutor = async (): Promise<string> => {
      callCount++;
      return 'answer';
    };

    const tool = createSecondOpinionTool(fakeExecutor);
    await tool.execute({
      problem: 'Any problem.',
      ownAnswer: 'Some answer.',
      compare: false,
    });

    assert.equal(callCount, 1, 'only the solve call is made when compare=false');
  });

  test('no compare call when ownAnswer is absent', async () => {
    let callCount = 0;
    const fakeExecutor = async (): Promise<string> => {
      callCount++;
      return 'answer';
    };

    const tool = createSecondOpinionTool(fakeExecutor);
    await tool.execute({ problem: 'Any problem.' });

    assert.equal(callCount, 1, 'only the solve call is made when ownAnswer is absent');
  });
});

// ---------------------------------------------------------------------------
// Tool integration: registry
// ---------------------------------------------------------------------------

describe('second-opinion tool: registry', () => {
  test('tool is registered under the name "second-opinion"', () => {
    assert.equal(toolExists('second-opinion'), true);
  });

  test('schema requires problem; ownAnswer is optional', () => {
    const defs = getToolDefinitions();
    const def = defs.find((d) => d.name === 'second-opinion');
    assert.ok(def, 'second-opinion definition found');
    const required = def!.inputSchema.required as string[];
    assert.ok(required.includes('problem'), '"problem" is required');
    assert.ok(!required.includes('ownAnswer'), '"ownAnswer" is not required');
    assert.ok(!required.includes('model'), '"model" is not required');
    assert.ok(!required.includes('compare'), '"compare" is not required');
  });

  test('schema includes expected properties', () => {
    const defs = getToolDefinitions();
    const def = defs.find((d) => d.name === 'second-opinion');
    const props = def!.inputSchema.properties as Record<string, unknown>;
    assert.ok('problem' in props);
    assert.ok('ownAnswer' in props);
    assert.ok('model' in props);
    assert.ok('compare' in props);
  });

  test('formatResult output includes both sections when comparison provided', () => {
    const result = formatResult({
      independentAnswer: 'Ind answer.',
      comparison: 'Divergence details.',
    });
    assert.match(result, /## Independent answer/);
    assert.match(result, /## Points of divergence/);
  });
});
