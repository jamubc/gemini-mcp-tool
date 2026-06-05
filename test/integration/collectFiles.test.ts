import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { collectFiles } from '../../src/utils/sharding.js';

/**
 * Integration test for collectFiles.
 * Creates a real temporary directory tree, calls collectFiles, and verifies
 * the expected behaviour:
 *   - Returns files under the root with correct sizes.
 *   - Skips ignored directories (node_modules, .git, dist, .gemini-mcp, .tmptest).
 *   - Confined: rejects roots that escape process.cwd().
 */

let tmpDir: string;

before(() => {
  // Create a temp dir inside process.cwd() so the confinement check passes.
  tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmptest-collectfiles-'));
  // Nested structure:
  //   src/
  //     index.ts         (10 bytes)
  //     utils/
  //       helper.ts      (20 bytes)
  //   node_modules/
  //     some-pkg/
  //       index.js       (should be ignored)
  //   .git/
  //     HEAD             (should be ignored)
  //   dist/
  //     bundle.js        (should be ignored)
  //   .gemini-mcp/
  //     config.json      (should be ignored)
  //   .tmptest/
  //     temp.ts          (should be ignored)

  // Create non-ignored files
  fs.mkdirSync(path.join(tmpDir, 'src', 'utils'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), '0123456789'); // 10 bytes
  fs.writeFileSync(path.join(tmpDir, 'src', 'utils', 'helper.ts'), '01234567890123456789'); // 20 bytes

  // Create ignored directories with files inside
  fs.mkdirSync(path.join(tmpDir, 'node_modules', 'some-pkg'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'node_modules', 'some-pkg', 'index.js'), 'ignored');

  fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.git', 'HEAD'), 'ref: refs/heads/main');

  fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'dist', 'bundle.js'), 'bundled');

  fs.mkdirSync(path.join(tmpDir, '.gemini-mcp'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.gemini-mcp', 'config.json'), '{}');

  fs.mkdirSync(path.join(tmpDir, '.tmptest'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.tmptest', 'temp.ts'), 'temp');
});

after(() => {
  // Clean up the temp directory.
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('collectFiles (integration)', () => {
  test('returns only non-ignored files with correct byte sizes', () => {
    const results = collectFiles(tmpDir);

    const relPaths = results.map((f) =>
      path.relative(tmpDir, f.path).replace(/\\/g, '/'),
    );

    assert.ok(relPaths.includes('src/index.ts'), 'should include src/index.ts');
    assert.ok(
      relPaths.includes('src/utils/helper.ts'),
      'should include src/utils/helper.ts',
    );
    assert.equal(results.length, 2, `expected 2 files, got: ${relPaths.join(', ')}`);
  });

  test('ignored directories are not traversed', () => {
    const results = collectFiles(tmpDir);
    const relPaths = results.map((f) =>
      path.relative(tmpDir, f.path).replace(/\\/g, '/'),
    );

    const ignored = ['node_modules', '.git', 'dist', '.gemini-mcp', '.tmptest'];
    for (const dir of ignored) {
      const leaked = relPaths.find((p) => p.startsWith(dir + '/'));
      assert.equal(
        leaked,
        undefined,
        `file from ignored dir "${dir}" should not appear: ${leaked}`,
      );
    }
  });

  test('byte sizes match actual file sizes', () => {
    const results = collectFiles(tmpDir);

    const indexEntry = results.find((f) => f.path.endsWith('index.ts'));
    const helperEntry = results.find((f) => f.path.endsWith('helper.ts'));

    assert.ok(indexEntry, 'index.ts entry missing');
    assert.ok(helperEntry, 'helper.ts entry missing');

    assert.equal(indexEntry!.bytes, 10, 'index.ts should be 10 bytes');
    assert.equal(helperEntry!.bytes, 20, 'helper.ts should be 20 bytes');
  });

  test('rejects a root that escapes process.cwd()', () => {
    // Use an absolute path that is guaranteed to be outside the project root.
    // /etc is present on all Linux/macOS systems used in CI and is never under
    // any reasonable project root.
    const outsideRoot = '/etc';
    assert.throws(
      () => collectFiles(outsideRoot),
      /outside the working directory/,
    );
  });
});
