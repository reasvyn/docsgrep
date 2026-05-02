# @anovise/docsgrep

**docsgrep** is an MCP (Model Context Protocol) Server that helps developers and AI agents explore documentation, analyze code, and catch bugs with a systematic yet developer-friendly approach.

## 🎯 Philosophy

> "Catching bugs in code is like catching bugs in the wild - it requires patience, the right tools, and a systematic approach."

## 🛠️ Tool List (Developer-Friendly)

| # | Tool Name | Emoji | Description | Action |
|---|-----------|-------|-----------|------|
| 1 | `setup_camp` | 🏕️ | Setup base camp (workspace) for storing temp files, logs, and reports | Initialize |
| 2 | `spy_stack` | 🕵️ | Spy on the project's technology stack (reads package.json, go.mod, etc.) | Analyze |
| 3 | `sniff_style` | 🐕 | Sniff out project style: conventions, linters, and implicit coding patterns | Detect |
| 4 | `hunt_docs` | 🔍 | Hunt for README files and documentation inside docs/ folders | Explore |
| 5 | `fetch_repo` | 🚚 | Fetch (clone) remote repository to temp directory with smart caching | Fetch |
| 6 | `peek_file` | 👀 | Peek into the contents of a specific documentation or README file | Read |
| 7 | `purge_cache` | 🧹 | Purge (clean) old cached repositories from workspace | Clean |
| 8 | `grep_docs` | 🔎 | Grep (search) for patterns within documentation files | Search |
| 9 | `lint_code` | 🧼 | Lint code quality (enterprise-grade audit) | Audit |
| 10 | `ask_lint` | ❓ | Ask before lint - generates interactive prompt with options | Prompt |
| 11 | `catch_bugs` | 🐛 | Catch bugs: runtime errors, race conditions, memory leaks, etc. | Detect |
| 12 | `guard_security` | 🛡️ | Guard security (OWASP Top 10, secrets, privacy, dependencies) | Audit |
| 13 | `ask_guard` | ❓ | Ask before guard - generates interactive prompt with options | Prompt |

---

## 📖 Tool Details

### 1. **`setup_camp`** 🏕️ - Setup Base Camp
**Description:** Initializes docsgrep workspace. Tries system temp (`/tmp/docsgrep/`) first, falls back to `.docsgrep/` in project directory if permission denied. Auto-updates `.gitignore`.

**Arguments:**
- `projectPath` (string, required): Absolute path to the local project root.

**Example:**
```bash
setup_camp(projectPath: "/home/user/myproject")
# Success: workspace at /tmp/docsgrep/myproject (or .docsgrep/ if fallback)
```

---

### 2. **`spy_stack`** 🕵️ - Spy Technology Stack
**Description:** Spies on the project's technology stack by reading package manager files (package.json, composer.json, go.mod, Cargo.toml, etc.).

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to analyze.

**Supports:** Node.js, PHP, Go, Rust, Python, Ruby, Java, C/C++, C#, Elixir, Dart, and more.

---

### 3. **`sniff_style`** 🐕 - Sniff Code Style
**Description:** Sniffs out project style: explicit conventions, linter configs, and infers implicit coding patterns from codebase samples. Combines convention detection and code pattern analysis.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to analyze.

**What it detects:**
- ✅ Explicit conventions (ESLint, Prettier, .editorconfig, CONTRIBUTING.md)
- ✅ Implicit patterns (camelCase, snake_case, PascalCase)
- ✅ Indentation (spaces vs tabs, width)
- ✅ Quote style (single, double, backtick)
- ✅ Average line length and comment coverage

---

### 4. **`hunt_docs`** 🔍 - Hunt Documentation
**Description:** Hunts for README files and documentation inside `docs/` folders in a local directory.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to explore.

**Returns:** Array of file paths (README*, docs/**/*.md).

---

### 5. **`fetch_repo`** 🚚 - Fetch Remote Repository
**Description:** Fetches (clones) a remote git repository to a temporary directory with smart caching. If repo exists, does `git pull` for instant subsequent runs.

**Arguments:**
- `repoUrl` (string, required): URL of the git repository (e.g., https://github.com/user/repo.git).
- `branch` (string, optional): Specific branch to explore (e.g., 'docs', 'gh-pages', 'v14').
- `localProjectPath` (string, optional): Path to local project (uses `localProjectPath/.docsgrep/repos/`).
- `authToken` (string, optional): Authentication token (GitHub PAT, GitLab token, etc.).
- `sshKeyPath` (string, optional): Path to SSH private key.

**Caching:** Based on MD5 hash of repo URL. Uses `depth=1` (shallow clone) for speed.

---

### 6. **`peek_file`** 👀 - Peek File
**Description:** Peeks into the contents of a specific documentation or README file. Includes binary file detection and truncation for large files (>500KB).

**Arguments:**
- `filePath` (string, required): Absolute path to the file to read.

**Features:**
- ✅ Binary file detection (rejects binary)
- ✅ Streaming for large files
- ✅ Path validation (prevents path traversal)

---

### 7. **`purge_cache`** 🧹 - Purge Old Cache
**Description:** Purges (cleans) old cached repositories from the `.docsgrep/repos/` directory. Removes repos older than max age (default: 7 days).

**Arguments:**
- `localProjectPath` (string, required): Absolute path to the local project containing `.docsgrep` workspace.
- `maxAgeDays` (number, optional): Maximum age in days for cached repos (default: 7).

**Monitoring:** Checks cache size (1GB limit). Warns if exceeded.

---

### 8. **`grep_docs`** 🔎 - Grep Documentation
**Description:** Greps (searches) for a regex pattern within documentation files (README, docs/**/*.md) in a local directory.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to search.
- `pattern` (string, required): The regex pattern to search for.
- `filePattern` (string, optional): Regex pattern to filter which documentation files to search (e.g., 'README.*').

**Returns:** Array of { file, line, content } with line numbers.

---

### 9. **`lint_code`** 🧼 - Lint Code Quality (Enterprise-Grade)
**Description:** Lints code quality with enterprise-grade analysis. Analyzes tech stack, conventions, and applies industry best practices to detect issues like dead code, god classes, SOC violations, and more.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to audit.
- `filePatterns` (array of strings, optional): Glob patterns to specify files (e.g., ['src/**/*.tsx']).
- `focusAreas` (array of strings, optional): Focus areas: 'dead_code', 'structure', 'performance', 'naming', 'all'.

**Scoring:**
- 📊 **Documentation Score** (0-100): Based on README, docs/, linter config, tests, CI/CD.
- 🧼 **Code Quality Score** (0-100): Based on issues per file.
- 🎯 **Strengths**: What the project does well.
- 💡 **Recommendations**: Prioritized by severity (critical → high → medium → low).

**Language Agnostic:** JS/TS, Python, Go, Rust, Ruby, Java, C/C++, C#, PHP, Swift, Dart, Elixir - works with ALL!

---

### 10. **`ask_lint`** ❓ - Ask Before Lint
**Description:** Asks (generates prompt) before linting. Shows detected tech stack and available linting options.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory.

**Returns:** Interactive prompt with choices: Full Audit, Documentation Check, Structure Audit, Code Smells, Custom Focus.

---

### 11. **`catch_bugs`** 🐛 - Catch Bugs (Professional Bug Detection)
**Description:** Catches bugs, errors, warnings, and potential issues: runtime errors, race conditions, memory leaks, dependency coupling, and performance issues with large data handling.

**This is NOT security audit or code quality audit** - it focuses on actual bugs that could cause runtime failures!

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to analyze.
- `filePatterns` (array of strings, optional): Glob patterns (e.g., ['src/**/*.ts']).

**6 Detection Categories:**

#### 🔍 **1. Runtime Errors**
- Unhandled Promise Rejections (`.then()` without `.catch()`)
- Null/Undefined Dereference (property access without null checks)
- Uninitialized Variables
- Type Coercion Issues (loose equality `==`)

#### 🏃 **2. Race Conditions**
- Unsynchronized Shared State (shared variable modifications)
- Missing Async/Await (mixing async patterns)
- Concurrent Modification (array modification during iteration)

#### 💾 **3. Memory Leaks**
- Event Listener Leaks (listeners added without removal)
- Uncleared Intervals/Timers (`setInterval` without `clearInterval`)
- Large Object References (caches without size limits)
- Closure Memory Leaks (closures retaining large scopes)

#### 🔗 **4. Dependency Coupling**
- Circular Dependencies (mutual dependencies between modules)
- Tight Coupling (excessive direct instantiation, many imports)
- God Object/Module (modules with too many exports)

#### ⚡ **5. Performance Issues (Large Data)**
- Inefficient Loops (loop conditions recalculating `.length`)
- Synchronous Large File Operations (`readFileSync` - blocking event loop)
- Memory-Heavy Operations (chained array operations, large JSON parsing)
- Unbounded Recursion (recursive functions without depth limits)

#### 📝 **6. Unresolved Issues**
- TODO/FIXME/HACK comments
- Console/Debug Statements (should be removed for production)
- Deprecated API Usage (e.g., `Date.getYear()`)

**Bug Score (0-100):**
- Higher is better!
- Deducts points for critical/high issues and bug density.
- **Risk Levels:** Low (90-100), Medium (70-89), High (50-69), Critical (<50).

**Professional Features:**
- ✅ **Structured Detection** - 6 major categories, 20+ pattern types
- ✅ **Severity Scoring** - critical/high/medium/low/info
- ✅ **Actionable Remediation** - Specific fix suggestions
- ✅ **Self-Exclusion** - Won't false-positive on its own source
- ✅ **Language Agnostic** - Works with any language
- ✅ **Detailed Reports** - File, line, evidence, impact, remediation

---

### 12. **`guard_security`** 🛡️ - Guard Security (Enterprise-Grade)
**Description:** Guards your code with enterprise-grade security audit covering OWASP Top 10, ISO/IEC 27001, secrets detection, privacy (GDPR/CCPA), and dependency vulnerabilities.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to audit.
- `filePatterns` (array of strings, optional): Glob patterns (e.g., ['**/*.js', '**/*.env']).

**OWASP Top 10 (2021) Coverage:**
- 🔓 **A01: Broken Access Control** - IDOR, missing authorization
- 🔐 **A02: Cryptographic Failures** - Weak hashing, insecure random
- 💉 **A03: Injection** - SQL, NoSQL, XSS, Command injection
- 🏗️ **A04: Insecure Design** - Missing security design
- ⚙️ **A05: Security Misconfiguration** - Debug mode, CORS wildcard
- 🔑 **A07: Identification and Authentication Failures** - Weak auth
- 📦 **A08: Software and Data Integrity Failures** - Insecure deserialization
- 📊 **A09: Security Logging and Monitoring Failures** - Missing audit logs
- 🌐 **A10: Server-Side Request Forgery (SSRF)** - Unvalidated URL fetching

**Secrets Detection:**
- AWS Access Keys, GitHub Tokens (ghp_), Google API Keys (AIza)
- Slack Tokens, Private Keys, Generic API Keys

**Privacy & Compliance:**
- PII Detection (Email, Phone, Credit Card, SSN, IP)
- GDPR/CCPA Compliance
- ISO/IEC 27001 Check

**Dependency Security:**
- Vulnerable packages (npm audit integration)
- Outdated dependencies (floating versions)
- Lock file verification

**Security Score (0-100):**
- **Risk Levels:** Low, Medium, High, Critical
- **Remediation steps** with references

---

### 13. **`ask_guard`** ❓ - Ask Before Guard
**Description:** Asks (generates prompt) before guarding. Shows what will be scanned (OWASP, secrets, privacy, dependencies) and available options.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory.

**Returns:** Interactive prompt with choices: Full Security Audit, OWASP Only, Secrets Scan, Privacy & Compliance, Dependency Audit.

---

## 🚀 Quick Start

### Installation (via npx)
Add to your MCP client config (Claude Desktop, etc.):

```json
{
  "mcpServers": {
    "docsgrep": {
      "command": "npx",
      "args": ["-y", "@anovise/docsgrep"]
    }
  }
}
```

### Local Development
```bash
git clone <repo-url> && cd docsgrep
npm install
npm run build
npm run dev
```

### Testing
```bash
npm run test          # Run tests once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

---

## 📂 Project Structure

```
docsgrep/
├── src/
│   ├── index.ts           # Main MCP server, tool definitions, request handlers
│   ├── project-style.ts   # Sniff style (combined conventions + patterns)
│   ├── audit.ts          # Audit orchestrator
│   ├── best-practices.ts # Universal code quality analyzer
│   ├── bug-catcher.ts   # Catch bugs (runtime errors, race, memory, etc.)
│   └── security-audit.ts # Guard security (OWASP, ISO, GDPR)
├── tests/
│   ├── unit/            # Unit tests for internal logic
│   └── integration/     # MCP server and tool integration tests
├── build/              # Compiled JavaScript (generated)
├── README.md           # This documentation
├── package.json
└── tsconfig.json
```

---

## 🔒 Security & Best Practices

- ✅ Path validation (prevents path traversal)
- ✅ Repo URL validation (only http, https, git, ssh protocols)
- ✅ Binary file detection (rejects binary in peek_file)
- ✅ Concurrency limiter (max 5 concurrent operations)
- ✅ Structured logging (JSON format)
- ✅ Self-exclusion (tools won't false-positive on their own source)
- ✅ Workspace fallback (system temp → project local)

---

## 💡 Tips for Developers

1. **Use `spy_stack`** first to understand the project's tech stack.
2. **`sniff_style`** to understand coding conventions before making changes.
3. **`catch_bugs`** regularly to catch bugs before production.
4. **`lint_code`** and **`guard_security`** for periodic audits (CI/CD).
5. **`ask_lint`** and **`ask_guard`** generate interactive prompts before auditing.
6. **Setup `setup_camp`** once at the beginning of your project.

---

## 🤝 Contributing

1. Fork the repo and `git clone`
2. `npm install && npm run build`
3. Create your feature branch (`git checkout -b feature/amazing-feature`)
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file.

---

## 📞 Contact

Bug reports, feature requests, or questions: **reasvyn@gmail.com**

---

**Happy coding, and may your bugs be easily caught!** 🐛✨
