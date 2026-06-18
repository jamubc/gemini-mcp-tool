import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  planApply,
  renderDiff,
  commitPlan,
  type ApplyPlan,
} from '../../../src/utils/changeModeApplier.js';
import { type ChangeModeEdit } from '../../../src/utils/changeModeParser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function edit(filename: string, oldCode: string, newCode: string): ChangeModeEdit {
  return {
    filename,
    oldStartLine: 1,
    oldEndLine: 1,
    oldCode,
    newStartLine: 1,
    newEndLine: 1,
    newCode,
  };
}

function makeReadFile(files: Record<string, string>) {
  return (absPath: string): string => {
    const content = files[absPath];
    if (content === undefined) throw new Error(`File not found: ${absPath}`);
    return content;
  };
}

function rootFor(filename: string): string {
  // Returns the directory portion so the file path is resolvable.
  return path.dirname(path.resolve('/', filename));
}

/** Create a real temp directory, write files, run fn, then clean up. */
function withTempDir(
  files: Record<string, string>,
  fn: (dir: string) => void
): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'applier-test-'));
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
// planApply: single-file success
// ---------------------------------------------------------------------------

describe('changeModeApplier: planApply', () => {
  test('applies a single edit to a single file', () => {
    const root = '/project';
    const absPath = path.resolve(root, 'src/a.ts');
    const files: Record<string, string> = {
      [absPath]: 'const x = 1;\nconst y = 2;\n',
    };
    const plan = planApply([edit('src/a.ts', 'const x = 1;', 'const x = 99;')], {
      root,
      readFile: makeReadFile(files),
    });

    assert.equal(plan.errors.length, 0, `unexpected errors: ${plan.errors.join('; ')}`);
    assert.equal(plan.files.length, 1);
    assert.ok(plan.files[0].newContent.includes('const x = 99;'));
    assert.ok(!plan.files[0].newContent.includes('const x = 1;'));
    assert.equal(plan.files[0].editCount, 1);
  });

  test('applies multiple edits across multiple files', () => {
    const root = '/project';
    const absA = path.resolve(root, 'src/a.ts');
    const absB = path.resolve(root, 'src/b.ts');
    const files: Record<string, string> = {
      [absA]: 'alpha\nbeta\n',
      [absB]: 'gamma\ndelta\n',
    };
    const plan = planApply(
      [
        edit('src/a.ts', 'alpha', 'ALPHA'),
        edit('src/b.ts', 'gamma', 'GAMMA'),
      ],
      { root, readFile: makeReadFile(files) }
    );

    assert.equal(plan.errors.length, 0, `unexpected errors: ${plan.errors.join('; ')}`);
    assert.equal(plan.files.length, 2);
    const a = plan.files.find(f => f.path === absA)!;
    const b = plan.files.find(f => f.path === absB)!;
    assert.ok(a.newContent.includes('ALPHA'));
    assert.ok(b.newContent.includes('GAMMA'));
  });

  // -----------------------------------------------------------------------
  // Error cases
  // -----------------------------------------------------------------------

  test('OLD block not found → error recorded', () => {
    const root = '/project';
    const absPath = path.resolve(root, 'src/a.ts');
    const files: Record<string, string> = {
      [absPath]: 'const x = 1;\n',
    };
    const plan = planApply([edit('src/a.ts', 'DOES_NOT_EXIST', 'nope')], {
      root,
      readFile: makeReadFile(files),
    });

    assert.ok(plan.errors.length >= 1, 'expected at least one error');
    assert.ok(
      plan.errors.some(e => /not found/i.test(e)),
      `expected "not found" error, got: ${plan.errors.join('; ')}`
    );
    assert.equal(plan.files.length, 0);
  });

  test('OLD block ambiguous (>1 occurrence) → error recorded', () => {
    const root = '/project';
    const absPath = path.resolve(root, 'src/a.ts');
    const files: Record<string, string> = {
      [absPath]: 'foo\nfoo\n',
    };
    const plan = planApply([edit('src/a.ts', 'foo', 'bar')], {
      root,
      readFile: makeReadFile(files),
    });

    assert.ok(plan.errors.length >= 1, 'expected at least one error');
    assert.ok(
      plan.errors.some(e => /ambiguous/i.test(e)),
      `expected "ambiguous" error, got: ${plan.errors.join('; ')}`
    );
    assert.equal(plan.files.length, 0);
  });

  // -----------------------------------------------------------------------
  // Path confinement
  // -----------------------------------------------------------------------

  test('rejects absolute paths', () => {
    const root = '/project';
    const plan = planApply([edit('/etc/passwd', 'root', 'evil')], {
      root,
      readFile: (_p: string) => '',
    });
    assert.ok(plan.errors.length >= 1, 'expected a confinement error');
    assert.ok(
      plan.errors.some(e => /absolute/i.test(e) || /Refusing/i.test(e)),
      `got: ${plan.errors.join('; ')}`
    );
  });

  test('rejects tilde-prefixed paths', () => {
    const root = '/project';
    const plan = planApply([edit('~/.ssh/id_rsa', 'secret', 'evil')], {
      root,
      readFile: (_p: string) => '',
    });
    assert.ok(plan.errors.length >= 1);
    assert.ok(
      plan.errors.some(e => /home-directory|Refusing/i.test(e)),
      `got: ${plan.errors.join('; ')}`
    );
  });

  test('rejects paths that escape root via ..', () => {
    const root = '/project/src';
    const plan = planApply([edit('../../../etc/passwd', 'root', 'evil')], {
      root,
      readFile: (_p: string) => '',
    });
    assert.ok(plan.errors.length >= 1);
    assert.ok(
      plan.errors.some(e => /escape|Refusing/i.test(e)),
      `got: ${plan.errors.join('; ')}`
    );
  });
});

// ---------------------------------------------------------------------------
// renderDiff
// ---------------------------------------------------------------------------

describe('changeModeApplier: renderDiff', () => {
  test('contains --- and +++ headers for each file', () => {
    const root = '/project';
    const absPath = path.resolve(root, 'src/a.ts');
    const plan = planApply([edit('src/a.ts', 'old line', 'new line')], {
      root,
      readFile: (_p: string) => 'old line\n',
    });

    const diff = renderDiff(plan);
    assert.ok(diff.includes('---'), 'expected --- in diff');
    assert.ok(diff.includes('+++'), 'expected +++ in diff');
    assert.ok(diff.includes('-old line'), 'expected -old line in diff');
    assert.ok(diff.includes('+new line'), 'expected +new line in diff');
  });

  test('returns "(no changes)" for an empty plan', () => {
    const emptyPlan: ApplyPlan = { files: [], errors: [] };
    assert.equal(renderDiff(emptyPlan), '(no changes)');
  });
});

// ---------------------------------------------------------------------------
// commitPlan: atomicity and rollback
// ---------------------------------------------------------------------------

describe('changeModeApplier: commitPlan atomicity', () => {
  test('writes all files when no error occurs', () => {
    withTempDir({ 'a.ts': 'old a\n', 'b.ts': 'old b\n' }, dir => {
      const absA = path.join(dir, 'a.ts');
      const absB = path.join(dir, 'b.ts');

      const plan = planApply(
        [edit('a.ts', 'old a', 'new a'), edit('b.ts', 'old b', 'new b')],
        { root: dir, readFile: (p: string) => fs.readFileSync(p, 'utf8') }
      );
      assert.equal(plan.errors.length, 0, `plan errors: ${plan.errors.join('; ')}`);

      commitPlan(plan, {
        writeFile: (p: string, c: string) => fs.writeFileSync(p, c, 'utf8'),
      });

      assert.equal(fs.readFileSync(absA, 'utf8'), 'new a\n');
      assert.equal(fs.readFileSync(absB, 'utf8'), 'new b\n');
    });
  });

  test('rolls back already-written files when a later write fails', () => {
    withTempDir({ 'a.ts': 'old a\n', 'b.ts': 'old b\n' }, dir => {
      const absA = path.join(dir, 'a.ts');

      const plan = planApply(
        [edit('a.ts', 'old a', 'new a'), edit('b.ts', 'old b', 'new b')],
        { root: dir, readFile: (p: string) => fs.readFileSync(p, 'utf8') }
      );
      assert.equal(plan.errors.length, 0, `plan errors: ${plan.errors.join('; ')}`);

      let callCount = 0;
      assert.throws(
        () =>
          commitPlan(plan, {
            writeFile: (p: string, c: string) => {
              callCount++;
              if (callCount === 2) {
                throw new Error('Simulated disk error on second write');
              }
              fs.writeFileSync(p, c, 'utf8');
            },
          }),
        /Simulated disk error/
      );

      // First file must have been rolled back.
      assert.equal(
        fs.readFileSync(absA, 'utf8'),
        'old a\n',
        'first file should have been restored after rollback'
      );
    });
  });

  test('throws when called with a plan containing errors', () => {
    const badPlan: ApplyPlan = {
      files: [],
      errors: ['something went wrong'],
    };
    assert.throws(
      () => commitPlan(badPlan, { writeFile: () => {} }),
      /errors/
    );
  });
});
