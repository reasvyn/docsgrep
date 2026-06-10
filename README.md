# docsgrep

**docsgrep** is a developer tool for documentation search, code quality auditing, security scanning, and bug detection. Use it from the command line during development, or integrate it as an MCP server for AI-assisted coding workflows.

---

## Features

- **Documentation Intelligence** -- Search, summarize, and analyze documentation with semantic understanding and relevance ranking.
- **Code Quality Auditing** -- Comprehensive codebase audits with smell detection, convention analysis, and quality scoring.
- **Security Scanning** -- OWASP Top 10 coverage, secret and credential detection, PII scanning, and dependency vulnerability auditing.
- **Bug Detection** -- Runtime error detection, race condition analysis, memory leak identification, and performance issue discovery.
- **Architectural Analysis** -- Pattern detection, dependency mapping, and refactoring candidate identification.
- **Documentation Integrity** -- Signature validation, staleness detection, coverage measurement, and automated sync.
- **Remote Repository Support** -- Clone and analyze remote repositories with smart caching and authentication support.
- **Plugin System** -- Extend functionality with community or custom plugins.

---

## CLI Usage

Run any tool directly from your terminal:

```bash
npx docsgrep run <tool_name> [--param value] [--format text|json]
```

### Examples

```bash
# Perform a code quality audit on the current directory
npx docsgrep run analyze_code

# Scan for security vulnerabilities with JSON output
npx docsgrep run audit_security --format json

# Search documentation for a pattern with context lines
npx docsgrep run search_docs --pattern "authentication" --contextLines 2

# Detect bugs and potential runtime errors in your source code
npx docsgrep run catch_bugs

# Find documentation files related to a specific topic
npx docsgrep run find_related --topic "database migration"

# Analyze project technology stack
npx docsgrep run detect_stack
```

### npm Script Shortcuts

When installed locally:

| Script | Command |
|--------|---------|
| `npm run lint` | Run code quality audit |
| `npm run audit` | Run security audit |
| `npm run bugs` | Run bug detection |
| `npm run docs:check` | Measure documentation coverage |
| `npm run docs:stale` | Identify stale documentation |

---

## MCP Server

docsgrep also functions as a **Model Context Protocol (MCP) server**, enabling AI agents and MCP-compatible IDEs to access its tool suite.

### Configuration

Add to your MCP client configuration (Claude Desktop, Cursor, VS Code, etc.):

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

For local development:

```json
{
  "mcpServers": {
    "docsgrep": {
      "command": "npx",
      "args": ["tsx", "packages/docsgrep/src/index"]
    }
  }
}
```

---

## 24 Tools

### Intelligence & Search

| Tool | Description |
|------|-------------|
| `semantic_search` | Natural language search across documentation |
| `search_docs` | Regex search with relevance ranking and context |
| `find_related` | Discover documentation by topic or concept |
| `summarize_doc` | Automatic summarization of documentation files |

### Implementation Integrity

| Tool | Description |
|------|-------------|
| `verify_docs` | Validate documented functions against actual implementation |
| `measure_coverage` | Measure docblock coverage across your codebase |
| `catch_bugs` | Detect runtime errors, race conditions, and logic flaws |
| `check_delta` | Compare documentation claims against code reality |
| `check_stale` | Identify outdated or out-of-sync documentation |

### Context & Analysis

| Tool | Description |
|------|-------------|
| `get_context` | Find relevant documentation based on imports and file relationships |
| `check_artefacts` | Prioritize documentation updates from git history |
| `detect_stack` | Identify project technology stack and dependencies |
| `check_style` | Detect coding conventions and implicit patterns |
| `detect_patterns` | Identify architectural patterns and refactoring candidates |

### Code Quality & Security

| Tool | Description |
|------|-------------|
| `analyze_code` | Full code quality audit with scoring and recommendations |
| `audit_security` | OWASP Top 10, secret scanning, PII analysis, dependency audit |
| `lint_interactive` | Guided interactive linting |
| `security_interactive` | Guided interactive security scanning |

### Workspace & Utilities

| Tool | Description |
|------|-------------|
| `init_workspace` | Initialize project workspace for docsgrep |
| `clone_repo` | Clone remote repositories with caching and authentication |
| `read_file` | Read files with binary detection and streaming |
| `show_help` | In-app help for all tools |
| `clear_cache` | Clean cached repositories and temporary files |
| `find_docs` | Discover README and documentation files |
| `sync_documentation` | Generate or update documentation from code changes |

---

## Installation

```bash
npm install -g docsgrep
```

Or run directly without installation:

```bash
npx docsgrep run <tool_name>
```

---

## Developer Setup

```bash
git clone https://github.com/reasvyn/docsgrep.git
cd docsgrep
npm install
npm run build
npm test
```

### Architecture

The project is organized as a Bun monorepo with a single package:

- `packages/docsgrep/src/index.ts` -- Entry point (CLI engine + MCP server)
- `packages/docsgrep/src/tools/` -- Tool handlers (one per functional area)
- `packages/docsgrep/src/utils/` -- Shared utilities (file, git, validation, scanning engines)
- `packages/docsgrep/src/config/` -- JSON configuration for limits, patterns, and language definitions

---

## Security

- All file operations resolve against strict base paths to prevent traversal
- Credentials and secrets are detected but never logged or leaked
- Built-in concurrency limiter prevents system saturation
- Binary files are detected and skipped automatically

---

## License

MIT License. See [LICENSE](LICENSE) for details.
