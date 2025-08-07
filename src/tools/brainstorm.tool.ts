import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { Logger } from '../utils/logger.js';
import { executeGeminiCLI } from '../utils/geminiExecutor.js';

// Constants for better maintainability
const METHODOLOGIES = {
  DIVERGENT: 'divergent',
  CONVERGENT: 'convergent',
  SCAMPER: 'scamper',
  DESIGN_THINKING: 'design-thinking',
  LATERAL: 'lateral',
  AUTO: 'auto'
} as const;

const PROMPT_SECTIONS = {
  HEADER: '# BRAINSTORMING SESSION',
  CHALLENGE: '## Core Challenge',
  METHODOLOGY: '## Methodology Framework',
  CONTEXT: '## Context Engineering',
  OUTPUT: '## Output Requirements',
  ANALYSIS: '## Analysis Framework',
  FORMAT: '## Format'
} as const;

function buildBrainstormPrompt(config: {
  prompt: string;
  methodology: string;
  domain?: string;
  constraints?: string;
  existingContext?: string;
  ideaCount: number;
  includeAnalysis: boolean;
}): string {
  const { prompt, methodology, domain, constraints, existingContext, ideaCount, includeAnalysis } = config;
  
  // Select methodology framework
  let frameworkInstructions = getMethodologyInstructions(methodology, domain);
  
  let enhancedPrompt = `${PROMPT_SECTIONS.HEADER}

${PROMPT_SECTIONS.CHALLENGE}
${prompt}

${PROMPT_SECTIONS.METHODOLOGY}
${frameworkInstructions}

${PROMPT_SECTIONS.CONTEXT}
*Use the following context to inform your reasoning:*
${domain ? `**Domain Focus:** ${domain} - Apply domain-specific knowledge, terminology, and best practices.` : ''}
${constraints ? `**Constraints & Boundaries:** ${constraints}` : ''}
${existingContext ? `**Background Context:** ${existingContext}` : ''}

${PROMPT_SECTIONS.OUTPUT}
- Generate ${ideaCount} distinct, creative ideas
- Each idea should be unique and non-obvious
- Focus on actionable, implementable concepts
- Use clear, descriptive naming
- Provide brief explanations for each idea

${includeAnalysis ? `
${PROMPT_SECTIONS.ANALYSIS}
For each idea, provide:
- **Feasibility:** Implementation difficulty (1-5 scale)
- **Impact:** Potential value/benefit (1-5 scale)
- **Innovation:** Uniqueness/creativity (1-5 scale)
- **Quick Assessment:** One-sentence evaluation
` : ''}

${PROMPT_SECTIONS.FORMAT}
Present ideas in a structured format:

### Idea [N]: [Creative Name]
**Description:** [2-3 sentence explanation]
${includeAnalysis ? '**Feasibility:** [1-5] | **Impact:** [1-5] | **Innovation:** [1-5]\n**Assessment:** [Brief evaluation]' : ''}

---

**Before finalizing, review the list: remove near-duplicates and ensure each idea satisfies the constraints.**

Begin brainstorming session:`;

  return enhancedPrompt;
}

/**
 * Returns methodology-specific instructions for structured brainstorming
 */
function getMethodologyInstructions(methodology: string, domain?: string): string {
  const methodologies: Record<string, string> = {
    [METHODOLOGIES.DIVERGENT]: `**Divergent Thinking Approach:**
- Generate maximum quantity of ideas without self-censoring
- Build on wild or seemingly impractical ideas
- Combine unrelated concepts for unexpected solutions
- Use "Yes, and..." thinking to expand each concept
- Postpone evaluation until all ideas are generated`,

    [METHODOLOGIES.CONVERGENT]: `**Convergent Thinking Approach:**
- Focus on refining and improving existing concepts
- Synthesize related ideas into stronger solutions
- Apply critical evaluation criteria
- Prioritize based on feasibility and impact
- Develop implementation pathways for top ideas`,

    [METHODOLOGIES.SCAMPER]: `**SCAMPER Creative Triggers:**
- **Substitute:** What can be substituted or replaced?
- **Combine:** What can be combined or merged?
- **Adapt:** What can be adapted from other domains?
- **Modify:** What can be magnified, minimized, or altered?
- **Put to other use:** How else can this be used?
- **Eliminate:** What can be removed or simplified?
- **Reverse:** What can be rearranged or reversed?`,

    [METHODOLOGIES.DESIGN_THINKING]: `**Human-Centered Design Thinking:**
- **Empathize:** Consider user needs, pain points, and contexts
- **Define:** Frame problems from user perspective
- **Ideate:** Generate user-focused solutions
- **Consider Journey:** Think through complete user experience
- **Prototype Mindset:** Focus on testable, iterative concepts`,

    [METHODOLOGIES.LATERAL]: `**Lateral Thinking Approach:**
- Make unexpected connections between unrelated fields
- Challenge fundamental assumptions
- Use random word association to trigger new directions
- Apply metaphors and analogies from other domains
- Reverse conventional thinking patterns`,

    [METHODOLOGIES.AUTO]: `**AI-Optimized Approach:**
${domain ? `Given the ${domain} domain, I'll apply the most effective combination of:` : 'I\'ll intelligently combine multiple methodologies:'}
- Divergent exploration with domain-specific knowledge
- SCAMPER triggers and lateral thinking
- Human-centered perspective for practical value`
  };

  return methodologies[methodology] || methodologies[METHODOLOGIES.AUTO];
}

const brainstormArgsSchema = z.object({
  prompt: z.string().trim().min(1).describe("Primary brainstorming challenge or question to explore"),
  model: z.string().optional().describe("Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro)."),
  methodology: z.enum(['divergent', 'convergent', 'scamper', 'design-thinking', 'lateral', 'auto']).default('auto').describe("Brainstorming framework: 'divergent' (generate many ideas), 'convergent' (refine existing), 'scamper' (systematic triggers), 'design-thinking' (human-centered), 'lateral' (unexpected connections), 'auto' (AI selects best)"),
  domain: z.string().optional().describe("Domain context for specialized brainstorming (e.g., 'software', 'business', 'creative', 'research', 'product', 'marketing')"),
  constraints: z.string().optional().describe("Known limitations, requirements, or boundaries (budget, time, technical, legal, etc.)"),
  existingContext: z.string().optional().describe("Background information, previous attempts, or current state to build upon"),
  ideaCount: z.number().int().positive().max(50).default(12).describe("Target number of ideas to generate (default: 12, max: 50)"),
  includeAnalysis: z.boolean().default(true).describe("Include feasibility, impact, and implementation analysis for generated ideas"),
});

export const brainstormTool: UnifiedTool = {
  name: "brainstorm",
  description: "Generate novel ideas with dynamic context gathering. --> Creative frameworks (SCAMPER, Design Thinking, etc.), domain context integration, idea clustering, feasibility analysis, and iterative refinement.",
  zodSchema: brainstormArgsSchema,
  prompt: {
    description: "Generate structured brainstorming prompt with methodology-driven ideation, domain context integration, and analytical evaluation framework",
  },
  category: 'gemini',
  execute: async (args, onProgress) => {
    try {
      // Destructure validated args directly (Zod handles all validation and defaults)
      const {
        prompt,
        model,
        methodology,
        domain,
        constraints,
        existingContext,
        ideaCount,
        includeAnalysis
      } = args;

      // Build enhanced prompt with type-safe parameters (ensure defaults are applied)
      const enhancedPrompt = buildBrainstormPrompt({
        prompt: prompt!, // Zod validation ensures this is defined
        methodology: methodology || 'auto',
        domain,
        constraints,
        existingContext,
        ideaCount: ideaCount || 12,
        includeAnalysis: includeAnalysis !== false
      });

      Logger.debug(`Brainstorm: Using methodology '${methodology}' for domain '${domain || 'general'}'`);
      
      // Report progress with error resilience
      const reportProgress = (message: string) => {
        try {
          onProgress?.(message);
        } catch (progressError) {
          Logger.warn('Progress callback failed:', progressError);
          // Continue execution despite progress callback failure
        }
      };
      
      reportProgress(`🧠 Generating ${ideaCount} ideas via ${methodology} methodology...`);
      
      // Execute with Gemini with comprehensive error handling
      const result = await executeGeminiCLI(
        enhancedPrompt,
        model,
        false,
        reportProgress
      );
      
      return result;
      
    } catch (error) {
      Logger.error('Brainstorm tool execution failed:', error);
      
      if (error instanceof Error) {
        // Handle specific error types with user-friendly messages
        if (error.message.includes('quota')) {
          return `❌ **Brainstorming session failed**: Gemini API quota exceeded. Please try again later or use a different model (try gemini-2.5-flash for lower quota usage).`;
        }
        if (error.message.includes('timeout')) {
          return `❌ **Brainstorming session timed out**: Complex brainstorming requests may need more time. Try reducing the ideaCount (current: ${args.ideaCount}) or simplifying the prompt.`;
        }
        return `❌ **Brainstorming failed**: ${error.message}`;
      }
      
      return `❌ An unexpected error occurred during brainstorming. Please try again with a simpler request.`;
    }
  }
};