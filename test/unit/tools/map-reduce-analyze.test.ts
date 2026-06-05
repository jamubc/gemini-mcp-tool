import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
// Importing the tools index registers every tool in the shared registry.
import {
  getToolDefinitions,
  toolExists,
} from '../../../src/tools/index.js';

describe('MCP Tool: map-reduce-analyze registry', () => {
  test('map-reduce-analyze is registered', () => {
    assert.equal(toolExists('map-reduce-analyze'), true);
  });

  test('map-reduce-analyze has a valid JSON-schema definition', () => {
    const defs = getToolDefinitions();
    const def = defs.find((d) => d.name === 'map-reduce-analyze');
    assert.ok(def, 'tool definition not found');
    assert.equal(def!.inputSchema.type, 'object');
    assert.ok(
      typeof def!.inputSchema.properties === 'object',
      'inputSchema must have properties',
    );
  });

  test('map-reduce-analyze schema requires "prompt"', () => {
    const defs = getToolDefinitions();
    const def = defs.find((d) => d.name === 'map-reduce-analyze');
    assert.ok(def, 'tool definition not found');
    const required = def!.inputSchema.required as string[];
    assert.ok(
      required.includes('prompt'),
      `"prompt" must be in required, got: ${JSON.stringify(required)}`,
    );
  });

  test('map-reduce-analyze schema has optional fields: paths, concurrency, shardBytes', () => {
    const defs = getToolDefinitions();
    const def = defs.find((d) => d.name === 'map-reduce-analyze');
    assert.ok(def, 'tool definition not found');

    const props = def!.inputSchema.properties as Record<string, unknown>;
    assert.ok('paths' in props, 'schema should have "paths" property');
    assert.ok('concurrency' in props, 'schema should have "concurrency" property');
    assert.ok('shardBytes' in props, 'schema should have "shardBytes" property');

    const required = def!.inputSchema.required as string[];
    assert.ok(!required.includes('paths'), '"paths" should be optional');
    assert.ok(!required.includes('concurrency'), '"concurrency" should be optional');
    assert.ok(!required.includes('shardBytes'), '"shardBytes" should be optional');
  });

  test('map-reduce-analyze rejects missing prompt via executeTool', async () => {
    const { executeTool } = await import('../../../src/tools/index.js');
    await assert.rejects(
      () => executeTool('map-reduce-analyze', {}),
      /Invalid arguments for map-reduce-analyze.*prompt/s,
    );
  });

  test('map-reduce-analyze returns ❌ for a path escaping cwd', async () => {
    const { executeTool } = await import('../../../src/tools/index.js');
    const result = await executeTool('map-reduce-analyze', {
      prompt: 'test',
      paths: '/etc',
    });
    assert.match(result, /❌/);
    assert.match(result, /outside the project directory/);
  });
});
