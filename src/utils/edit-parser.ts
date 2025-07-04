import { EditSuggestion } from '../types/tool-behavior.js';

/**
 * Helper function to parse suggested edits from Gemini's output
 */
export function parseSuggestedEdits(response: string): string {
  const editPattern = /\[SUGGESTED_EDIT_START\](.*?)\[SUGGESTED_EDIT_END\]/gs;
  const edits: EditSuggestion[] = [];
  let match;
  
  while ((match = editPattern.exec(response)) !== null) {
    const editBlock = match[1];
    const fileMatch = /FILE:\s*(.+?)[\r\n]/.exec(editBlock);
    const changeMatch = /CHANGE:\s*(.+?)[\r\n]/.exec(editBlock);
    
    // Enhanced regex patterns to handle code blocks with ``` markers
    let oldMatch = /OLD:\s*\n```[^\n]*\n(.*?)\n```/s.exec(editBlock);
    if (!oldMatch) {
      oldMatch = /OLD:\s*\n(.*?)\nNEW:/s.exec(editBlock);
    }
    
    let newMatch = /NEW:\s*\n```[^\n]*\n(.*?)\n```/s.exec(editBlock);
    if (!newMatch) {
      newMatch = /NEW:\s*\n(.*?)$/s.exec(editBlock);
    }
    
    if (fileMatch && oldMatch && newMatch) {
      edits.push({
        file: fileMatch[1].trim(),
        change: changeMatch ? changeMatch[1].trim() : "Update code",
        old: oldMatch[1],
        new: newMatch[1],
      });
    }
  }
  
  if (edits.length > 0) {
    // Format edits for Claude
    let formattedOutput = "📝 **Suggested Edits:**\n\n";
    edits.forEach((edit, index) => {
      formattedOutput += `**Edit ${index + 1}:** ${edit.change}\n`;
      formattedOutput += `File: \`${edit.file}\`\n\n`;
      formattedOutput += "```\n";
      formattedOutput += `OLD:\n${edit.old}\n\n`;
      formattedOutput += `NEW:\n${edit.new}\n`;
      formattedOutput += "```\n\n";
    });
    formattedOutput += "💡 **To apply these changes:** Use Claude's Edit tool with the old/new content shown above.\n";
    formattedOutput += "⚠️ **Note:** The OLD content must match EXACTLY (including whitespace and indentation) for the edit to work.";
    return formattedOutput;
  }
  
  // If no structured edits found, return original response
  return response;
}