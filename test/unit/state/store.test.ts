import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { MemoryStore, JsonFileStore } from '../../../src/state/store.js';

// ---------------------------------------------------------------------------
// MemoryStore
// ---------------------------------------------------------------------------

describe('MemoryStore', () => {
  test('set and get round-trip', () => {
    const store = new MemoryStore();
    store.set('key1', { hello: 'world' });
    assert.deepEqual(store.get('key1'), { hello: 'world' });
  });

  test('get returns undefined for missing key', () => {
    const store = new MemoryStore();
    assert.equal(store.get('nope'), undefined);
  });

  test('delete removes a key', () => {
    const store = new MemoryStore();
    store.set('k', 42);
    store.delete('k');
    assert.equal(store.get('k'), undefined);
  });

  test('keys() returns all set keys', () => {
    const store = new MemoryStore();
    store.set('a', 1);
    store.set('b', 2);
    store.set('c', 3);
    const ks = store.keys().sort();
    assert.deepEqual(ks, ['a', 'b', 'c']);
  });

  test('key validation rejects empty string', () => {
    const store = new MemoryStore();
    assert.throws(() => store.set('', 1), /Invalid state key/);
  });

  test('key validation rejects path traversal sequences', () => {
    const store = new MemoryStore();
    assert.throws(() => store.set('../x', 1), /Invalid state key/);
    assert.throws(() => store.get('../x'), /Invalid state key/);
  });

  test('key validation rejects absolute paths', () => {
    const store = new MemoryStore();
    assert.throws(() => store.set('/etc/passwd', 1), /Invalid state key/);
  });

  test('key validation rejects keys with slashes', () => {
    const store = new MemoryStore();
    assert.throws(() => store.set('a/b', 1), /Invalid state key/);
  });

  test('key validation allows valid characters', () => {
    const store = new MemoryStore();
    assert.doesNotThrow(() => store.set('valid-key.123_abc', true));
  });
});

// ---------------------------------------------------------------------------
// JsonFileStore
// ---------------------------------------------------------------------------

describe('JsonFileStore', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmcp-state-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('set creates directory lazily and persists a value', () => {
    const dir = path.join(tmpDir, 'lazy');
    const store = new JsonFileStore(dir);
    assert.equal(fs.existsSync(dir), false, 'dir should not exist yet');
    store.set('greeting', 'hello');
    assert.equal(fs.existsSync(dir), true, 'dir should now exist');
  });

  test('get retrieves the stored value', () => {
    const dir = path.join(tmpDir, 'get-test');
    const store = new JsonFileStore(dir);
    store.set('num', 42);
    assert.equal(store.get<number>('num'), 42);
  });

  test('get returns undefined for missing key', () => {
    const dir = path.join(tmpDir, 'missing');
    const store = new JsonFileStore(dir);
    assert.equal(store.get('absent'), undefined);
  });

  test('persistence across a fresh instance', () => {
    const dir = path.join(tmpDir, 'persist');
    const store1 = new JsonFileStore(dir);
    store1.set('data', { count: 7 });

    // New instance, same dir
    const store2 = new JsonFileStore(dir);
    assert.deepEqual(store2.get('data'), { count: 7 });
  });

  test('delete removes the key', () => {
    const dir = path.join(tmpDir, 'del');
    const store = new JsonFileStore(dir);
    store.set('gone', 'yes');
    store.delete('gone');
    assert.equal(store.get('gone'), undefined);
  });

  test('delete is a no-op for non-existent key', () => {
    const dir = path.join(tmpDir, 'del-noop');
    const store = new JsonFileStore(dir);
    assert.doesNotThrow(() => store.delete('phantom'));
  });

  test('keys() lists all persisted keys', () => {
    const dir = path.join(tmpDir, 'keys-list');
    const store = new JsonFileStore(dir);
    store.set('x', 1);
    store.set('y', 2);
    store.set('z', 3);
    const ks = store.keys().sort();
    assert.deepEqual(ks, ['x', 'y', 'z']);
  });

  test('keys() returns empty array when dir does not exist', () => {
    const dir = path.join(tmpDir, 'no-dir-yet');
    const store = new JsonFileStore(dir);
    assert.deepEqual(store.keys(), []);
  });

  test('key validation rejects "../x"', () => {
    const dir = path.join(tmpDir, 'traversal');
    const store = new JsonFileStore(dir);
    assert.throws(() => store.set('../x', 1), /Invalid state key/);
  });

  test('key validation rejects absolute paths', () => {
    const dir = path.join(tmpDir, 'abs');
    const store = new JsonFileStore(dir);
    assert.throws(() => store.set('/etc/passwd', 1), /Invalid state key/);
  });

  test('key validation rejects empty string', () => {
    const dir = path.join(tmpDir, 'empty-key');
    const store = new JsonFileStore(dir);
    assert.throws(() => store.set('', 1), /Invalid state key/);
  });

  test('key validation rejects keys with slashes', () => {
    const dir = path.join(tmpDir, 'slash-key');
    const store = new JsonFileStore(dir);
    assert.throws(() => store.set('a/b', 1), /Invalid state key/);
  });

  test('GEMINI_MCP_STATE_DIR env var is used when no dir arg provided', () => {
    const dir = path.join(tmpDir, 'env-dir');
    const oldVal = process.env['GEMINI_MCP_STATE_DIR'];
    process.env['GEMINI_MCP_STATE_DIR'] = dir;
    try {
      const store = new JsonFileStore();
      store.set('env-key', 'env-val');
      assert.equal(store.get<string>('env-key'), 'env-val');
      assert.equal(fs.existsSync(dir), true);
    } finally {
      if (oldVal === undefined) {
        delete process.env['GEMINI_MCP_STATE_DIR'];
      } else {
        process.env['GEMINI_MCP_STATE_DIR'] = oldVal;
      }
    }
  });
});
