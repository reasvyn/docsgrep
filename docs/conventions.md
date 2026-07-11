# Conventions

> **Author:** Reas Vyn &lt;reasvyn@gmail.com&gt;

This document defines the coding standards, naming rules, and project conventions for the docsgrep codebase.

## Language & Module System

- **TypeScript** with strict mode enabled (`noImplicitAny`, `strictNullChecks`).
- **ESM-only** (`"type": "module"` in package.json).
- **All local imports MUST include the `.js` extension**:

  ```typescript
  // Correct
  import { validateDirPath } from "../utils/validation.js";

  // Wrong -- will fail at runtime
  import { validateDirPath } from "../utils/validation";
  ```

- **Target**: ES2022, NodeNext module resolution.

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files (tools) | `kebab-case.ts` | `sync-verify.ts`, `help-info.ts` |
| Files (utils) | `kebab-case.ts` | `app-info.ts`, `plugin-manager.ts` |
| Tool handler functions | `handle` + PascalCase | `handleFindDocs`, `handleSearchDocs` |
| Tool class names | PascalCase + `Tool` suffix | `AnalyzeCodeTool`, `FindDocsTool` |
| Tool arg interfaces | PascalCase + `Args` suffix | `FindDocsArgs`, `SearchDocsArgs` |
| Tool names (MCP) | `snake_case` | `find_docs`, `search_docs`, `analyze_code` |
| Config files | `snake_case.json` | `tools.json`, `patterns.json` |
| Test files | `<name>.test.ts` | `documentation.test.ts` |
| Utility functions | camelCase | `validateDirPath`, `getIgnorePatterns` |
| Constants | camelCase (not UPPER_SNAKE) | `operationLimiter`, `DOCS_TOOLS_DIR` |

## File Organization

```
src/
├── index.ts              # Entry point -- keep thin
├── tools/                # Tool handlers (one file per functional group)
│   ├── base.ts           # BaseTool + FileScanner (foundation)
│   ├── registry.ts       # ToolRegistry
│   └── *.ts              # Handler modules
├── utils/                # Shared utilities (stateless where possible)
├── types/                # TypeScript interfaces and type aliases
└── config/               # JSON configuration (loaded at runtime)
```

### Rules

- `index.ts` must remain a thin dispatcher. Move logic to `tools/` or `utils/`.
- One handler file per functional group, not per individual tool.
- Utilities must be stateless or use module-level singletons (like `Semaphore`).
- Types go in `types/`, not inline in handler files.

## Tool Handler Pattern

Every tool handler must:

1. Accept typed args (interface in `types/tools.ts`).
2. Validate inputs at entry (`validateDirPath`, `validateStringParam`).
3. Return `McpToolResponse`.

```typescript
export async function handleMyTool(args: MyToolArgs): Promise<McpToolResponse> {
  try {
    const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
    // ... logic ...
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: error.message }], isError: true };
  }
}
```

### BaseTool

For heavier tools that need concurrency control and credential masking, extend `BaseTool<T>`:

```typescript
class MyTool extends BaseTool<MyToolArgs> {
  protected async run(args: MyToolArgs): Promise<McpToolResponse> {
    // ... logic (semaphore already acquired) ...
  }
}
```

## Testing Conventions

- **Framework**: Vitest with V8 coverage provider.
- **Mocking**: use `vi.mock()` at module level for all external IO (fs, glob, simple-git).
- **Reset**: `beforeEach(() => vi.resetAllMocks())`.
- **Assertions**: parse `JSON.parse(result.content[0].text)` before asserting on data.
- **E2E tests**: use `StdioClientTransport` from `@modelcontextprotocol/sdk` with a 30-second timeout on `beforeAll`.
- **Coverage**: run `bun run test:coverage` before submitting PRs.

### Test File Placement

```
tests/
├── unit/                 # Isolated handler/utility tests
│   ├── tools/            # Tool handler unit tests
│   └── utils/            # Utility unit tests
└── integration/          # Full MCP round-trip tests
```

## Documentation Conventions

### Inline (JSDoc/TSDoc)

- Every exported function and class gets a JSDoc block.
- Document `@param`, `@returns`, and side effects (FS writes, network, process spawn).
- Use `{@link}` to cross-reference related tools or types.

### Tool Reference (`docs/tools/*.md`)

One Markdown file per tool, following the template in `.agents/skills/doc-writing/SKILL.md`.

### Root Markdown

- `README.md`: installation, quickstart, tool overview. Keep under 600 lines.
- `CONTRIBUTING.md`: setup, conventions, PR expectations. Keep under 50 lines.

## Git Conventions

- **Branch naming**: `feature/<name>`, `fix/<name>`, `docs/<name>`.
- **Commit messages**: imperative mood, lowercase, no period. Examples:
  - `add semantic_search tool`
  - `fix path traversal in clone_repo`
  - `update docs for measure_coverage`
- **PR descriptions**: describe intent and impact, not just changes.
- **Never commit**: `.env`, `.npmrc` (contains tokens), `node_modules/`, `build/`.

## Security Conventions

- Validate all path inputs with `validateDirPath` to prevent traversal.
- Add new sensitive parameters to `maskSensitive` in `tools/base.ts`.
- Never log or return raw credentials.
- Never hardcode API keys or tokens.
