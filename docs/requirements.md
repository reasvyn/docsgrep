# Requirements

> **Author:** Reas Vyn &lt;reasvyn@gmail.com&gt;

This document covers the runtime prerequisites, development environment setup, and supported platforms for docsgrep.

## Runtime Requirements (Users)

| Requirement | Version |
|---|---|
| Node.js | >= 18 |
| npm, bun, or pnpm | latest stable |

docsgrep is published as an npm package. No additional dependencies are needed beyond Node.js.

### Global Install

```bash
npm install -g docsgrep
```

### Run Without Installing

```bash
npx docsgrep run <tool_name> [--param value]
```

## Development Requirements (Contributors)

| Requirement | Version | Purpose |
|---|---|---|
| [Bun](https://bun.sh/) | >= 1.0 | Package manager, runtime, and task runner |
| Node.js | >= 18 | Target runtime for compiled output |
| Git | >= 2.0 | Version control, used by git-dependent tools |

### Setup

```bash
git clone https://github.com/reasvyn/docsgrep.git
cd docsgrep
bun install
bun run build
bun run test
```

### Toolchain Versions

These are the exact versions used during development. Minor version differences should not cause issues.

| Tool | Version | Notes |
|---|---|---|
| TypeScript | ^5.3.3 | Strict mode, ES2022 target, NodeNext module resolution |
| Vitest | ^4.1.5 | Test runner with V8 coverage provider |
| tsx | ^4.21.0 | Used for running TypeScript directly in dev and MCP mode |
| simple-git | ^3.22.0 | Git operations in `clone_repo`, `check_artefacts` |
| glob | ^10.0.0 | Filesystem scanning in `FileScanner` |
| @modelcontextprotocol/sdk | ^1.29.0 | MCP server and client SDK |

## Platform Support

| Platform | Status | Notes |
|---|---|---|
| Linux | Supported | Primary development platform |
| macOS | Supported | Fully compatible |
| Windows | Supported via WSL | Native Windows not tested; use WSL for best results |

## Environment Variables

docsgrep does not require any environment variables for basic operation. The following are optionally respected:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Standard Node.js environment flag |
| `HOME` | Used for global config and plugin resolution |

## Network Requirements

- **Offline operation**: all core tools work offline. No external API calls are made.
- **Remote repos**: `clone_repo` requires network access to the target git host.
- **MCP**: the server communicates over stdio; no network ports are opened.

## Disk Space

- **Install size**: ~5 MB (node_modules + build output)
- **Workspace cache**: `.docsgrep/` directory stores cloned repos and temp files. Use `clear_cache` to reclaim space.
