import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mapReduce } from '../../../src/utils/mapReduce.js';

describe('mapReduce', () => {
  test('empty shards list: reduceFn receives empty arrays', async () => {
    const { output, errors } = await mapReduce({
      shards: [],
      concurrency: 4,
      mapFn: async () => 'x',
      reduceFn: (results, errs) => ({ results, errs }),
    });
    assert.deepEqual(output.results, []);
    assert.deepEqual(output.errs, []);
    assert.equal(errors.length, 0);
  });

  test('single shard: result is returned at index 0', async () => {
    const { output } = await mapReduce({
      shards: ['hello'],
      concurrency: 1,
      mapFn: async (s) => s.toUpperCase(),
      reduceFn: (results) => results[0],
    });
    assert.equal(output, 'HELLO');
  });

  test('results are aggregated in input order regardless of execution order', async () => {
    // Map function resolves in reverse order via staggered timeouts.
    const shards = [30, 20, 10]; // delay in ms
    const { output } = await mapReduce({
      shards,
      concurrency: 3,
      mapFn: async (delay, i) => {
        await new Promise<void>((res) => setTimeout(res, delay));
        return i; // return the shard index as the result
      },
      reduceFn: (results) => results as number[],
    });
    assert.deepEqual(output, [0, 1, 2]);
  });

  test('concurrency is never exceeded', async () => {
    let inFlight = 0;
    let maxObserved = 0;
    const concurrency = 3;
    const shardCount = 10;

    await mapReduce({
      shards: Array.from({ length: shardCount }, (_, i) => i),
      concurrency,
      mapFn: async () => {
        inFlight++;
        maxObserved = Math.max(maxObserved, inFlight);
        await new Promise<void>((res) => setTimeout(res, 5));
        inFlight--;
        return 1;
      },
      reduceFn: (results) => results,
    });

    assert.ok(
      maxObserved <= concurrency,
      `Expected max in-flight ≤ ${concurrency}, got ${maxObserved}`,
    );
    // Also verify concurrency was actually utilised when possible.
    assert.ok(
      maxObserved >= Math.min(concurrency, shardCount),
      `Expected concurrency ${concurrency} to be saturated`,
    );
  });

  test('a rejecting shard is captured as an error and does not abort others', async () => {
    const shards = [0, 1, 2, 3, 4];

    const { output, errors } = await mapReduce({
      shards,
      concurrency: 2,
      mapFn: async (v) => {
        if (v === 2) throw new Error(`shard-${v}-failed`);
        return v * 10;
      },
      reduceFn: (results, errs) => ({ results, errs }),
    });

    // The failing shard at index 2 should be undefined in results.
    assert.equal(output.results[2], undefined);

    // All other shards should have been processed.
    assert.equal(output.results[0], 0);
    assert.equal(output.results[1], 10);
    assert.equal(output.results[3], 30);
    assert.equal(output.results[4], 40);

    // Exactly one error, for shard index 2.
    assert.equal(errors.length, 1);
    assert.equal(errors[0].index, 2);
    assert.ok(errors[0].error instanceof Error);
    assert.match((errors[0].error as Error).message, /shard-2-failed/);
  });

  test('multiple rejecting shards are all captured', async () => {
    const shards = [0, 1, 2];

    const { errors } = await mapReduce({
      shards,
      concurrency: 3,
      mapFn: async (v) => {
        throw new Error(`fail-${v}`);
      },
      reduceFn: (_results, errs) => errs,
    });

    assert.equal(errors.length, 3);
    const failedIndices = errors.map((e) => e.index).sort((a, b) => a - b);
    assert.deepEqual(failedIndices, [0, 1, 2]);
  });

  test('concurrency=1 processes shards serially', async () => {
    const order: number[] = [];

    await mapReduce({
      shards: [0, 1, 2, 3],
      concurrency: 1,
      mapFn: async (v) => {
        order.push(v);
        return v;
      },
      reduceFn: (r) => r,
    });

    assert.deepEqual(order, [0, 1, 2, 3]);
  });

  test('reduceFn receives undefined at failing shard positions', async () => {
    let capturedResults: Array<number | undefined> = [];

    await mapReduce({
      shards: [0, 1, 2],
      concurrency: 3,
      mapFn: async (v) => {
        if (v === 1) throw new Error('boom');
        return v;
      },
      reduceFn: (results) => {
        capturedResults = results as Array<number | undefined>;
        return null;
      },
    });

    assert.equal(capturedResults[0], 0);
    assert.equal(capturedResults[1], undefined); // failed shard
    assert.equal(capturedResults[2], 2);
  });
});
