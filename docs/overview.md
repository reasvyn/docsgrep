# docsgrep Overview

> **Author:** Reas Vyn &lt;reasvyn@gmail.com&gt;

## What is docsgrep?

docsgrep is a developer tool for documentation search, code quality auditing, security scanning, and bug detection. It is available in two modes:

- **CLI devtool** -- run any of its 25 tools directly from your terminal.
- **MCP server** -- integrate with AI agents and MCP-compatible IDEs (Claude Desktop, Cursor, VS Code, OpenCode, etc.).

## Why docsgrep?

Most developer tools focus on a single concern: linting, security scanning, or documentation. docsgrep unifies these into a single interface with a consistent argument model, making it possible to:

1. **Audit a codebase in one pass** -- run `analyze_code`, `audit_security`, and `catch_bugs` sequentially or via npm script shortcuts.
2. **Keep documentation in sync** -- detect stale docs, measure coverage, and auto-generate stubs from code changes.
3. **Extend via plugins** -- add framework-specific checks (Laravel, Next.js, etc.) without modifying docsgrep itself.
4. **Feed AI agents** -- expose all tools over MCP so AI assistants can search docs, run audits, and verify code-documentation consistency.

## Core Capabilities

| Capability | Tools |
|---|---|
| Documentation search & analysis | `search_docs`, `semantic_search`, `find_related`, `summarize_doc`, `get_context` |
| Code quality auditing | `analyze_code`, `lint_interactive`, `check_style` |
| Security scanning | `audit_security`, `security_interactive` |
| Bug detection | `catch_bugs` |
| Documentation integrity | `check_stale`, `measure_coverage`, `verify_docs`, `check_delta`, `sync_documentation`, `check_artefacts` |
| Architecture analysis | `detect_patterns`, `detect_stack` |
| Workspace & utilities | `init_workspace`, `find_docs`, `clone_repo`, `read_file`, `show_help`, `clear_cache` |

## How It Fits Into Your Workflow

```
Developer writes code
        │
        ▼
  ┌─────────────┐
  │  docsgrep   │
  │  CLI / MCP  │
  └──────┬──────┘
         │
    ┌────┴────┐
    ▼         ▼
 Terminal   AI Agent
 (human)    (MCP)
```

- **Local dev**: run `npm run lint` / `npm run audit` / `npm run bugs` as part of your pre-commit or CI pipeline.
- **AI-assisted dev**: connect docsgrep as an MCP server so your AI assistant can search docs, verify consistency, and run security audits on demand.

## Further Reading

- [Architecture](architecture.md) -- system design, module boundaries, and data flow.
- [Requirements](requirements.md) -- runtime prerequisites and environment setup.
- [Conventions](conventions.md) -- coding standards, naming rules, and project conventions.
- [Index](index.md) -- complete documentation index.
