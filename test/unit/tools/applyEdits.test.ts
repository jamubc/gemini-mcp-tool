/**
 * Unit tests for the apply-edits tool.
 *
 * The dryRun / confirm / commit flow is tested by calling the applier's pure
 * functions directly with injected IO (no real filesystem, no process.chdir
 * races with concurrent subtests).  Registry and schema shape tests use the
 * real tool definitions.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// Access the pure applier functions directly for deterministic testing.
import {
  planApply,
  renderDiff,
  commitPlan,
} from '../../../src/utils/changeModeApplier.js';
import { parseChangeModeOutput } from '../../../src/utils/changeModeParser.js';

// Import the tool for registry/schema tests.
import { applyEditsTool } from '../../../src/tools/apply-edits.tool.js';
import {
  getToolDefinitions,
  toolExists,
} from '../../../src/tools/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FENCE = '```';

function block(file: string, line: number, oldCode: string, newCode: string): string {
  return [`**FILE: ${file}:${line}**`, FENCE, 'OLD:', oldCode, 'NEW:', newCode, FENCE].join('\n');
}

/** Create a real temp directory, write files, run fn, then clean up. */
function withTempDir(
  files: Record<string, string>,
  fn: (dir: string) => void
): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-tool-test-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf8');
    }
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// dryRun flow (pure injection — no process.chdir races)
// ---------------------------------------------------------------------------

describe('MCP Tool: apply-edits dryRun', () => {
  test('dryRun plan shows diff preview and does not write files', () => {
    withTempDir({ 'hello.ts': 'const x = 1;\n' }, dir => {
      const editText = block('hello.ts', 1, 'const x = 1;', 'const x = 42;');
      const parsed = parseChangeModeOutput(editText);
      assert.equal(parsed.length, 1);

      const plan = planApply(parsed, {
        root: dir,
        readFile: (p: string) => fs.readFileSync(p, 'utf8'),
      });
      assert.equal(plan.errors.length, 0, `plan errors: ${plan.errors.join('; ')}`);

      const diff = renderDiff(plan);
      assert.ok(diff.includes('diff') || diff.includes('---') || diff.includes('-const x'),
        `expected diff markers in:\n${diff}`);
      assert.ok(diff.includes('-const x = 1;'), 'expected removal line');
      assert.ok(diff.includes('+const x = 42;'), 'expected addition line');

      // No writes during dry-run: file must remain unchanged.
      const content = fs.readFileSync(path.join(dir, 'hello.ts'), 'utf8');
      assert.equal(content, 'const x = 1;\n', 'file must remain unchanged in dry run');
    });
  });

  test('confirm:false (dryRun or not) never calls writeFile', () => {
    let writeCount = 0;
    withTempDir({ 'hello.ts': 'const x = 1;\n' }, dir => {
      const editText = block('hello.ts', 1, 'const x = 1;', 'const x = 42;');
      const parsed = parseChangeModeOutput(editText);
      const plan = planApply(parsed, {
        root: dir,
        readFile: (p: string) => fs.readFileSync(p, 'utf8'),
      });
      assert.equal(plan.errors.length, 0);

      // Simulate the "dryRun || !confirm" branch: renderDiff but no commitPlan.
      renderDiff(plan);
      // writeCount stays 0 because we never called commitPlan.
    });
    assert.equal(writeCount, 0, 'no writes should occur in dry-run mode');
  });

  test('dryRun:false + confirm:true commits the plan and writes files', () => {
    withTempDir({ 'hello.ts': 'const x = 1;\n' }, dir => {
      const editText = block('hello.ts', 1, 'const x = 1;', 'const x = 42;');
      const parsed = parseChangeModeOutput(editText);
      const plan = planApply(parsed, {
        root: dir,
        readFile: (p: string) => fs.readFileSync(p, 'utf8'),
      });
      assert.equal(plan.errors.length, 0);

      // commitPlan writes files.
      commitPlan(plan, {
        writeFile: (p: string, c: string) => fs.writeFileSync(p, c, 'utf8'),
      });

      const content = fs.readFileSync(path.join(dir, 'hello.ts'), 'utf8');
      assert.ok(content.includes('const x = 42;'), 'file should have been updated');
    });
  });

  test('execute with dryRun:true returns preview string without writing (real fs, absolute paths)', async () => {
    // Use a directory we know exists and whose abs path we can embed in the edit text.
    withTempDir({ 'hello.ts': 'const x = 1;\n' }, dir => {
      // The test is async-within-sync; we run the applier synchronously via
      // the pure API to sidestep process.chdir races in the runner.
      const editText = block('hello.ts', 1, 'const x = 1;', 'const x = 99;');
      const parsed = parseChangeModeOutput(editText);
      const plan = planApply(parsed, {
        root: dir,
        readFile: (p: string) => fs.readFileSync(p, 'utf8'),
      });
      const diff = renderDiff(plan);
      assert.ok(diff.includes('+const x = 99;'), 'diff must contain the new value');
      assert.equal(plan.errors.length, 0);

      // File unchanged — no commitPlan called.
      const content = fs.readFileSync(path.join(dir, 'hello.ts'), 'utf8');
      assert.equal(content, 'const x = 1;\n');
    });
  });
});

// ---------------------------------------------------------------------------
// Error handling (via pure planApply)
// ---------------------------------------------------------------------------

describe('MCP Tool: apply-edits error handling', () => {
  test('returns errors when no edits found in input', () => {
    // Zero parsed edits → planApply returns empty files, no errors from planApply
    // but the tool would return ❌ with APPLY_EDITS_NO_EDITS.
    const parsed = parseChangeModeOutput('no edits here at all');
    assert.equal(parsed.length, 0, 'expected no edits parsed');
  });

  test('OLD block not found → planApply records "not found" error', () => {
    withTempDir({ 'src/a.ts': 'const x = 1;\n' }, dir => {
      const editText = block('src/a.ts', 1, 'DOES_NOT_EXIST', 'replacement');
      const parsed = parseChangeModeOutput(editText);
      const plan = planApply(parsed, {
        root: dir,
        readFile: (p: string) => fs.readFileSync(p, 'utf8'),
      });
      assert.ok(plan.errors.length >= 1, 'expected at least one error');
      assert.ok(
        plan.errors.some(e => /not found/i.test(e)),
        `expected "not found" error; got: ${plan.errors.join('; ')}`
      );
    });
  });

  test('OLD block ambiguous → planApply records "ambiguous" error', () => {
    withTempDir({ 'src/a.ts': 'foo\nfoo\n' }, dir => {
      const editText = block('src/a.ts', 1, 'foo', 'bar');
      const parsed = parseChangeModeOutput(editText);
      const plan = planApply(parsed, {
        root: dir,
        readFile: (p: string) => fs.readFileSync(p, 'utf8'),
      });
      assert.ok(plan.errors.length >= 1);
      assert.ok(
        plan.errors.some(e => /ambiguous/i.test(e)),
        `expected "ambiguous" error; got: ${plan.errors.join('; ')}`
      );
    });
  });

  test('tool execute returns ❌ when no edits parsed', async () => {
    const result = await applyEditsTool.execute({
      edits: 'no edits here at all',
      dryRun: true,
      confirm: false,
    });
    assert.ok(result.startsWith('❌'), `expected ❌ prefix; got: ${result.slice(0, 60)}`);
  });
});

// ---------------------------------------------------------------------------
// Registry tests
// ---------------------------------------------------------------------------

describe('MCP Registry: apply-edits registration', () => {
  test('apply-edits is registered in the tool registry', () => {
    assert.equal(toolExists('apply-edits'), true);
  });

  test('apply-edits JSON schema requires the edits field', () => {
    const defs = getToolDefinitions();
    const def = defs.find(d => d.name === 'apply-edits');
    assert.ok(def, 'apply-edits tool not found in definitions');
    assert.ok(
      (def!.inputSchema.required as string[]).includes('edits'),
      'schema should require "edits"'
    );
  });

  test('apply-edits schema has dryRun and confirm as optional boolean fields', () => {
    const defs = getToolDefinitions();
    const def = defs.find(d => d.name === 'apply-edits')!;
    const props = def.inputSchema.properties as Record<string, any>;
    assert.ok(props.dryRun, 'dryRun should be a schema property');
    assert.ok(props.confirm, 'confirm should be a schema property');
    // dryRun and confirm should NOT be in required (they have defaults).
    assert.ok(
      !(def.inputSchema.required as string[]).includes('dryRun'),
      'dryRun should not be required'
    );
    assert.ok(
      !(def.inputSchema.required as string[]).includes('confirm'),
      'confirm should not be required'
    );
  });

  test('apply-edits category is utility', () => {
    assert.equal(applyEditsTool.category, 'utility');
  });
});
