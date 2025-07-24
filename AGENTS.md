# AGENT Guidance

## Development
- Use TypeScript with an object-oriented approach when adding new features.
- Follow test-driven development. Add or update tests under `tests` and run `npm test`.
- Lint code with `npm run lint` before committing.
- Build with `npm run build` to ensure TypeScript compiles. The compiled output
  is written to `dist/`, which is gitignored and should not be committed.
- A `prepare` script builds `dist/` when installing from git, so `npx -y <repo>`
  works without committing compiled files.
- Run `ruff` on any Python files with `select = ["ALL"]`. Only ignore rules with a strong justification.
- Keep `@modelcontextprotocol/sdk` and `zod` listed as both peer and dev dependencies. Their versions should match across sections of `package.json`.
- Ensure `@types/node` is installed and referenced via `tsconfig.json` under `compilerOptions.types`.

## Windows Compatibility
- The command executor uses `shell: process.platform === "win32"` to avoid ENOENT errors.
- Documented in `docs/resources/troubleshooting.md`.
- Prompts passed to the Gemini CLI on Windows are automatically quoted and escaped.

## Repository Scripts
- `npm test` – runs the Vitest suite.
- `npm run lint` – checks TypeScript types via `tsc --noEmit`.
- `npm run build` – compiles TypeScript to `dist/`.

## Package.json Integrity
- Ensure `package.json` is valid JSON. Running `npm install` or `npm run lint` will fail fast if syntax errors are present.

