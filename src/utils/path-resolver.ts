
import * as fs from 'fs';
import * as path from 'path';
import { sanitize } from './error-sanitizer.js';

/**
 * Resolves file paths in a string that are prefixed with '@'.
 * @param input The input string to process.
 * @returns A promise that resolves to the processed string with absolute paths.
 */
export async function resolveFilePaths(input: string): Promise<string> {
  const regex = /@(\S+)/g;
  let match;
  let processedInput = input;

  while ((match = regex.exec(input)) !== null) {
    // Extract raw path after '@'
    const rawPath = match[1];

    // Sanitize the extracted path – remove wrapping quotes, trailing commas or brackets, etc.
    // Remove surrounding quotes/backticks first if present
    const trimmed = rawPath.replace(/^['"`]/, '').replace(/['"`]+$/, '');

    // Sanitize: drop any trailing characters that are not path-friendly (e.g., ],},) or ,)
    const sanitizedPath = trimmed.replace(/[^\w./\\-]+$/, '');

    const resolvedPath = await resolvePathWithContext(sanitizedPath);

    if (resolvedPath) {
      // Preserve whatever trailing punctuation was after the actual path so JSON / pareto syntax stays valid
      const trailing = rawPath.slice(sanitizedPath.length);
      processedInput = processedInput.replace(`@${rawPath}`, `${resolvedPath}${trailing}`);
    } else {
      // Keep original @ syntax if path can't be resolved
      console.warn(`[Path Resolver] Could not resolve path: ${sanitizedPath}`);
    }
  }

  return processedInput;
}

/**
 * Enhanced path resolution using multiple strategies
 * Implements Context-Engineering field-aware path discovery
 */
async function resolvePathWithContext(filePath: string): Promise<string | null> {
  // Strategy 1: Direct resolution
  try {
    const directPath = path.resolve(filePath);
    if (await fileExists(directPath)) {
      return directPath;
    }
  } catch (error) {
    // Continue to next strategy
  }

  // Strategy 2: Relative to current working directory
  try {
    const cwdPath = path.resolve(process.cwd(), filePath);
    if (await fileExists(cwdPath)) {
      return cwdPath;
    }
  } catch (error) {
    // Continue to next strategy
  }

  // Strategy 3: Remove leading ./ if present
  if (filePath.startsWith('./')) {
    try {
      const cleanPath = path.resolve(process.cwd(), filePath.slice(2));
      if (await fileExists(cleanPath)) {
        return cleanPath;
      }
    } catch (error) {
      // Continue to next strategy  
    }
  }

  // Strategy 4: Relative to repository root (detected via .git or package.json)
  try {
    const repoRoot = await findRepoRoot();
    if (repoRoot) {
      const repoPath = path.resolve(repoRoot, filePath);
      if (await fileExists(repoPath)) {
        return repoPath;
      }
    }
  } catch (_) {
    /* continue */
  }

  // Strategy 5: Search parent directories (for deeply nested files)
  const parentPath = await findInParentDirs(filePath);
  if (parentPath) {
    return parentPath;
  }

  // Strategy 6: Search common directories
  const commonDirs = ['src', 'lib', 'docs', 'test', 'tests'];
  for (const dir of commonDirs) {
    try {
      const candidate = path.resolve(process.cwd(), dir, filePath);
      if (await fileExists(candidate)) {
        return candidate;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

async function findRepoRoot(): Promise<string | null> {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    if (await fileExists(path.join(currentDir, '.git')) || await fileExists(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

async function findInParentDirs(filename: string): Promise<string | null> {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const candidate = path.join(currentDir, filename);
    if (await fileExists(candidate)) {
      return candidate;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}
