# Documentation Index

> **Author:** Reas Vyn &lt;reasvyn@gmail.com&gt;

## Project Documentation

| Document | Description |
|---|---|
| [overview.md](overview.md) | What docsgrep is, why it exists, and how it fits into your workflow |
| [architecture.md](architecture.md) | System design, module boundaries, data flow, and key patterns |
| [requirements.md](requirements.md) | Runtime prerequisites, development setup, platform support |
| [conventions.md](conventions.md) | Coding standards, naming rules, testing and git conventions |
| [PLUGIN_GUIDE.md](PLUGIN_GUIDE.md) | How to write and publish docsgrep plugins |

## Tool Documentation

### Discovery & Setup

| Tool | Description |
|---|---|
| [`init_workspace`](tools/init_workspace.md) | Initialize workspace and .gitignore |
| [`detect_stack`](tools/detect_stack.md) | Analyze project technology stack |
| [`check_style`](tools/check_style.md) | Detect coding conventions and patterns |
| [`find_docs`](tools/find_docs.md) | Discover READMEs and documentation folders |
| [`clone_repo`](tools/clone_repo.md) | Clone and analyze remote repositories |

### Content & Search

| Tool | Description |
|---|---|
| [`read_file`](tools/read_file.md) | Read documentation file contents safely |
| [`search_docs`](tools/search_docs.md) | Regex search within documentation |
| [`semantic_search`](tools/semantic_search.md) | Semantic/natural language search |
| [`summarize_doc`](tools/summarize_doc.md) | Concise documentation summarization |

### Auditing & Quality

| Tool | Description |
|---|---|
| [`analyze_code`](tools/analyze_code.md) | Enterprise-grade code quality audit |
| [`audit_security`](tools/audit_security.md) | OWASP, secrets, and privacy audit |
| [`catch_bugs`](tools/catch_bugs.md) | Detect runtime errors and logic flaws |
| [`lint_interactive`](tools/lint_interactive.md) | Interactive prompt for linting options |
| [`security_interactive`](tools/security_interactive.md) | Interactive prompt for security options |

### Maintenance & Sync

| Tool | Description |
|---|---|
| [`check_stale`](tools/check_stale.md) | Identify outdated or out-of-sync docs |
| [`measure_coverage`](tools/measure_coverage.md) | Measure docblock coverage in source code |
| [`sync_documentation`](tools/sync_documentation.md) | Update documentation based on code changes |
| [`verify_docs`](tools/verify_docs.md) | Verify doc accuracy against source code |
| [`check_delta`](tools/check_delta.md) | Detail differences between docs and code |
| [`check_artefacts`](tools/check_artefacts.md) | Prioritize doc updates based on git history |

### Context & Help

| Tool | Description |
|---|---|
| [`get_context`](tools/get_context.md) | Proactive context for current task |
| [`show_help`](tools/show_help.md) | Comprehensive in-app help for docsgrep |
| [`clear_cache`](tools/clear_cache.md) | Clean up old cached repositories |

## Related

- [Root README](../README.md) -- installation, quickstart, and tool overview.
- [CONTRIBUTING.md](../CONTRIBUTING.md) -- setup, conventions, and PR expectations.
