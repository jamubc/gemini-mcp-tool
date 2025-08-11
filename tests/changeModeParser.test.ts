import { describe, it, expect } from 'vitest';
import { parseChangeModeOutput } from '../src/utils/changeModeParser.js';

describe('parseChangeModeOutput', () => {
  it('parses /old/ and /new/ formatted responses', () => {
    const response = `/old/ * src/index.ts 'start:' 1\nconsole.log('old');\n// 'end:' 1\n\n/new/ * src/index.ts 'start:' 1\nconsole.log('new');\n// 'end:' 1`;
    const edits = parseChangeModeOutput(response);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      filename: 'src/index.ts',
      oldCode: "console.log('old');",
      newCode: "console.log('new');",
      oldStartLine: 1,
      oldEndLine: 1,
      newStartLine: 1,
      newEndLine: 1,
    });
  });
});
