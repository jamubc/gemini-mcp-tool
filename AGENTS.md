# AGENT Guidance

## Development
- Use TypeScript with an object-oriented approach when adding new features.
- Follow test-driven development. Add or update tests under `src` and run `npm test`.
- Lint code with `npm run lint` before committing.
- Build with `npm run build` to ensure TypeScript compiles.
- Keep `@modelcontextprotocol/sdk` and `zod` listed as both peer and dev dependencies. Their versions should match across sections of `package.json`.
- Ensure `@types/node` is installed and referenced via `tsconfig.json` under `compilerOptions.types`.

## Windows Compatibility
- The command executor uses `shell: process.platform === "win32"` to avoid ENOENT errors.
- Documented in `docs/resources/troubleshooting.md`.

## Repository Scripts
- `npm test` – runs the test suite (currently a placeholder).
- `npm run lint` – checks TypeScript types via `tsc --noEmit`.
- `npm run build` – compiles TypeScript to `dist/`.

