# docsgrep

**docsgrep** is a high-performance Model Context Protocol (MCP) Server that empowers developers and AI agents to master complex codebases through intelligent documentation search, proactive bug detection, and semantic analysis.

## 🚀 The Vision

Modern codebases are massive, but documentation is often fragmented or stale. **docsgrep** is the bridge. It doesn't just search text; it understands project structure, import relationships, and implementation truth.

---

## 🛠️ Professional Tool Suite (24 Tools)

### 1. Intelligence & Search 🧠
| Tool | Description |
|---|---|
| `semantic_search` | **Semantic Search**: Understands natural language queries to find docs. |
| `search_docs` | **Contextual Grep**: Search with relevance ranking and `contextLines`. |
| `find_related` | **Topic Discovery**: Finds docs matching specific themes or concepts. |
| `summarize_doc` | **Auto-Summary**: Summarizes long docs into digestible bites. |

### 2. Implementation Integrity ✅
| Tool | Description |
|---|---|
| `verify_docs` | **Signature Validation**: Checks if documented functions match the code. |
| `measure_coverage` | **Docblock Coverage**: Measures how much of the code is documented. |
| `catch_bugs` | **Bug Catcher**: Finds logic flaws with smart noise reduction. |
| `check_delta` | **Delta Analysis**: Compares documentation claims against reality. |
| `check_stale` | **Staleness Detection**: Identifies docs that are outdated or out of sync. |

### 3. Context & Surroundings 🧭
| Tool | Description |
|---|---|
| `get_context` | **Radar**: Finds docs based on imports and file proximity. |
| `check_artefacts` | **Git-Aware**: Prioritizes doc updates based on recent code commits. |
| `detect_stack` | **Stack Analysis**: Identifies the project's tech stack and lock files. |
| `check_style` | **Style Sniffer**: Detects coding conventions and implicit patterns. |

### 4. Code Quality & Security 🛡️
| Tool | Description |
|---|---|
| `analyze_code` | **Enterprise Audit**: Comprehensive quality and documentation scoring. |
| `audit_security` | **Security Guard**: OWASP Top 10, Secrets, PII, and Dependency scans. |
| `lint_interactive` / `security_interactive` | **Interactive Prompts**: Targeted auditing via guided selection. |

### 5. Workspace & Utilities 🏕️
| Tool | Description |
|---|---|
| `init_workspace` | Initializes a secure workspace for temp files and reports. |
| `clone_repo` | Clones remote repos with smart caching and branch support. |
| `read_file` | Reads files with binary protection and large-file streaming. |
| `show_help` | Self-documenting help system with examples and pro-tips. |

---

## 💎 Key Feature Highlights

### 🐛 Smart Bug Detection (`catch_bugs`)
Engineered for accuracy. It doesn't just flag patterns; it understands context.
- **Try-Catch Awareness**: Doesn't complain about `await` if you've handled it.
- **Test-File Logic**: Lowers severity for issues in test files to keep focus on production.

### ✅ Signature Validation (`verify_docs`)
Documentation rot is a thing of the past.
- **Arity Check**: Validates that documented functions have the correct number of parameters.
- **Existence Check**: Ensures every documented symbol actually exists in the code.

### 🧭 Autonomous Radar (`get_context`)
The perfect companion for AI Agents.
- **Dependency Tracking**: Reads your `import` statements to suggest relevant docs.
- **Hierarchical Context**: Understands README importance and directory relationships.

### 🎯 Surgical Scope Control
All scanning tools now support advanced filtering:
- **`includePath`**: Target specific modules or files (e.g., `["src/auth/**"]`).
- **`excludePath`**: Skip irrelevant noise, merged with your project's `.gitignore`.
- **Recursive Globbing**: Full support for standard glob patterns.

### 💻 Hybrid Mode (MCP + CLI)
**docsgrep** is both an automated MCP server and a manual developer tool.
- **Human-Readable Output**: Beautifully formatted terminal reports by default.
- **Easy Integration**: Run audits directly via npm scripts or `npx`.

---

## 📦 Installation

Add **docsgrep** to your MCP client (e.g., Claude Desktop, Cursor):

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

---

## 💻 Manual CLI Mode

Beyond MCP, you can run **docsgrep** manually in your terminal. This is perfect for local audits before committing code.

### Usage
```bash
npx docsgrep run <tool_name> [--param value]
```

### Examples
```bash
# Run a code quality audit on the current directory
npx docsgrep run analyze_code

# Run a security scan and output as JSON
npx docsgrep run audit_security --format json

# Search for a pattern in documentation
npx docsgrep run search_docs --pattern "authentication" --contextLines 2
```

### Pre-configured npm Scripts
If installed locally, you can use these shortcuts:
- `npm run lint`: Quality audit.
- `npm run audit`: Security audit.
- `npm run bugs`: Bug detection.
- `npm run docs:check`: Documentation coverage.

---

## 🛠️ Developer Setup

```bash
# Clone the repository
git clone https://github.com/reasvyn/docsgrep.git
cd docsgrep

# Install and Build
npm install
npm run build

# Run Tests (Strict TS & ESM)
npm test
npm run test:coverage
```

---

## 🔒 Security

- **Safe Pathing**: All file operations are resolved against strict base paths.
- **Credential Protection**: PII and Secrets are detected but never leaked or logged.
- **Resource Limiting**: Built-in concurrency limiter prevents system saturation.

---

## 📜 License

MIT License. See [LICENSE](LICENSE) for details.

---

**Built with ❤️ for the AI-Native Engineering Era.** 🚀
