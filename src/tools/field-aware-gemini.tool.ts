import { BaseTool } from './base-tool.js';
import { StrictMode } from '../types/strict-mode.js';
import { StandardizedResponseSections } from '../utils/structured-response.js';

/**
 * Field-Aware Gemini Tool
 * Implements proper context boundaries using Context-Engineering principles
 * Enables direct file-to-Gemini context passing without Claude intermediation
 */

interface FieldOperation {
  operation: 'analyze' | 'enhance' | 'generate' | 'transform';
  context_boundary: 'direct' | 'mediated' | 'isolated';
  field_integrity: 'preserve' | 'merge' | 'reconstruct';
}

class FieldAwareGeminiTool extends BaseTool {
  name = "field-aware-gemini";
  description = "Direct context field orchestration between Claude and Gemini with proper boundary management. Implements Context-Engineering principles for agent-to-agent communication.";

  constructor() {
    super();
    
    // Configure features for advanced context engineering
    this.configureFeatures({
      strictMode: StrictMode.OFF, // Critical: preserves field boundaries
      contextEngineering: true,
      paretoProtocol: true,
      fileHandling: true,
      sandboxSupport: false,
      promptMode: false,
    });

    // Configure behavior
    this.configureBehavior({
      network: "outbound",
      readsFilesystem: "relative",
      idempotent: false,
    });
  }

  inputSchema = this.buildInputSchema({
    operation: {
      type: "string",
      enum: ["analyze", "enhance", "generate", "transform"],
      description: "Field operation type"
    },
    files: {
      type: "array",
      items: { type: "string" },
      description: "Files to pass as direct context (@ syntax will be applied)"
    },
    task: {
      type: "string", 
      description: "Task description for Gemini"
    },
    context_boundary: {
      type: "string",
      enum: ["direct", "mediated", "isolated"],
      default: "direct",
      description: "Context boundary management mode"
    },
    field_integrity: {
      type: "string",
      enum: ["preserve", "merge", "reconstruct"],
      default: "preserve", 
      description: "Field integrity preservation strategy"
    },
    pareto_protocol: {
      type: "boolean",
      default: false,
      description: "Enable pareto-lang protocol patterns"
    }
  }, ["operation", "task"]);

  protected async preExecute(args: any): Promise<void> {
    // Validate required fields
    this.validateRequired(args, ["operation", "task"]);
  }

  protected async doExecute(args: any): Promise<any> {
    const { operation, files = [], task, context_boundary = "direct", field_integrity = "preserve", pareto_protocol = false } = args;

    console.warn(`[Field-Aware Gemini] Executing ${operation} with ${context_boundary} context boundary`);

    // Build field-aware prompt using Context-Engineering patterns
    const fieldPrompt = this.buildFieldAwarePrompt({
      operation,
      files,
      task,
      context_boundary,
      field_integrity,
      pareto_protocol
    });

    // Execute with proper field boundaries (OFF mode preserves Gemini's context integrity)
    const result = await this.executeGemini(fieldPrompt, args, StrictMode.OFF);

    // Return result with operation details for response formatting
    return { result, operation, args };
  }

  protected buildResponseSections(data: any, _args: any): StandardizedResponseSections {
    const { result, operation, args } = data;
    const { files = [], task, context_boundary = "direct", field_integrity = "preserve", pareto_protocol = false } = args;
    
    // Build analysis
    const analysis = `Executed ${operation} operation with ${context_boundary} context boundary. ` +
      `${files.length > 0 ? `Processed ${files.length} file(s) as direct context. ` : 'No files provided as context. '}` +
      `${pareto_protocol ? 'Used pareto-lang protocol for structured communication.' : 'Used standard Context-Engineering approach.'}`;
    
    // Build next steps based on operation
    let nextSteps = '';
    switch (operation) {
      case 'analyze':
        nextSteps = 'Review the analysis results. Consider using enhance or transform operations to modify the content based on insights.';
        break;
      case 'enhance':
        nextSteps = 'Review the enhanced content. The original field integrity was ' + 
          (field_integrity === 'preserve' ? 'preserved' : 'modified') + 
          '. You may need to integrate these enhancements back into your source files.';
        break;
      case 'generate':
        nextSteps = 'Review the generated content. Consider where to place this new content in your project structure.';
        break;
      case 'transform':
        nextSteps = 'Review the transformed content. Ensure the transformation meets your requirements before replacing the original.';
        break;
      default:
        nextSteps = 'Review the operation results and determine next actions based on your workflow.';
    }
    
    return {
      analysis,
      updatedContent: result,
      nextSteps
    };
  }

  protected getMetadata(_result: any): any {
    const { operation, args } = _result;
    const { files = [], context_boundary, field_integrity, pareto_protocol } = args;
    
    return {
      status: 'success',
      operation,
      context_boundary,
      field_integrity,
      files_processed: files.length,
      protocol: pareto_protocol ? 'pareto-lang' : 'context-engineering'
    };
  }

  private buildFieldAwarePrompt(config: any): string {
    const { operation, files, task, context_boundary, field_integrity, pareto_protocol } = config;
    
    if (pareto_protocol) {
      return this.buildParetoProtocolPrompt(config);
    }

    // Standard Context-Engineering approach
    const fileContext = files.length > 0 ? files.map((file: string) => `@${file}`).join(' ') : '';
    
    switch (context_boundary) {
      case 'direct':
        // Direct field access - Gemini receives files as native context
        return `${fileContext} ${task}`;
        
      case 'mediated':
        // Mediated field access - structured handoff
        return `Context: ${fileContext}
Task: ${task}
Field Integrity: ${field_integrity}
Operation: ${operation}

Please process the provided context and complete the requested task.`;
        
      case 'isolated':
        // Isolated field - explicit boundary markers
        return `=== CONTEXT FIELD BOUNDARY ===
Files: ${fileContext}
Task: ${task}
Boundary Mode: Isolated
Operation: ${operation}

Process the context within this isolated field boundary and provide results.
=== END CONTEXT FIELD ===`;
        
      default:
        return `${fileContext} ${task}`;
    }
  }

  private buildParetoProtocolPrompt(config: any): string {
    const { operation, files, task, context_boundary, field_integrity } = config;
    
    // Implement pareto-lang protocol patterns
    return `/${operation}.${context_boundary}{
    target="file_context",
    files=[${files.map((f: string) => `"@${f}"`).join(', ')}],
    task="${task}",
    field_integrity="${field_integrity}",
    context_boundary="${context_boundary}",
    protocol="context_engineering_v1",
    output_format="structured"
}`;
  }
}

// Export behavior for backward compatibility
export const behavior = {
  idempotent: false,
  readsFilesystem: "relative",
  writesFilesystem: false,
  network: "outbound",
} as const;

// Create and export singleton instance
const fieldAwareGeminiTool = new FieldAwareGeminiTool();
export default fieldAwareGeminiTool;