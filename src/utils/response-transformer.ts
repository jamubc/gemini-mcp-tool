/**
 * Response transformer for rewriting phrases and appending action sentences
 */

export interface PhraseMapping {
  pattern: RegExp;
  replacement: string;
}

// Default phrase mappings for stronger wording
const DEFAULT_PHRASE_MAPPINGS: PhraseMapping[] = [
  { pattern: /\bI have updated the (\w+)\b/g, replacement: 'Here is the revised $1—apply it yourself' },
  { pattern: /\bI've updated the (\w+)\b/g, replacement: 'Here is the revised $1—apply it yourself' },
  { pattern: /\bI'll\b/g, replacement: 'I will' },
  { pattern: /\bcan't\b/g, replacement: 'cannot' },
  { pattern: /\bwon't\b/g, replacement: 'will not' },
  { pattern: /\bI've\b/g, replacement: 'I have' },
  { pattern: /\bwe've\b/g, replacement: 'we have' },
  { pattern: /\bthey've\b/g, replacement: 'they have' },
  { pattern: /\bshould've\b/g, replacement: 'should have' },
  { pattern: /\bcould've\b/g, replacement: 'could have' },
  { pattern: /\bwould've\b/g, replacement: 'would have' },
];

/**
 * Rewrite weak phrases in text to use stronger wording
 */
export function rewriteWeakPhrases(text: string): string {
  let result = text;
  
  // Apply each phrase mapping
  for (const mapping of DEFAULT_PHRASE_MAPPINGS) {
    result = result.replace(mapping.pattern, mapping.replacement);
  }
  
  return result;
}

/**
 * Get the mandatory action sentence based on environment configuration
 */
export function getMandatoryActionSentence(): string | null {
  // Check if the feature is enabled via environment variable
  if (process.env.FORCE_ACTION_SENTENCE !== 'true') {
    return null;
  }
  
  return '\n\nUse your file-write tool now.';
}

/**
 * Transform a response by applying phrase rewriting and appending action sentence
 */
export function transformResponse(response: string): string {
  // First, rewrite weak phrases
  let transformed = rewriteWeakPhrases(response);
  
  // Then, append mandatory action sentence if enabled
  const actionSentence = getMandatoryActionSentence();
  if (actionSentence) {
    transformed += actionSentence;
  }
  
  return transformed;
}

/**
 * Extract content between delimiters and transform only the content portion
 */
export function transformStructuredResponse(response: string): string {
  // Match the structured response pattern
  const match = response.match(/(\[Start of Tool Output\]\n)([\s\S]*?)(\n\[End of Tool Output\][\s\S]*)/);
  
  if (!match) {
    // If no structured format found, transform the entire response
    return transformResponse(response);
  }
  
  // Extract parts
  const startDelimiter = match[1];
  const content = match[2];
  const endDelimiterAndMetadata = match[3];
  
  // Transform only the content portion
  const transformedContent = transformResponse(content);
  
  // Reconstruct the response
  return startDelimiter + transformedContent + endDelimiterAndMetadata;
}