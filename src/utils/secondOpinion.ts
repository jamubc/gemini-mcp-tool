/**
 * Pure string-manipulation helpers for the blind second-opinion workflow.
 *
 * ANTI-ANCHORING GUARANTEE:
 *   buildSolvePrompt(problem) ONLY takes the problem description — no answer
 *   parameter exists — so the orchestrator's own answer can never leak into the
 *   independent solve call, even by accident.
 */

/**
 * Builds the prompt sent to the independent solver.
 *
 * HARD INVARIANT: this function signature intentionally accepts only `problem`.
 * There is no second parameter for an existing answer. Any attempt to pass an
 * existing answer at call-site would be a TypeScript compile error. This makes
 * the anti-anchoring guarantee statically enforced.
 */
export function buildSolvePrompt(problem: string): string {
  return `You are an independent expert providing a fresh solution to the following problem. Approach it from first principles without reference to any prior analysis.

## Problem

${problem}

## Instructions

- Reason through the problem independently and thoroughly.
- State your assumptions clearly.
- Provide a complete, well-structured answer.
- Do not hedge or truncate your response — give your full analysis.`;
}

/**
 * Builds the prompt used to compare the orchestrator's answer with the
 * independently generated answer.
 *
 * This prompt is only executed AFTER the independent solve is complete, so it
 * has no influence on the independent answer.
 */
export function buildComparePrompt(
  problem: string,
  ownAnswer: string,
  independentAnswer: string
): string {
  return `You are a neutral analyst comparing two independent answers to the same problem. Identify where they agree, where they diverge, and which (if any) divergences are substantive.

## Problem

${problem}

## Answer A

${ownAnswer}

## Answer B

${independentAnswer}

## Instructions

1. List key **points of agreement** between A and B.
2. List key **points of divergence** — focus on substantive differences in conclusions, recommendations, or reasoning, not merely phrasing.
3. For each divergence, briefly assess which position (if either) is better supported.
4. Conclude with an overall summary of alignment.

Structure your output with clear headings.`;
}

/**
 * Formats the combined output as markdown.
 *
 * The "Independent answer" section is always present. The "Points of
 * divergence" section is included only when a comparison was performed.
 */
export function formatResult({
  independentAnswer,
  comparison,
}: {
  independentAnswer: string;
  comparison?: string;
}): string {
  const sections: string[] = [
    `## Independent answer\n\n${independentAnswer.trim()}`,
  ];

  if (comparison !== undefined && comparison.trim().length > 0) {
    sections.push(`## Points of divergence\n\n${comparison.trim()}`);
  }

  return sections.join('\n\n---\n\n');
}
