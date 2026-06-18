import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  quoteForCmd,
  resolveCommandForExecution,
  buildEnoentErrorMessage,
  selectWindowsGeminiCandidate,
  executeCommand,
} from "../../../src/utils/commandExecutor.js";

describe("Node Utilities: Command Executor & Quoting", () => {
  test("quoteForCmd wraps in double quotes and doubles embedded quotes", () => {
    assert.equal(quoteForCmd("hello"), '"hello"');
    assert.equal(quoteForCmd("a&calc"), '"a&calc"'); // cmd metachar made inert by quoting
    assert.equal(quoteForCmd('a"b'), '"a""b"');
  });

  test("quoteForCmd doubles a trailing backslash so it can't escape the closing quote", () => {
    assert.equal(quoteForCmd("path\\"), '"path\\\\"');
  });

  test("resolveCommandForExecution is a no-op off Windows", () => {
    if (process.platform !== "win32") {
      assert.equal(resolveCommandForExecution("gemini"), "gemini");
      assert.equal(resolveCommandForExecution("echo"), "echo");
    } else {
      // On Windows it should at least never return an empty string.
      assert.ok(resolveCommandForExecution("gemini").length > 0);
    }
  });

  test("selectWindowsGeminiCandidate ignores unsupported PowerShell and extensionless shims", () => {
    assert.equal(
      selectWindowsGeminiCandidate([
        "C:\\Users\\jam\\AppData\\Roaming\\npm\\gemini",
        "C:\\Users\\jam\\AppData\\Roaming\\npm\\gemini.ps1",
      ]),
      "gemini.cmd",
    );
    assert.equal(
      selectWindowsGeminiCandidate([
        "C:\\Users\\jam\\AppData\\Roaming\\npm\\gemini",
        "C:\\Users\\jam\\AppData\\Roaming\\npm\\gemini.cmd",
        "C:\\Users\\jam\\AppData\\Roaming\\npm\\gemini.ps1",
      ]),
      "C:\\Users\\jam\\AppData\\Roaming\\npm\\gemini.cmd",
    );
  });

  test("buildEnoentErrorMessage gives gemini retirement + migration guidance", () => {
    const msg = buildEnoentErrorMessage("gemini");
    assert.match(msg, /Could not find the "gemini"/);
    assert.match(msg, /2026-06-18/); // retirement date
    assert.match(msg, /Antigravity|agy/i); // points at the successor
    assert.match(msg, /GEMINI_CLI_PATH/); // override still offered for unaffected tiers
    assert.doesNotMatch(msg, /npm install -g @google\/gemini-cli/); // dead advice removed
    assert.match(msg, process.platform === "win32" ? /where gemini/ : /which gemini/);
  });

  test("buildEnoentErrorMessage points agy users to install + the gemini fallback env", () => {
    const msg = buildEnoentErrorMessage("agy");
    assert.match(msg, /Could not find the "agy"/);
    assert.match(msg, /AGY_CLI_PATH/);
    assert.match(msg, /GEMINI_MCP_BACKEND/); // how enterprise stays on gemini
    assert.doesNotMatch(msg, /@google\/gemini-cli/);
  });

  test("executeCommand kills and rejects a child that outlives the timeout", async () => {
    // A child that would run for 30s, bounded to 200ms. Without the timeout a
    // hung CLI would leave this promise (and the agy queue) pending forever.
    await assert.rejects(
      executeCommand(
        process.execPath,
        ["-e", "setTimeout(() => {}, 30000)"],
        undefined,
        undefined,
        200,
      ),
      /timed out after/,
    );
  });

  test("executeCommand resolves trimmed stdout well within the default timeout", async () => {
    const out = await executeCommand(process.execPath, ["-e", "console.log('  ok  ')"]);
    assert.equal(out, "ok");
  });

  test("executeCommand surfaces stderr when a clean exit produced no stdout", async () => {
    // agy hits its quota: exit 0, empty stdout, the reason on stderr. The real
    // message must reach the caller, not a silent "".
    await assert.rejects(
      executeCommand(process.execPath, [
        "-e",
        "process.stderr.write('Individual quota reached'); process.exit(0)",
      ]),
      /Individual quota reached/,
    );
  });

  test("executeCommand resolves stdout even when the child also writes to stderr", async () => {
    const out = await executeCommand(process.execPath, [
      "-e",
      "process.stderr.write('a warning'); console.log('answer')",
    ]);
    assert.equal(out, "answer");
  });
});
