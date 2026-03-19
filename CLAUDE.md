# CLAUDE.md

## Project
Permcraft — Interactive CLI for managing Salesforce permission set XML files.

## Tech stack
- TypeScript, Node.js (ESM)
- inquirer + inquirer-autocomplete-prompt (interactive prompts)
- fuse.js (fuzzy search)
- fast-xml-parser (XML read/write)
- vitest (testing)

## Commands
- `npm run build` — compile TypeScript to dist/
- `npm run dev` — run directly via tsx
- `npm test` — run vitest test suite
- `npm run lint` — eslint
- `npm run format` — prettier

## Workflow
- Commit after every major change with a descriptive message.
- Keep CHANGELOG.md updated with a summary of what changed and why, grouped under an "Unreleased" heading.
- Use conventional commit style: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.
- Never amend existing commits unless explicitly asked.
- Stage specific files, not `git add -A`.
