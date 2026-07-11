# AGENTS.md

## Quick Commands

```bash
pnpm install        # install deps
pnpm build          # compile TypeScript (tsc) → build/
pnpm test           # vitest
pnpm test:coverage
```

Commands prefixed `lint`, `audit`, `bugs`, `docs:check`, `docs:stale` run **docsgrep on itself** (dogfooding). They require a prior `pnpm build`.

## Repo Structure

Single-package TypeScript project (ESM).

- `src/index.ts` — entry point (CLI engine + MCP server, keep thin)
- `src/tools/` — tool handlers; inherit from `tools/base.ts`
- `src/utils/` — shared utilities (file scanning, git, validation)
- `src/types/tools.ts` — tool input interfaces
- `src/config/` — JSON config for limits, patterns, language defs
- `tests/` — Vitest test suites (`tests/**/*.test.ts`)
- `docs/` — project and tool documentation

## Critical Conventions

- **ESM with `.js` extensions**: all local imports MUST include `.js` (e.g., `import { x } from "./utils.js"`).
- **Strict TypeScript**: no implicit `any`. Use `McpToolResponse` for tool outputs.
- **BaseTool pattern**: new tool handlers should extend `BaseTool` from `tools/base.ts` for logging, credential masking, and concurrency limiting.
- **Scanning**: use `FileScanner.findFiles` for filesystem scanning. Scanning tools must support `includePath`/`excludePath` and respect `.gitignore` via `getIgnorePatterns` from `utils/file.ts`.
- **Validation**: validate `dirPath` inputs with `validateDirPath`.
- **App metadata**: use `AppInfo` from `utils/app-info.ts`, never hardcode version/name.

## Testing

- Mock all external IO with `vi.mock`.
- E2E/integration tests use `StdioClientTransport` from `@modelcontextprotocol/sdk`.
- Run a single test file: `pnpm vitest run tests/path/to/file.test.ts`

## Skills

Load a skill via the `skill` tool when starting work in that phase.

| Phase | Skill | When to load |
|---|---|---|
| **Implement** | `code-writing` | Adding/modifying tool handlers, utilities, or core logic |
| **Verify** | `test-writing` | Writing unit or integration tests |
| **Document** | `doc-writing` | Updating tool docs, JSDoc/TSDoc, README, or help text |
