import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertSafeFileReferences,
  buildChangeModePrompt,
  inlineFileReferences,
  prepareChangeModePrompt,
} from "../../../src/utils/geminiExecutor.js";

const root = process.cwd();

describe("Node Utilities: Gemini CLI Executor", () => {
  test("assertSafeFileReferences allows in-project @file references", () => {
    assert.doesNotThrow(() => assertSafeFileReferences("explain @src/index.ts", root));
    assert.doesNotThrow(() => assertSafeFileReferences("no references at all", root));
    assert.doesNotThrow(() => assertSafeFileReferences("@package.json summarise", root));
  });

  test("assertSafeFileReferences rejects traversal, home, and absolute references", () => {
    assert.throws(() => assertSafeFileReferences("@../secret.txt", root), /outside the project directory/);
    assert.throws(() => assertSafeFileReferences("@~/.ssh/id_rsa", root), /outside the project directory/);
    assert.throws(() => assertSafeFileReferences("@/etc/passwd", root), /outside the project directory/);
  });

  test("buildChangeModePrompt wraps the request in the OLD/NEW template", () => {
    const out = buildChangeModePrompt("do the thing");
    assert.match(out, /\[CHANGEMODE INSTRUCTIONS\]/);
    assert.match(out, /USER REQUEST:\ndo the thing/);
  });

  test("prepareChangeModePrompt rewrites file: refs to @ refs before wrapping", () => {
    const out = prepareChangeModePrompt("update file:src/index.ts please");
    assert.match(out, /\[CHANGEMODE INSTRUCTIONS\]/);
    assert.match(out, /@src\/index\.ts/);
    assert.doesNotMatch(out, /file:src\/index\.ts/);
  });

  test(
    "assertSafeFileReferences blocks an in-root symlink whose target escapes the root",
    { skip: process.platform === "win32" }, // symlink creation needs privileges on Windows
    () => {
      const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "gem-root-")));
      const outside = realpathSync(mkdtempSync(path.join(os.tmpdir(), "gem-secret-")));
      try {
        const secret = path.join(outside, "secret.txt");
        writeFileSync(secret, "TOPSECRET");
        symlinkSync(secret, path.join(dir, "link.txt"));
        // Lexically in-root, but resolves outside — the gemini CLI would inline
        // it, so the guard itself must refuse (CVE-2026-0755).
        assert.throws(
          () => assertSafeFileReferences("read @link.txt", dir),
          /outside the project directory/,
        );
        // A regular in-root file is still fine.
        writeFileSync(path.join(dir, "ok.txt"), "fine");
        assert.doesNotThrow(() => assertSafeFileReferences("read @ok.txt", dir));
      } finally {
        rmSync(dir, { recursive: true, force: true });
        rmSync(outside, { recursive: true, force: true });
      }
    },
  );

  test("inlineFileReferences replaces in-project refs with file contents", () => {
    const out = inlineFileReferences("see @package.json", root);
    assert.match(out, /BEGIN FILE: package\.json/);
    assert.match(out, /gemini-mcp-tool/);
    assert.doesNotMatch(out, /@package\.json/);
  });

  test("inlineFileReferences enforces the same project-root guard before reading", () => {
    assert.throws(() => inlineFileReferences("@/etc/passwd", root), /outside the project directory/);
  });

  test("inlineFileReferences marks missing files instead of leaking the token", () => {
    const out = inlineFileReferences("@does-not-exist.txt", root);
    assert.match(out, /FILE NOT FOUND: does-not-exist\.txt/);
  });

  test(
    "inlineFileReferences blocks an in-root symlink whose target escapes the root",
    { skip: process.platform === "win32" }, // symlink creation needs privileges on Windows
    () => {
      // realpath the temp roots so the guard's lexical normalizedRoot matches
      // the symlink target's canonical path (macOS /var -> /private/var).
      const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "agy-root-")));
      const outside = realpathSync(mkdtempSync(path.join(os.tmpdir(), "agy-secret-")));
      try {
        const secret = path.join(outside, "secret.txt");
        writeFileSync(secret, "TOPSECRET");
        symlinkSync(secret, path.join(dir, "link.txt"));
        // Lexically in-root, but resolves outside — must be refused, not inlined.
        assert.throws(
          () => inlineFileReferences("read @link.txt", dir),
          /outside the project directory/,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
        rmSync(outside, { recursive: true, force: true });
      }
    },
  );
});

