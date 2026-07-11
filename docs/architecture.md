# Architecture

> **Author:** Reas Vyn &lt;reasvyn@gmail.com&gt;

This document describes the internal architecture of docsgrep for developers working on the codebase.

## High-Level Design

```
┌──────────────────────────────────────────────────┐
│                   Entry Point                     │
│               src/index.ts                        │
│  ┌──────────────┐  ┌───────────────────────────┐ │
│  │   CLI Mode   │  │    MCP Server (stdio)     │ │
│  │  run <tool>  │  │  ListTools / CallTool      │ │
│  └──────┬───────┘  └────────────┬──────────────┘ │
│         └───────────┬───────────┘                 │
│                     ▼                             │
│              ToolRegistry                         │
│         (name → handler map)                      │
│                     │                             │
│         ┌───────────┼───────────┐                 │
│         ▼           ▼           ▼                 │
│    Core Tools   Plugin Tools  Overrides           │
│    (17 built)   (dynamic)     (3 class-based)     │
└──────────────────────────────────────────────────┘
```

## Module Boundaries

### Entry Point (`src/index.ts`)

Kept intentionally thin (~56 lines). Responsibilities:

1. Create the MCP `Server` instance with capabilities and transport.
2. Initialize `ToolRegistry` and `PluginManager`.
3. Dispatch to either CLI mode or MCP stdio mode.

CLI argument parsing and display logic lives in `src/cli.ts`. Class-based tools (`AnalyzeCodeTool`, `AuditSecurityTool`, `CatchBugsTool`) live in `src/core-tools.ts`.

### Tool Layer (`src/tools/`)

Handlers are split into single-responsibility modules. Barrel re-exports (`documentation.ts`, `sync-verify.ts`, `help-info.ts`) re-export the split modules for backward compatibility with existing tests.

| File | Responsibility |
|---|---|
| `base.ts` | `BaseTool<T>` abstract class (semaphore, logging, credential masking) |
| `registry.ts` | `ToolRegistry` -- imports from split modules, self-registers core tools |
| `doc-find.ts` | `find_docs` handler |
| `doc-search.ts` | `search_docs`, `semantic_search`, `find_related` handlers |
| `doc-inspect.ts` | `read_file`, `summarize_doc`, `check_stale`, `get_context` handlers |
| `doc-coverage.ts` | `measure_coverage` handler |
| `doc-verify.ts` | `verify_docs`, `check_delta` handlers |
| `doc-sync.ts` | `sync_documentation`, `check_artefacts` handlers |
| `help.ts` | `show_help` handler |
| `repo-analysis.ts` | `detect_stack`, `check_style` handlers |
| `repo.ts` | `clone_repo` handler |
| `workspace.ts` | `init_workspace`, `clear_cache` handlers |
| `archetypes.ts` | `detect_patterns` handler |
| `audit-ask.ts` | `lint_interactive`, `security_interactive` handlers |

Class-based tools (`AnalyzeCodeTool`, `AuditSecurityTool`, `CatchBugsTool`) are defined in `src/core-tools.ts` and registered via overrides in `index.ts`.

### Utility Layer (`src/utils/`)

| File | Responsibility |
|---|---|
| `file.ts` | `FileScanner.findFiles()`, `getIgnorePatterns()` (gitignore support) |
| `git.ts` | Git operations via `simple-git`, repo cache at `.docsgrep/repos/` |
| `validation.ts` | `validateDirPath()`, `validateStringParam()`, `escapeRegex()` |
| `semaphore.ts` | `Semaphore` class -- concurrency limiter (default: 5) |
| `logger.ts` | Dual output: stderr + file-based logs in `.docsgrep/logs/` |
| `workspace.ts` | Centralized `.docsgrep/` path resolution (`resolveWorkspace`, `ensureWorkspace`) |
| `cache.ts` | File-based cache with TTL in `.docsgrep/cache/data/` |
| `plugin-manager.ts` | `PluginManager` -- discovery, loading, and fallback resolution |
| `app-info.ts` | `AppInfo` -- reads name/version/description from `package.json` |
| `config.ts` | `loadConfig<T>()` -- loads and caches JSON configs from `src/config/` |

### Type System (`src/types/`)

| File | Contents |
|---|---|
| `tools.ts` | `McpToolResponse`, all tool argument interfaces (`*Args`), archetype types |
| `plugins.ts` | `DocsgrepPlugin`, `PluginToolDefinition`, `PluginToolHandler`, `PluginMetadata` |

### Configuration (`src/config/`)

| File | Contents |
|---|---|
| `tools.json` | MCP tool definitions (JSON Schema format) -- served via `ListTools` |
| `app.json` | Application-level configuration |
| `patterns.json` | Code pattern detection rules |
| `js.json`, `py.json`, `go.json`, etc. | Per-language best practices and linting rules |

## Data Flow

### Tool Execution (CLI)

```
CLI args
  → parseCliArgs() -- extracts toolName, format, toolArgs
  → ToolRegistry.execute(name, args)
    → handler(args)
      → validate inputs (validateDirPath, validateStringParam)
      → acquire operationLimiter semaphore
      → execute logic (FileScanner, fs, git, etc.)
      → release semaphore
      → return McpToolResponse
  → handleCliResponse() -- format as text or JSON
```

### Tool Execution (MCP)

```
MCP CallTool request
  → extract name + arguments
  → ToolRegistry.execute(name, args)
    → (same as CLI path above)
  → return McpToolResponse
```

### Plugin Discovery

```
PluginManager.discoverPlugins()
  → read docsgrep.config.json (explicit plugin paths)
  → scan node_modules for docsgrep-plugin-* / @docsgrep/plugin-*
  → loadPlugin(path)
    → import ESM module
    → validate default export has name + tools
    → register definitions + handlers
    → call onLoad() lifecycle hook
```

## Key Design Patterns

### BaseTool (Template Method)

`BaseTool<T>` wraps the `run()` abstract method with cross-cutting concerns:

```
execute(args)
  → acquire semaphore
  → log tool name + masked args
  → try { run(args) } catch { wrap error }
  → release semaphore
```

New tool handlers should extend `BaseTool` when they need concurrency control, logging, and credential masking automatically.

### ToolRegistry (Service Locator)

`ToolRegistry` is a static class that maps string names to handler functions. It falls back to `PluginManager.getHandler()` for unknown names, enabling transparent plugin tool resolution.

### FileScanner (Facade)

`FileScanner.findFiles()` provides a single entry point for filesystem scanning that respects `.gitignore`, `includePath`, and `excludePath` glob patterns. Canonical location: `src/utils/file.ts`. All tools that scan files must use this utility.

## Concurrency Model

A `Semaphore(5)` limits parallel tool executions. Each tool handler acquires a permit before doing work and releases it in a `finally` block. This prevents system saturation when multiple MCP clients or CLI invocations run simultaneously.

## Response Format

Every tool returns `McpToolResponse`:

```typescript
interface McpToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
```

The `text` field is typically `JSON.stringify(data, null, 2)` for structured data, or a plain string for simple responses. The `isError` flag is set only on failure.

## Workspace Directory

When `init_workspace` is called, docsgrep creates a `.docsgrep/` directory in the project root:

```
.docsgrep/
├── cache/
│   └── data/            # TTL-based file cache (cache.ts)
├── logs/                # Daily log files (logger.ts)
│   └── docsgrep-YYYY-MM-DD.log
├── repos/               # Cloned remote repos (git.ts)
│   └── {name}-{hash}/
└── .gitignore           # Excludes .docsgrep/ from version control
```

All paths are resolved via `src/utils/workspace.ts` (`resolveWorkspace`). The `.docsgrep/` directory is added to `.gitignore` automatically by `init_workspace`. Cache pruning happens via `pruneCache()` in `src/utils/cache.ts`.
