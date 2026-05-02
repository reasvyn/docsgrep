# @anovise/docsgrep

An MCP (Model Context Protocol) Server designed to efficiently explore local and remote codebases to extract context and documentation. It specifically focuses on locating and reading `README` files and documentation inside `docs/` directories.

## Features

- **Workspace Initialization:** Set up an isolated `.docsgrep` workspace in your project to store temporary clones, logs, and reports without polluting your working directory.
- **Local Exploration:** Quickly scan a local directory to find all `README` and `docs/*.md` files.
- **Remote Exploration:** Clone a remote git repository (using a fast `git clone --depth 1`) directly into your `.docsgrep/tmp` workspace and extract its documentation. Supports retry logic with exponential backoff.
- **File Reading:** Read the contents of the identified documentation files directly into your LLM context. Includes binary file detection.
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
   - **Description**: Initializes a `.docsgrep` workspace in the specified project directory. Automatically updates `.gitignore` to prevent these temporary files from being tracked.
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
    - **Description**: Cleans up old cached repositories in the `.docsgrep` workspace. Removes repos older than the specified max age (default 7 days). Monitors cache size (1GB limit).
    - **Arguments**:
      - `localProjectPath` (string): The absolute path to the local project containing `.docsgrep` workspace.
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

## Enterprise-Grade Code Quality Audit

The `audit_code_quality` tool provides comprehensive code analysis:

### What It Checks
- **Dead Code**: Unused imports, variables, functions
- **Code Structure**: God classes/functions, file size violations
- **Performance**: React performance anti-patterns, unnecessary re-renders
- **Naming Conventions**: PEP 8 (Python), PascalCase (React components), etc.
- **Framework Best Practices**: Next.js App Router, data fetching patterns
- **Standards Compliance**: SOC (Separation of Concerns), DRY, SOLID principles

### Best Practices Included
- **Generic**: Applicable to all codebases
- **Next.js**: App Router, Server/Client Components, data fetching
- **React**: Component structure, performance optimization
- **Python**: PEP 8 compliance
- **Tech Stack Specific**: Based on detected package managers and frameworks

### Audit Workflow
1. Use `get_audit_prompt` to see what can be audited
2. Run `audit_code_quality` with optional focus areas
3. Review the report with findings and recommendations
4. Apply fixes using AI agents with the detailed suggestions provided

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
