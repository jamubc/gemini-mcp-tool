export interface ChangeModeEdit {
  filename: string;
  oldStartLine: number;
  oldEndLine: number;
  oldCode: string;
  newStartLine: number;
  newEndLine: number;
  newCode: string;
}
export function parseChangeModeOutput(geminiResponse: string): ChangeModeEdit[] {
  const edits: ChangeModeEdit[] = [];
  const markdownPattern = /\*\*FILE:\s*(.+?):(\d+)\*\*\s*\n```\s*\nOLD:\s*\n([\s\S]*?)\nNEW:\s*\n([\s\S]*?)\n```/g;

  let match;
  while ((match = markdownPattern.exec(geminiResponse)) !== null) {
    const [_fullMatch, filename, startLineStr, oldCodeRaw, newCodeRaw] = match;

    const oldCode = oldCodeRaw.trimEnd();
    const newCode = newCodeRaw.trimEnd();
    const startLine = parseInt(startLineStr, 10);

    const oldLineCount = oldCode === '' ? 0 : oldCode.split('\n').length;
    const newLineCount = newCode === '' ? 0 : newCode.split('\n').length;

    const oldEndLine = startLine + (oldLineCount > 0 ? oldLineCount - 1 : 0);

    const newStartLine = startLine;
    const newEndLine = newStartLine + (newLineCount > 0 ? newLineCount - 1 : 0);

    edits.push({
      filename: filename.trim(),
      oldStartLine: startLine,
      oldEndLine: oldEndLine,
      oldCode: oldCode,
      newStartLine: newStartLine,
      newEndLine: newEndLine,
      newCode: newCode,
    });
  }

  if (edits.length === 0) {
    const editPattern = /\/old\/ \* (.+?) 'start:' (\d+)\n([\s\S]*?)\n\/\/ 'end:' (\d+)\s*\n\s*\\new\\ \* (.+?) 'start:' (\d+)\n([\s\S]*?)\n\/\/ 'end:' (\d+)/g;

    while ((match = editPattern.exec(geminiResponse)) !== null) {
      const [
        _fullMatch,
        oldFilename,
        oldStartLine,
        oldCode,
        oldEndLine,
        newFilename,
        newStartLine,
        newCode,
        newEndLine,
      ] = match;

      if (oldFilename !== newFilename) {
        console.warn(`[changeModeParser] Filename mismatch: ${oldFilename} vs ${newFilename}`);
        continue;
      }

      edits.push({
        filename: oldFilename.trim(),
        oldStartLine: parseInt(oldStartLine, 10),
        oldEndLine: parseInt(oldEndLine, 10),
        oldCode: oldCode.trimEnd(),
        newStartLine: parseInt(newStartLine, 10),
        newEndLine: parseInt(newEndLine, 10),
        newCode: newCode.trimEnd(),
      });
    }
  }

  return edits;
}
export function validateChangeModeEdits(edits: ChangeModeEdit[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const edit of edits) {
    if (!edit.filename) {
      errors.push('Edit missing filename');
    }

    if (edit.oldStartLine > edit.oldEndLine) {
      errors.push(`Invalid line range for ${edit.filename}: ${edit.oldStartLine} > ${edit.oldEndLine}`);
    }

    if (edit.newStartLine > edit.newEndLine) {
      errors.push(`Invalid new line range for ${edit.filename}: ${edit.newStartLine} > ${edit.newEndLine}`);
    }

    if (!edit.oldCode && !edit.newCode) {
      errors.push(`Empty edit for ${edit.filename}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}