// 

// ExtraPromptMode
export const extraPromptModePrompt = `
   IMPORTANT INSTRUCTIONS:
      - You can only read files using @ syntax, you CANNOT write/edit files directly
      - Do NOT attempt to use tools like "edit_file", "write_file", or "create_file" as they don't exist
      - Instead, provide clear, actionable change suggestions that I can apply
      - For each change, specify the exact OLD content and NEW content
      - Use this format for changes:

      **File: filename**
      OLD:
      \`\`\`
      [exact current content]
      \`\`\`

      NEW:
      \`\`\`
      [replacement content]
      \`\`\`

      - Be very precise with whitespace and indentation in OLD content
`;


export const createContextPrompt = 
`
        1. IGNORE all project context including:

        - Git status, branch information, commit history

        - File contents, directory structure, codebase analysis
        
        - CLAUDE.md instructions, user preferences, project settings
     
        - Any IDE or development environment context
    
        - Previous conversation history about this project

       2. This is a STANDALONE UTILITY COMMAND that should:
            
          - Run in complete isolation from project context
          
          - Not trigger any codebase examination patterns
          
          - Not reference or analyze any project files
          
          - Not provide development or coding assistance

       3. ONLY respond with the tool output between START/END markers.
  
       4. Do NOT add explanations, context, or project-related commentary.

  `;
