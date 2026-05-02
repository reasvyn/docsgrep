# @anovise/docsgrep

An MCP (Model Context Protocol) Server designed to efficiently explore local and remote codebases to extract context and documentation. It specifically focuses on locating and reading `README` files and documentation inside `docs/` directories.

## Features

- **System-Wide Temp Storage:** All temporary files stored in `/tmp/docsgrep/` - no project pollution, no `.docsgrep/` directory needed.
- **Local Exploration:** Quickly scan a local directory to find all `README` and `docs/*.md` files.
- **Remote Exploration:** Clone a remote git repository (using a fast `git clone --depth 1`) into system temp directory. Supports authentication for private repos. Supports retry logic with exponential backoff.
- **File Reading:** Read the contents of the identified documentation files directly into your LLM context. Includes binary file detection and streaming for large files (>500KB).
- **Search Documentation:** Search for patterns within documentation files using regex with the `search_docs` tool.
- **Cache Management:** Clean up old cached repositories with the `cleanup_cache` tool. Includes cache size monitoring (1GB limit).
- **Tech Stack Analysis:** Identify project dependencies from multiple package managers (Node.js, PHP, Go, Rust, Python, Ruby, Java, C++, C#, Elixir, Dart, etc.).
- **Convention Gathering:** Collect linter configs, editor configs, and contributing guidelines to understand project standards.
- **Code Pattern Sampling:** Sample representative source files to infer implicit coding conventions.
- **Concurrency Control:** Operations are limited to 5 concurrent executions to prevent system overload.
- **Structured Logging:** JSON-formatted logs for better observability.

## Installation & Usage

You can use this MCP server directly via `npx` in any MCP client (like Claude Desktop) without needing to install it globally.

### Claude Desktop Configuration

Add the following to your `claude_desktop_config.json`:

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

## Available Tools

1. `init_workspace`
    - **Description**: Initializes docsgrep workspace metadata. Temporary files are stored system-wide in `/tmp/docsgrep/`. No `.docsgrep/` directory is created in your project.
    - **Arguments**:
      - `projectPath` (string): The absolute path to the local project root.

2. `analyze_project_tech_stack`
   - **Description**: Analyzes a local directory to identify the project's technology stack by reading package manager files (e.g., `package.json`, `composer.json`, `go.mod`, `Cargo.toml`, etc.). Provides the contents of these files (up to 50KB each) to give the LLM instant context on project dependencies.
   - **Arguments**:
     - `dirPath` (string): The absolute path to the local directory.

3. `gather_project_conventions`
   - **Description**: Gathers project conventions, linters, and architectural guidelines using fuzzy matching (e.g., `**/*lint*`, `**/*style*.md`, `CONTRIBUTING.md`, `.editorconfig`) to provide context for AI-driven code quality audits. Completely agnostic to the tech stack.
   - **Arguments**:
     - `dirPath` (string): The absolute path to the local directory to scan.

4. `sample_codebase_patterns`
   - **Description**: Samples a few representative source code files from the project. Use this when a project lacks explicit documentation or linter configs to allow the AI to infer implicit coding conventions and style directly from the code.
   - **Arguments**:
     - `dirPath` (string): The absolute path to the local directory to sample.

5. `explore_local_docs`
   - **Description**: Explores a local directory to find README files and documentation inside `docs/` folders.
   - **Arguments**:
     - `dirPath` (string): The absolute path to the local directory.

6. `explore_remote_repo`
   - **Description**: Clones a remote git repository and finds documentation. Leverages smart caching (doing a `git pull` if it already exists) based on MD5 hashes of repo URLs to make subsequent runs instantaneous without re-cloning.
   - **Arguments**:
     - `repoUrl` (string): The URL of the git repository.
     - `branch` (string, optional): Specific branch to explore (e.g., 'docs').
     - `localProjectPath` (string, optional): The absolute path to your local project. If provided, the repo will be cloned into `[localProjectPath]/.docsgrep/repos/` instead of the global OS temp directory.

 7. `read_doc_file`
    - **Description**: Reads the contents of a specific documentation or README file. Includes binary file detection and path validation.
    - **Arguments**:
      - `filePath` (string): The absolute path to the file to read.

 8. `cleanup_cache`
    - **Description**: Cleans up old cached repositories in `/tmp/docsgrep/`. Removes repos older than the specified max age (default: 7 days). Monitors cache size (1GB limit).
    - **Arguments**:
      - `localProjectPath` (string): The absolute path to the local project (used to identify project-specific cache).
      - `maxAgeDays` (number, optional): Maximum age in days for cached repos (default: 7).

 9. `search_docs`
    - **Description**: Searches for a regex pattern within documentation files (README, docs/**/*.md) in a local directory. Returns matching lines with file path and line number.
    - **Arguments**:
      - `dirPath` (string): The absolute path to the local directory to search.
      - `pattern` (string): The regex pattern to search for in documentation files.
      - `filePattern` (string, optional): Regex pattern to filter which documentation files to search (e.g., 'README.*').

10. `audit_code_quality`
    - **Description**: Performs an enterprise-grade code quality audit. Analyzes tech stack, conventions, and applies industry best practices to detect issues like dead code, god classes, SOC violations, naming conventions, and more.
    - **Arguments**:
      - `dirPath` (string): The absolute path to the local directory to audit.
      - `filePatterns` (array of strings, optional): Array of glob patterns to specify which files to audit (e.g., ['src/**/*.tsx']).
      - `focusAreas` (array of strings, optional): Focus audit on specific areas: 'dead_code', 'structure', 'performance', 'naming', 'all'.

 11. `get_audit_prompt`
    - **Description**: Generates an interactive prompt to ask the user what they want to audit. Helps guide the audit process by showing detected tech stack and available options.
    - **Arguments**:
      - `dirPath` (string): The absolute path to the local directory.

 12. `catch_bugs`
    - **Description**: Catches bugs, errors, warnings, and potential issues in code: race conditions, memory leaks, runtime errors, dependency coupling, and performance issues with large data handling.
    - **Arguments**:
      - `dirPath` (string): The absolute path to the local directory to analyze.
      - `filePatterns` (array of strings, optional): Array of glob patterns to specify which files to scan (e.g., ['src/**/*.ts']).

 13. `get_security_audit_prompt`
    - **Description**: Generates an interactive prompt for security auditing. Shows what will be scanned (OWASP Top 10, secrets, privacy, dependencies) and available options.
    - **Arguments**:
      - `dirPath` (string): The absolute path to the local directory.

 14. `security_audit`
    - **Description**: Performs an enterprise-grade security audit covering OWASP Top 10, ISO/IEC 27001, secrets detection, privacy (GDPR/CCPA), and dependency vulnerabilities. Provides comprehensive security analysis with remediation steps.
    - **Arguments**:
      - `dirPath` (string): The absolute path to the local directory to audit.
      - `filePatterns` (array of strings, optional): Array of glob patterns to specify which files to scan (e.g., ['**/*.js', '**/*.env']).

## 🐛 Bug Catcher (catch_bugs) - Professional Bug Detection

The `catch_bugs` tool provides **comprehensive bug detection** that focuses on real runtime issues:

### 🔍 What It Detects

#### 1. **Runtime Errors**
- **Unhandled Promise Rejections** - `.then()` without `.catch()`, `await` without `try-catch`
- **Null/Undefined Dereference** - Property access without null checks
- **Uninitialized Variables** - Variables declared but not initialized
- **Type Coercion Issues** - Loose equality (`==`) that may cause unexpected behavior

#### 2. **Race Conditions**
- **Unsynchronized Shared State** - Shared variable modifications without synchronization
- **Missing Async/Await** - Mixing async patterns inconsistently
- **Concurrent Modification** - Array/object modification during iteration

#### 3. **Memory Leaks**
- **Event Listener Leaks** - Listeners added without removal
- **Uncleared Intervals/Timers** - `setInterval` without `clearInterval`
- **Large Object References** - Caches or collections without size limits
- **Closure Memory Leaks** - Deep closures retaining large scopes

#### 4. **Dependency Coupling**
- **Circular Dependencies** - Mutual dependencies between modules
- **Tight Coupling** - Excessive direct instantiation, many imports
- **God Object/Module** - Modules with too many exports (violating Single Responsibility)

#### 5. **Performance Issues (Large Data Handling)**
- **Inefficient Loops** - Loop conditions recalculating `.length` each iteration
- **Synchronous Large File Operations** - `readFileSync`/`writeFileSync` blocking event loop
- **Memory-Heavy Operations** - Chained array operations, large JSON parsing
- **Unbounded Recursion** - Recursive functions without depth limits

#### 6. **Unresolved Issues**
- **TODO/FIXME/HACK** - Unresolved comments indicating known issues
- **Console/Debug Statements** - Debug code left in production
- **Deprecated API Usage** - Using deprecated functions (e.g., `Date.getYear()`)

### 📊 Bug Score & Risk Assessment
- **Bug Score** (0-100): Higher is better
  - Calculated based on severity, density, and issue types
  - Deducts points for critical/high issues and bug density
- **Risk Levels**:
  - **Low** (90-100): Minimal bug risk
  - **Medium** (70-89): Some issues to address
  - **High** (50-69): Significant bug risk
  - **Critical** (<50): Urgent bugs need fixing

### 🎯 Categories & Status
Each category shows:
- **pass** - No issues detected ✓
- **warning** - Some issues found ⚠️
- **fail** - Critical issues present ✗

### 💼 Professional Features
- ✅ **Structured Detection** - 6 major categories, 20+ pattern types
- ✅ **Severity Scoring** - critical/high/medium/low/info
- ✅ **Actionable Remediation** - Specific fix suggestions for each issue
- ✅ **Self-Exclusion** - Won't false-positive on its own source code
- ✅ **Language Agnostic** - Works with JS, TS, Python, Go, Rust, etc.
- ✅ **Detailed Reports** - File, line number, evidence, impact, remediation

### 📂 Works With Any Project
- ✅ Node.js / TypeScript (Express, Next.js, etc.)
- ✅ Python (Django, Flask, FastAPI)
- ✅ Go, Rust, Ruby, Java, C/C++, C#, PHP, Swift, Dart
- ✅ No configuration needed - analyzes YOUR code automatically

## Enterprise-Grade Code Quality Audit (Language-Agnostic)

The `audit_code_quality` tool provides **universal** code analysis that works across ALL programming languages and tech stacks:

### 🔍 What It Checks (Universal)
- **Dead Code**: Unused variables, functions, duplicate code (DRY violations)
- **Code Structure**: Overly long files/functions, God objects (Single Responsibility)
- **Readability**: Deep nesting, long lines, magic numbers
- **Technical Debt**: TODO/FIXME comments, missing documentation
- **Naming Conventions**: Auto-detects camelCase, snake_case, PascalCase, UPPER_SNAKE
- **Code Style**: Auto-detects indentation (spaces/tabs), quote style, comment patterns
- **Project Organization**: Documentation coverage, linter config, tests, CI/CD

### 🧠 How It Works (Pattern-Based Analysis)
1. **No Tech Stack Assumptions**: Doesn't assume specific frameworks or languages
2. **Automatic Pattern Detection**: 
   - Analyzes actual code to detect naming styles (camelCase, snake_case, etc.)
   - Detects indentation preferences (spaces vs tabs, width)
   - Identifies quote styles (single, double, backtick)
   - Measures average line length and comment coverage
3. **Documentation Inference**: When docs are missing, reads patterns FROM the code itself
4. **Universal Code Smells**: Detects issues that apply to ALL languages (nesting, length, duplication)

### 📊 Audit Scores
- **Documentation Score** (0-100): Based on README, docs/, linter config, tests, CI
- **Code Quality Score** (0-100): Based on issues found per file
- **Strengths Identified**: What the project does well
- **Actionable Recommendations**: Prioritized by severity (critical → high → medium → low)

### 🎯 Audit Workflow
1. **`get_audit_prompt`**: Generates interactive prompt showing detected project structure
2. **`audit_code_quality`**: Runs comprehensive universal audit
3. **Review Report**: JSON report with findings, scores, and recommendations
4. **AI Agent Integration**: Use detailed suggestions to fix issues automatically

### 📂 Works With Any Project
- ✅ JavaScript / TypeScript (React, Next.js, Vue, Angular, etc.)
- ✅ Python (Django, Flask, FastAPI, etc.)
- ✅ Go, Rust, Ruby, Java, C/C++, C#, PHP, Swift, Dart, Elixir, and more
- ✅ No configuration needed - adapts to YOUR project's conventions

## 🔒 Enterprise Security Audit

The `security_audit` tool provides **comprehensive security analysis** based on industry standards:

### 🛡️ OWASP Top 10 (2021) Coverage
- **A01: Broken Access Control** - IDOR, missing authorization
- **A02: Cryptographic Failures** - Weak hashing (MD5/SHA1), insecure random
- **A03: Injection** - SQL, NoSQL, XSS, Command injection
- **A04: Insecure Design** - Missing security design
- **A05: Security Misconfiguration** - Debug mode, CORS wildcard, insecure defaults
- **A07: Identification and Authentication Failures** - Weak auth, session issues
- **A08: Software and Data Integrity Failures** - Insecure deserialization, eval()
- **A09: Security Logging and Monitoring Failures** - Missing audit logs
- **A10: Server-Side Request Forgery (SSRF)** - Unvalidated URL fetching

### 🔑 Secrets Detection
- AWS Access Keys, Secret Keys
- GitHub Tokens (ghp_)
- Google API Keys (AIza)
- Slack Tokens
- Private Keys (BEGIN PRIVATE KEY)
- Generic API Keys, Passwords in code

### 🔐 Privacy & Compliance
- **PII Detection**: Email, Phone, Credit Card, SSN, IP Address
- **GDPR/CCPA**: PII in logs, client-side PII exposure
- **ISO/IEC 27001**: Management of vulnerabilities, access control, record protection
- **Data Handling**: Secure logging, masking, consent

### 📦 Dependency Security
- Vulnerable packages detection
- Outdated dependencies (floating versions)
- Lock file verification
- Integration with npm audit/pip-audit

### 🎯 Security Audit Workflow
1. **`get_security_audit_prompt`**: Shows what will be scanned (OWASP, secrets, privacy, dependencies)
2. **`security_audit`**: Runs full enterprise security analysis
3. **Review Report**:
   - **Security Score** (0-100) with Risk Level (Critical/High/Medium/Low)
   - **OWASP Top 10 Status**: Compliance per category
   - **Secrets Found**: With file, line, type (truncated for security)
   - **Privacy Issues**: PII handling, compliance violations
   - **Compliance Status**: ISO/IEC 27001 check
   - **Actionable Remediation**: Prioritized by severity with references
4. **Fix & Monitor**: Use recommendations to secure your code

### 🏢 Enterprise Features
- ✅ **Language Agnostic**: Works with ANY programming language
- ✅ **Industry Standards**: OWASP, ISO/IEC, GDPR, CCPA, HIPAA-ready
- ✅ **Zero Config**: Auto-detects project structure and risks
- ✅ **Actionable Output**: Line numbers, evidence, impact, remediation
- ✅ **CI/CD Ready**: JSON output for automation

## Local Development

1. Clone the repository.
2. Run `npm install`.
3. Run `npm run build` to compile the TypeScript files.
4. Run `npm run dev` or use the test script to test locally.
5. Run `npm run test` to run the test suite.
6. Run `npm run test:coverage` to check test coverage.

## Testing

The project uses Vitest for testing. Run the following commands:

```bash
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Security

- All file paths are validated to prevent path traversal attacks.
- Repository URLs are validated to ensure they use safe protocols (http, https, git, ssh).
- Binary files are detected and rejected when reading.
- Concurrent operations are limited to prevent resource exhaustion.

## Community

- For bugs and feature requests, please open an issue.
- Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## Contact

For public communication, inquiries, or support, please contact: **reasvyn@gmail.com**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
