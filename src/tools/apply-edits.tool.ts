/**
 * apply-edits tool — transactional applier for structured changeMode edit sets.
 *
 * Accepts the raw OLD/NEW text produced by ask-gemini with changeMode:true,
 * validates every edit, previews changes as a diff, then writes all-or-nothing
 * with automatic rollback on partial failure.
 *
 * Two-phase workflow:
 *   1. dryRun:true  (default) — validate and show diff, no files written.
 *   2. dryRun:false, confirm:true — apply; all files written or none.
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedTool } from './registry.js';
import { parseChangeModeOutput } from '../utils/changeModeParser.js';
import {
  planApply,
  renderDiff,
  commitPlan,
} from '../utils/changeModeApplier.js';
import { Logger } from '../utils/logger.js';
import {
  ERROR_MESSAGES,
  STATUS_MESSAGES,
} from '../constants.js';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const applyEditsSchema = z.object({
  edits: z
    .string()
    .min(1)
    .describe(
      'The raw changeMode OLD/NEW edit text produced by ask-gemini with changeMode:true. ' +
      'Must contain one or more **FILE: path:line** blocks.'
    ),
  dryRun: z
    .boolean()
    .default(true)
    .describe(
      'When true (default) only validate and preview the diff — no files are written. ' +
      'Set to false together with confirm:true to apply.'
    ),
  confirm: z
    .boolean()
    .default(false)
    .describe(
      'Safety gate: must be set to true (together with dryRun:false) to actually write files. ' +
      'Prevents accidental destructive writes.'
    ),
});

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const applyEditsTool: UnifiedTool = {
  name: 'apply-edits',
  description:
    'Applies a changeMode OLD/NEW edit set transactionally. ' +
    'Validates every OLD block (must appear exactly once), renders a diff preview, ' +
    'then writes all files atomically with rollback on failure. ' +
    'Use dryRun:true (default) to preview, then dryRun:false + confirm:true to apply.',
  zodSchema: applyEditsSchema,
  category: 'utility',

  execute: async (args): Promise<string> => {
    const { edits, dryRun, confirm } = args as {
      edits: string;
      dryRun: boolean;
      confirm: boolean;
    };

    Logger.debug(`apply-edits: dryRun=${dryRun} confirm=${confirm}`);

    // ------------------------------------------------------------------
    // 1. Parse changeMode text → edit objects
    // ------------------------------------------------------------------
    const parsed = parseChangeModeOutput(edits);

    if (parsed.length === 0) {
      return `❌ ${ERROR_MESSAGES.APPLY_EDITS_NO_EDITS}`;
    }

    Logger.debug(`apply-edits: parsed ${parsed.length} edit(s)`);

    // ------------------------------------------------------------------
    // 2. Plan (validate + build in-memory diffs); IO is injected here
    // ------------------------------------------------------------------
    const root = process.cwd();

    const plan = planApply(parsed, {
      root,
      readFile: (absPath: string) =>
        fs.readFileSync(absPath, 'utf8'),
    });

    // ------------------------------------------------------------------
    // 3. If there are validation errors, surface them immediately
    // ------------------------------------------------------------------
    if (plan.errors.length > 0) {
      const errorList = plan.errors
        .map((e, i) => `  ${i + 1}. ${e}`)
        .join('\n');
      return (
        `❌ ${ERROR_MESSAGES.APPLY_EDITS_VALIDATION_FAILED}\n\n` +
        `**Errors (${plan.errors.length}):**\n${errorList}`
      );
    }

    // ------------------------------------------------------------------
    // 4. Build diff preview (used in both dry-run and pre-apply output)
    // ------------------------------------------------------------------
    const diff = renderDiff(plan);

    const totalEdits = plan.files.reduce((n, f) => n + f.editCount, 0);
    const fileCount = plan.files.length;
    const fileSummary = plan.files
      .map(f => `  - ${path.relative(root, f.path)} (${f.editCount} edit${f.editCount !== 1 ? 's' : ''})`)
      .join('\n');

    const summaryHeader =
      `**${totalEdits} edit${totalEdits !== 1 ? 's' : ''} across ` +
      `${fileCount} file${fileCount !== 1 ? 's' : ''}:**\n${fileSummary}`;

    // ------------------------------------------------------------------
    // 5. Dry-run: return diff without writing
    // ------------------------------------------------------------------
    if (dryRun || !confirm) {
      const instruction =
        dryRun
          ? STATUS_MESSAGES.APPLY_EDITS_DRY_RUN
          : STATUS_MESSAGES.APPLY_EDITS_CONFIRM_REQUIRED;

      return (
        `## apply-edits preview\n\n` +
        `${summaryHeader}\n\n` +
        `\`\`\`diff\n${diff}\n\`\`\`\n\n` +
        `> ${instruction}`
      );
    }

    // ------------------------------------------------------------------
    // 6. Commit: write all files or roll back
    // ------------------------------------------------------------------
    try {
      commitPlan(plan, {
        writeFile: (absPath: string, content: string) =>
          fs.writeFileSync(absPath, content, 'utf8'),
      });
    } catch (err) {
      return `❌ Apply failed (rollback attempted):\n\n${(err as Error).message}`;
    }

    Logger.debug(`apply-edits: wrote ${fileCount} file(s)`);

    return (
      `## apply-edits complete\n\n` +
      `${summaryHeader}\n\n` +
      `\`\`\`diff\n${diff}\n\`\`\`\n\n` +
      `> ${STATUS_MESSAGES.APPLY_EDITS_SUCCESS}`
    );
  },
};
