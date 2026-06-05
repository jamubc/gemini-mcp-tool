import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { planShards } from '../../../src/utils/sharding.js';

describe('planShards', () => {
  test('empty input returns an empty array', () => {
    assert.deepEqual(planShards([], 1000), []);
  });

  test('single file that fits in one shard', () => {
    const files = [{ path: 'a.ts', bytes: 500 }];
    const shards = planShards(files, 1000);
    assert.equal(shards.length, 1);
    assert.deepEqual(shards[0].files, files);
  });

  test('partitions files by byte size', () => {
    const files = [
      { path: 'a.ts', bytes: 600 },
      { path: 'b.ts', bytes: 600 },
      { path: 'c.ts', bytes: 600 },
    ];
    // targetBytesPerShard=800 → a+b would exceed (1200>800), so each gets its own shard
    // Actually a alone=600, adding b=1200 > 800 → shard [a], shard [b], adding c: alone=600 ok → shard [c]
    const shards = planShards(files, 800);
    assert.equal(shards.length, 3);
    assert.deepEqual(shards[0].files, [files[0]]);
    assert.deepEqual(shards[1].files, [files[1]]);
    assert.deepEqual(shards[2].files, [files[2]]);
  });

  test('packs multiple small files into one shard when they fit', () => {
    const files = [
      { path: 'a.ts', bytes: 100 },
      { path: 'b.ts', bytes: 100 },
      { path: 'c.ts', bytes: 100 },
    ];
    const shards = planShards(files, 1000);
    assert.equal(shards.length, 1);
    assert.equal(shards[0].files.length, 3);
  });

  test('never splits a file across shards', () => {
    const files = [
      { path: 'small.ts', bytes: 10 },
      { path: 'large.ts', bytes: 900 },
      { path: 'small2.ts', bytes: 10 },
    ];
    // Each file must appear in exactly one shard.
    const shards = planShards(files, 800);
    const allFiles = shards.flatMap((s) => s.files);
    assert.equal(allFiles.length, 3);
    // large.ts must appear exactly once
    const largeCount = allFiles.filter((f) => f.path === 'large.ts').length;
    assert.equal(largeCount, 1);
  });

  test('a single oversize file becomes its own shard', () => {
    const files = [{ path: 'giant.ts', bytes: 5_000_000 }];
    const shards = planShards(files, 800_000);
    assert.equal(shards.length, 1);
    assert.deepEqual(shards[0].files, files);
  });

  test('multiple oversize files each get their own shard', () => {
    const files = [
      { path: 'giant1.ts', bytes: 2_000_000 },
      { path: 'giant2.ts', bytes: 3_000_000 },
    ];
    const shards = planShards(files, 800_000);
    assert.equal(shards.length, 2);
    assert.equal(shards[0].files[0].path, 'giant1.ts');
    assert.equal(shards[1].files[0].path, 'giant2.ts');
  });

  test('stable order: shard file order matches input order', () => {
    const files = [
      { path: 'z.ts', bytes: 100 },
      { path: 'a.ts', bytes: 100 },
      { path: 'm.ts', bytes: 100 },
    ];
    const shards = planShards(files, 1000);
    const allFiles = shards.flatMap((s) => s.files);
    assert.deepEqual(
      allFiles.map((f) => f.path),
      ['z.ts', 'a.ts', 'm.ts'],
    );
  });

  test('maxFilesPerShard caps files per shard', () => {
    const files = [
      { path: 'a.ts', bytes: 10 },
      { path: 'b.ts', bytes: 10 },
      { path: 'c.ts', bytes: 10 },
      { path: 'd.ts', bytes: 10 },
    ];
    // Large target so bytes won't trigger splits — only file cap should.
    const shards = planShards(files, 100_000, 2);
    assert.equal(shards.length, 2);
    assert.equal(shards[0].files.length, 2);
    assert.equal(shards[1].files.length, 2);
  });

  test('bin-packs greedily: fills current shard before opening a new one', () => {
    const files = [
      { path: 'a.ts', bytes: 300 },
      { path: 'b.ts', bytes: 300 },
      { path: 'c.ts', bytes: 300 },
      { path: 'd.ts', bytes: 300 },
    ];
    // 300+300=600 ≤ 700; 600+300=900 > 700 → close; new shard: 300+300=600 ≤ 700
    const shards = planShards(files, 700);
    assert.equal(shards.length, 2);
    assert.equal(shards[0].files.length, 2);
    assert.equal(shards[1].files.length, 2);
  });
});
