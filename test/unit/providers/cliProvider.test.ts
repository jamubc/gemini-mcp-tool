import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CliProvider } from '../../../src/providers/cliProvider.js';
import type { ProviderRequest } from '../../../src/providers/types.js';

describe('CliProvider', () => {
  test('forwards all request fields to the injected executor', async () => {
    const received: ProviderRequest[] = [];

    const fakeExecutor = async (req: ProviderRequest): Promise<string> => {
      received.push(req);
      return 'fake response';
    };

    const provider = new CliProvider(fakeExecutor);

    const req: ProviderRequest = {
      prompt: 'explain @src/index.ts',
      model: 'gemini-2.5-flash',
      sandbox: true,
      changeMode: false,
      onProgress: () => {},
    };

    const result = await provider.run(req);

    assert.equal(result, 'fake response');
    assert.equal(received.length, 1);
    assert.strictEqual(received[0], req, 'executor must receive the exact request object');
    assert.equal(received[0].prompt, req.prompt);
    assert.equal(received[0].model, req.model);
    assert.equal(received[0].sandbox, true);
    assert.equal(received[0].changeMode, false);
    assert.strictEqual(received[0].onProgress, req.onProgress);
  });

  test('provider id is "cli"', () => {
    const provider = new CliProvider(async () => '');
    assert.equal(provider.id, 'cli');
  });

  test('executor return value is passed through unchanged', async () => {
    const expected = 'some multiline\ngemini output here';
    const provider = new CliProvider(async () => expected);
    const result = await provider.run({ prompt: 'test' });
    assert.equal(result, expected);
  });

  test('executor rejection propagates as-is', async () => {
    const provider = new CliProvider(async () => {
      throw new Error('executor failure');
    });
    await assert.rejects(() => provider.run({ prompt: 'test' }), /executor failure/);
  });

  test('minimal request (prompt only) is forwarded without adding defaults', async () => {
    const received: ProviderRequest[] = [];
    const provider = new CliProvider(async (req) => {
      received.push(req);
      return '';
    });

    await provider.run({ prompt: 'minimal' });
    assert.equal(received[0].model, undefined);
    assert.equal(received[0].sandbox, undefined);
    assert.equal(received[0].changeMode, undefined);
    assert.equal(received[0].onProgress, undefined);
  });
});
