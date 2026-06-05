import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { getProvider, resetProviderCache, CliProvider, ApiProvider } from '../../../src/providers/index.js';

const ENV_KEY = 'GEMINI_MCP_PROVIDER';

describe('Provider factory', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
    resetProviderCache();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalEnv;
    }
    resetProviderCache();
  });

  test('default provider is CliProvider with id "cli"', () => {
    const p = getProvider();
    assert.ok(p instanceof CliProvider, 'expected a CliProvider by default');
    assert.equal(p.id, 'cli');
  });

  test('explicit id "cli" returns a CliProvider', () => {
    const p = getProvider('cli');
    assert.ok(p instanceof CliProvider);
    assert.equal(p.id, 'cli');
  });

  test('explicit id "api" returns an ApiProvider', () => {
    const p = getProvider('api');
    assert.ok(p instanceof ApiProvider);
    assert.equal(p.id, 'api');
  });

  test('instances are cached — same id returns same object', () => {
    const a = getProvider('cli');
    const b = getProvider('cli');
    assert.strictEqual(a, b, 'expected the same cached instance');
  });

  test('resetProviderCache causes a fresh instance to be created', () => {
    const a = getProvider('cli');
    resetProviderCache();
    const b = getProvider('cli');
    assert.notStrictEqual(a, b, 'expected a new instance after cache reset');
  });

  test('unknown provider id throws with actionable message', () => {
    assert.throws(
      () => getProvider('unknown' as any),
      /Unknown provider id/,
    );
  });

  test('GEMINI_MCP_PROVIDER env var selects the provider', () => {
    process.env[ENV_KEY] = 'api';
    const p = getProvider();
    assert.ok(p instanceof ApiProvider);
  });

  test('ApiProvider.run throws an actionable error about GEMINI_API_KEY', async () => {
    const p = getProvider('api');
    await assert.rejects(
      () => p.run({ prompt: 'hello' }),
      /GEMINI_API_KEY/,
    );
  });

  test('ApiProvider.run error message mentions "API backend"', async () => {
    const p = getProvider('api');
    let caughtMessage = '';
    try {
      await p.run({ prompt: 'test' });
    } catch (e) {
      caughtMessage = (e as Error).message;
    }
    assert.ok(caughtMessage.includes('API backend'), `message was: ${caughtMessage}`);
  });
});
