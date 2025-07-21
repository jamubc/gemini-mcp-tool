// Template for adding a new MCP tool
// Replace {{TOOL_NAME}} with your tool name (e.g., "calculator", "weather")
// Replace {{DESCRIPTION}} with your tool description

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const {{TOOL_NAME}}Tool: Tool = {
  name: '{{TOOL_NAME}}',
  description: '{{DESCRIPTION}}',
  inputSchema: {
    type: 'object',
    properties: {
      // Add your input parameters here
      // Example:
      // input: {
      //   type: 'string',
      //   description: 'The input to process'
      // }
    },
    required: [
      // List required parameters here
    ]
  }
};

export async function handle{{TOOL_NAME}}(args: any) {
  try {
    // Implement your tool logic here
    
    return {
      content: [
        {
          type: 'text',
          text: `{{TOOL_NAME}} result: ${JSON.stringify(args)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error in {{TOOL_NAME}}: ${error.message}`
        }
      ],
      isError: true
    };
  }
}