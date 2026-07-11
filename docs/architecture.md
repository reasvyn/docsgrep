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

Kept intentionally thin. Responsibilities:

1. Create the MCP `Server` instance with capabilities and transport.
2. Parse CLI arguments (`process.argv`).
3. Initialize `ToolRegistry` and `PluginManager`.
4. Dispatch to either CLI mode or MCP stdio mode.

### Tool Layer (`src/tools/`)

| File | Responsibility |
|---|---|
| `base.ts` | `BaseTool<T>` abstract class, `FileScanner` static utility |
| `registry.ts` | `ToolRegistry` -- static class mapping tool names to handlers |
| `documentation.ts` | Handlers for `find_docs`, `read_file`, `search_docs`, `semantic_search`, `summarize_doc`, `find_related`, `check_stale`, `get_context`, `measure_coverage` |
| `sync-verify.ts` | Handlers for `sync_documentation`, `verify_docs`, `check_delta`, `check_artefacts` |
| `help-info.ts` | Handlers for `show_help`, `detect_stack`, `check_style`, `clone_repo` |
| `workspace.ts` | Handlers for `init_workspace`, `clear_cache` |
| `archetypes.ts` | Handler for `detect_patterns` |
| `audit-ask.ts` | Handlers for `lint_interactive`, `security_interactive` |

Three heavy tools (`analyze_code`, `audit_security`, `catch_bugs`) are implemented as class-based tools extending `BaseTool<T>` and registered via overrides in `index.ts`.

### Utility Layer (`src/utils/`)

| File | Responsibility |
|---|---|
| `file.ts` | `FileScanner.findFiles()`, `getIgnorePatterns()` (gitignore support) |
| `git.ts` | Git operations via `simple-git` |
| `validation.ts` | `validateDirPath()`, `validateStringParam()`, `escapeRegex()` |
| `semaphore.ts` | `Semaphore` class -- concurrency limiter (default: 5) |
| `logger.ts` | Structured logging with credential masking |
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

`FileScanner.findFiles()` provides a single entry point for filesystem scanning that respects `.gitignore`, `includePath`, and `excludePath` glob patterns. All tools that scan files must use this utility.

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
