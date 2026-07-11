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

- `src/index.ts` — entry point (MCP server setup + plugin discovery, keep thin)
- `src/cli.ts` — CLI argument parsing and display
- `src/core-tools.ts` — class-based tools (AnalyzeCodeTool, AuditSecurityTool, CatchBugsTool)
- `src/tools/` — tool handlers; one module per logical group:
  - `base.ts` — BaseTool<T> abstract class (semaphore, logging, credential masking)
  - `registry.ts` — ToolRegistry (imports from split modules, self-registers core tools)
  - `doc-find.ts`, `doc-search.ts`, `doc-inspect.ts`, `doc-coverage.ts` — documentation tools
  - `doc-verify.ts`, `doc-sync.ts` — verification and sync tools
  - `help.ts`, `repo-analysis.ts`, `repo.ts` — help, stack detection, clone
  - `workspace.ts` — workspace init and cache management
  - `archetypes.ts`, `audit-ask.ts` — pattern detection and interactive prompts
- `src/utils/` — shared utilities (file scanning, git, validation, workspace, cache, logging)
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
