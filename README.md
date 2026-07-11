# docsgrep

[![npm version](https://img.shields.io/npm/v/docsgrep.svg)](https://www.npmjs.com/package/docsgrep)
[![license](https://img.shields.io/npm/l/docsgrep.svg)](https://github.com/reasvyn/docsgrep/blob/main/LICENSE)
[![MCP compatible](https://img.shields.io/badge/MCP-compatible-blue.svg)](https://modelcontextprotocol.io)

**docsgrep** is a developer tool for documentation search, code quality auditing, security scanning, and bug detection. Run it from the command line during development, or integrate it as an [MCP server](#mcp-server) for AI-assisted coding workflows.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [MCP Server](#mcp-server)
- [Tools](#tools)
  - [Discovery & Setup](#discovery--setup)
  - [Content & Search](#content--search)
  - [Auditing & Quality](#auditing--quality)
  - [Maintenance & Sync](#maintenance--sync)
  - [Context & Help](#context--help)
- [Plugin System](#plugin-system)
- [Developer Guide](#developer-guide)
- [Architecture](#architecture)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Documentation Intelligence** -- Semantic search, summarization, and topic-based discovery across your docs.
- **Code Quality Auditing** -- Enterprise-grade audits with code smell detection, convention analysis, and quality scoring.
- **Security Scanning** -- OWASP Top 10 coverage, secret/credential detection, PII scanning, and dependency vulnerability auditing.
- **Bug Detection** -- Runtime error detection, race condition analysis, memory leak identification, and performance issue discovery.
- **Architectural Analysis** -- Pattern detection (MVC, Repository, etc.), dependency mapping, and refactoring candidate identification.
- **Documentation Integrity** -- Staleness detection, coverage measurement, doc-vs-code delta analysis, and automated sync.
- **Remote Repository Support** -- Clone and analyze remote repositories with smart caching and authentication (HTTPS, SSH).
- **Plugin System** -- Extend docsgrep with community or custom plugins via `docsgrep-plugin-*` packages.

---

## Quick Start

```bash
# Run without installing
npx docsgrep run analyze_code

# Or install globally
npm install -g docsgrep
docsgrep run audit_security --format json
```

Run `show_help` for a full list of available tools:

```bash
npx docsgrep run show_help
```

---

## Installation

### Global install

```bash
npm install -g docsgrep
```

### Local install (per-project)

```bash
npm install --save-dev docsgrep
```

### Run without installing

```bash
npx docsgrep run <tool_name> [--param value]
```

### Requirements

- **Node.js** >= 18
- **pnpm** (recommended), npm, or yarn

---

## CLI Usage

```
docsgrep run <tool_name> [--param value ...] [--format text|json]
```

### Arguments

| Flag | Description |
|------|-------------|
| `--format text` | Plain text output (default) |
| `--format json` | Pretty-printed JSON output |
| `--dirPath <path>` | Target directory (defaults to cwd) |
| `--pattern <regex>` | Search pattern for `search_docs` |
| `--topK <n>` | Number of results for `semantic_search` |
| `--maxAgeDays <n>` | Staleness threshold in days |
| Comma-separated values | Automatically parsed as arrays (e.g., `--filePatterns "*.ts,*.js"`) |

### Examples

```bash
# Code quality audit on the current directory
npx docsgrep run analyze_code

# Security scan with JSON output
npx docsgrep run audit_security --format json

# Regex search in documentation
npx docsgrep run search_docs --pattern "authentication" --contextLines 2

# Detect bugs and potential runtime errors
npx docsgrep run catch_bugs --dirPath ./src

# Semantic search for documentation
npx docsgrep run semantic_search --query "how to handle errors" --topK 5

# Find docs related to a topic
npx docsgrep run find_related --topic "database migration"

# Measure documentation coverage
npx docsgrep run measure_coverage --publicOnly true

# Detect project technology stack
npx docsgrep run detect_stack

# Check for stale documentation
npx docsgrep run check_stale --maxAgeDays 30

# Clone and analyze a remote repo
npx docsgrep run clone_repo --repoUrl https://github.com/user/repo
```

### npm Script Shortcuts

When docsgrep is installed locally, these shortcuts are available:

| Script | Runs |
|--------|------|
| `npm run lint` | `analyze_code` -- code quality audit |
| `npm run audit` | `audit_security` -- security audit |
| `npm run bugs` | `catch_bugs` -- bug detection |
| `npm run docs:check` | `measure_coverage` -- doc coverage |
| `npm run docs:stale` | `check_stale` -- stale doc detection |

---

## MCP Server

docsgrep functions as a **Model Context Protocol (MCP) server**, giving AI agents and MCP-compatible IDEs access to all 25 tools.

### Claude Desktop / Cursor / VS Code

```json
{
  "mcpServers": {
    "docsgrep": {
      "command": "npx",
      "args": ["-y", "docsgrep"]
    }
  }
}
```

### OpenCode

Already configured via `opencode.json` in this repository:

```json
{
  "mcp": {
    "docsgrep": {
      "type": "local",
      "command": ["npx", "tsx", "src/index"]
    }
  }
}
```

### Local Development (from source)

```json
{
  "mcpServers": {
    "docsgrep": {
      "command": "npx",
      "args": ["tsx", "src/index"]
    }
  }
}
```

### How It Works

1. On startup, docsgrep initializes the tool registry and discovers any installed plugins.
2. When an MCP client connects, it lists all available tools (core + plugin tools).
3. When a tool is called, docsgrep validates inputs, executes the handler, and returns a structured `McpToolResponse`.
4. The server communicates over **stdio** transport.

---

## Tools

docsgrep ships with **25 tools** organized into five categories.

### Discovery & Setup

| Tool | Description | Key Arguments |
|------|-------------|---------------|
| `init_workspace` | Initialize a docsgrep workspace (.docsgrep/) and update .gitignore | `projectPath` |
| `detect_stack` | Identify project technology stack from package manager files | `dirPath` |
| `check_style` | Detect coding conventions and implicit patterns from codebase samples | `dirPath` |
| `find_docs` | Discover README files and documentation folders | `dirPath`, `includePath`, `excludePath` |
| `clone_repo` | Clone a remote git repository with caching and auth support | `repoUrl`, `branch`, `authToken`, `sshKeyPath` |

### Content & Search

| Tool | Description | Key Arguments |
|------|-------------|---------------|
| `read_file` | Read a documentation file with binary detection | `filePath` |
| `search_docs` | Regex search with relevance ranking and context lines | `dirPath`, `pattern`, `contextLines` |
| `semantic_search` | Natural language search across documentation | `dirPath`, `query`, `topK` |
| `summarize_doc` | Automatic summarization of a documentation file | `filePath`, `maxLength` |

### Auditing & Quality

| Tool | Description | Key Arguments |
|------|-------------|---------------|
| `analyze_code` | Full code quality audit with scoring and recommendations | `dirPath`, `focusAreas`, `includePath` |
| `audit_security` | OWASP Top 10, secret scanning, PII analysis, dependency audit | `dirPath`, `includePath` |
| `catch_bugs` | Detect runtime errors, race conditions, memory leaks, logic flaws | `dirPath`, `includePath` |
| `lint_interactive` | Interactive prompt showing detected stack and linting options | `dirPath` |
| `security_interactive` | Interactive prompt showing scan options before execution | `dirPath` |

### Maintenance & Sync

| Tool | Description | Key Arguments |
|------|-------------|---------------|
| `check_stale` | Identify documentation not updated in N days or out of sync with code | `dirPath`, `maxAgeDays`, `compareWithCode` |
| `measure_coverage` | Measure docblock coverage across source code (language-agnostic) | `dirPath`, `publicOnly`, `filePatterns` |
| `sync_documentation` | Generate or update documentation stubs from code changes | `dirPath`, `filePaths`, `updateMode` |
| `verify_docs` | Verify documented methods/params match actual implementation | `dirPath`, `docPath`, `strictMode` |
| `check_delta` | Compare documentation claims against code reality | `dirPath`, `docPath`, `includeCodeSnippets` |
| `check_artefacts` | Prioritize documentation updates from git diff history | `dirPath`, `sinceCommit`, `priorityMode` |

### Context & Help

| Tool | Description | Key Arguments |
|------|-------------|---------------|
| `get_context` | Proactively provide relevant docs based on current file context | `dirPath`, `currentFilePath`, `contextDepth` |
| `show_help` | In-app help for all tools with examples and pro tips | `toolName` (optional) |
| `clear_cache` | Clean cached repositories older than N days | `localProjectPath`, `maxAgeDays` |

---

## Plugin System

docsgrep supports plugins that add custom tools to the CLI and MCP server.

### Installing Plugins

Plugins are discovered automatically from `node_modules`:

```bash
# Install a plugin
npm install docsgrep-plugin-laravel

# It's now available as a tool
npx docsgrep run laravel_check_relations
```

### Plugin Naming Convention

- `docsgrep-plugin-<name>` -- auto-discovered
- `@docsgrep/plugin-<name>` -- auto-discovered
- Any path/package listed in `docsgrep.config.json` -- explicit

### Writing a Plugin

A plugin is an ESM module that default-exports a `DocsgrepPlugin` object:

```typescript
import type { DocsgrepPlugin } from "docsgrep";

const plugin: DocsgrepPlugin = {
  name: "my-plugin",
  version: "1.0.0",
  tools: {
    definitions: [
      {
        name: "my_custom_tool",
        description: "Does something custom",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: { type: "string", description: "Target directory" },
          },
          required: ["dirPath"],
        },
      },
    ],
    handlers: {
      my_custom_tool: async (args) => {
        return {
          content: [{ type: "text", text: JSON.stringify({ result: "done" }) }],
        };
      },
    },
  },
  onLoad: async () => {
    console.log("My plugin loaded!");
  },
};

export default plugin;
```

See [docs/PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md) for the full guide.

---

## Developer Guide

### Prerequisites

- [pnpm](https://pnpm.io/) >= 9.0
- Node.js >= 18

### Setup

```bash
git clone https://github.com/reasvyn/docsgrep.git
cd docsgrep
pnpm install
```

### Common Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Compile TypeScript to `build/` |
| `pnpm dev` | Run from source via `tsx` |
| `pnpm test` | Run all Vitest tests |
| `pnpm test:coverage` | Run tests with V8 coverage report |
| `pnpm lint` | Run `analyze_code` on itself (dogfooding) |
| `pnpm audit` | Run `audit_security` on itself |
| `pnpm bugs` | Run `catch_bugs` on itself |
| `pnpm docs:check` | Run `measure_coverage` on itself |
| `pnpm docs:stale` | Run `check_stale` on itself |

> **Note:** The `lint`, `audit`, `bugs`, `docs:check`, and `docs:stale` scripts run docsgrep on its own source code. They require `pnpm build` first.

### Running a Single Test

```bash
pnpm vitest run tests/unit/tools/documentation.test.ts
```

### Project Structure

```
docsgrep/
├── src/
│   ├── index.ts            # Entry point (MCP server + plugin discovery)
│   ├── cli.ts              # CLI argument parsing and display
│   ├── core-tools.ts       # Class-based tools (AnalyzeCodeTool, etc.)
│   ├── tools/              # Tool handlers (one module per logical group)
│   │   ├── base.ts         # BaseTool<T> abstract class
│   │   ├── registry.ts     # Tool registry (name → handler mapping)
│   │   ├── doc-find.ts     # find_docs
│   │   ├── doc-search.ts   # search_docs, semantic_search, find_related
│   │   ├── doc-inspect.ts  # read_file, summarize_doc, check_stale, get_context
│   │   ├── doc-coverage.ts # measure_coverage
│   │   ├── doc-verify.ts   # verify_docs, check_delta
│   │   ├── doc-sync.ts     # sync_documentation, check_artefacts
│   │   ├── help.ts         # show_help
│   │   ├── repo-analysis.ts # detect_stack, check_style
│   │   ├── repo.ts         # clone_repo
│   │   ├── workspace.ts    # init_workspace, clear_cache
│   │   ├── archetypes.ts   # detect_patterns
│   │   └── audit-ask.ts    # lint_interactive, security_interactive
│   ├── utils/              # Shared utilities
│   │   ├── file.ts         # FileScanner, getIgnorePatterns
│   │   ├── git.ts          # Git operations + repo cache
│   │   ├── validation.ts   # Input validation
│   │   ├── semaphore.ts    # Concurrency limiter
│   │   ├── logger.ts       # Dual output: stderr + file logs
│   │   ├── workspace.ts    # .docsgrep/ path resolution
│   │   ├── cache.ts        # TTL-based file cache
│   │   ├── plugin-manager.ts
│   │   └── app-info.ts     # AppInfo (version, name from package.json)
│   ├── types/              # TypeScript interfaces
│   │   ├── tools.ts        # McpToolResponse + all tool arg interfaces
│   │   └── plugins.ts      # DocsgrepPlugin interface
│   └── config/             # JSON configuration
│       ├── tools.json      # MCP tool definitions (JSON Schema)
│       ├── patterns.json
│       └── *.json          # Per-language configs (js, py, go, rs, etc.)
├── tests/
│   ├── unit/               # Unit tests (vi.mock for IO)
│   └── integration/        # E2E tests (StdioClientTransport)
├── docs/
│   ├── overview.md         # Project overview
│   ├── architecture.md     # System design
│   ├── requirements.md     # Runtime prerequisites
│   ├── conventions.md      # Coding standards
│   ├── index.md            # Documentation index
│   ├── README.md           # Tool documentation index
│   ├── PLUGIN_GUIDE.md     # Plugin authoring guide
│   └── tools/              # Per-tool documentation (*.md)
├── plugins/                # Local plugin directory
├── scripts/                # Build/publish scripts
├── .agents/                # OpenCode agent skills
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── AGENTS.md               # AI agent instructions
└── opencode.json           # OpenCode MCP config
```

### Architecture Notes

- **ESM-only**: all local imports must include the `.js` extension.
- **BaseTool pattern**: tool handlers extend `BaseTool<T>` for concurrency control, logging, credential masking, and error wrapping.
- **ToolRegistry**: static class mapping tool names to handler functions. Falls back to `PluginManager` for plugin tools.
- **Input validation**: every handler validates `dirPath` with `validateDirPath` and string params with `validateStringParam`.
- **FileScanner**: all filesystem scanning goes through `FileScanner.findFiles()` which respects `.gitignore`, `includePath`, and `excludePath`.
- **Concurrency**: a `Semaphore(5)` limits parallel operations via `operationLimiter` in `BaseTool`.
- **App metadata**: always use `AppInfo` from `utils/app-info.ts` -- never hardcode version or name.

---

## Security

- **Path traversal prevention**: all file operations resolve against strict base paths.
- **Credential masking**: `BaseTool` automatically redacts `authToken` fields in logs. New sensitive params must be added to `maskSensitive`.
- **No secret leakage**: credentials are detected but never logged or included in responses.
- **Concurrency protection**: built-in semaphore prevents system saturation from parallel tool execution.
- **Binary detection**: binary files are automatically detected and skipped during scanning.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and PR expectations.

### Quick Reference

1. `pnpm install` -- install dependencies
2. Create a feature branch
3. Write code + tests
4. `pnpm build && pnpm test` -- verify
5. Open a PR with a clear description of intent and impact

---

## License

[MIT](LICENSE) -- Copyright (c) 2026 Reasvyn
