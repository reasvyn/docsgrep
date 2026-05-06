/**
 * Static tool definitions for the MCP server
 */
export const CORE_TOOL_DEFINITIONS = [
  {
    name: "setup_camp",
    description: "Sets up a docsgrep base camp in the specified project directory to store temporary files, logs, and reports. Also automatically updates the .gitignore file.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "The absolute path to the local project root.",
        },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "spy_stack",
    description: "Spies on the project's technology stack by reading package manager files (e.g., package.json, composer.json, go.mod, Cargo.toml).",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to analyze.",
        },
        excludePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to exclude from scanning.",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "sniff_style",
    description: "Sniffs out project style: conventions, linters, and infers implicit coding patterns from codebase samples. Combines convention detection and code pattern analysis.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to analyze.",
        },
        excludePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to exclude from scanning.",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "hunt_docs",
    description: "Hunts for README files and documentation inside docs/ folders in a local directory.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to explore.",
        },
        includePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to include in scanning.",
        },
        excludePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to exclude from scanning.",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "fetch_repo",
    description: "Fetches a remote git repository to a temporary directory and finds documentation. Supports authentication for private repos.",
    inputSchema: {
      type: "object",
      properties: {
        repoUrl: {
          type: "string",
          description: "The URL of the git repository (e.g., https://github.com/user/repo.git).",
        },
        branch: {
          type: "string",
          description: "Optional. Specific branch to explore (e.g., 'docs', 'main').",
        },
        tag: {
          type: "string",
          description: "Optional. Specific tag or version to explore (e.g., 'v1.0.0'). Overrides branch if both are provided.",
        },
        authToken: {
          type: "string",
          description: "Optional. Authentication token for private repositories (GitHub PAT, GitLab token, etc.). For HTTPS URLs, this will be added to the URL.",
        },
        sshKeyPath: {
          type: "string",
          description: "Optional. Path to SSH private key for authentication. Uses ssh-agent or GIT_SSH_COMMAND.",
        },
        localProjectPath: {
          type: "string",
          description: "Optional. The absolute path to the local project to use its .docsgrep workspace for storing cloned repositories.",
        },
      },
      required: ["repoUrl"],
    },
  },
  {
    name: "peek_file",
    description: "Peeks into the contents of a specific documentation or README file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file to read.",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "purge_cache",
    description: "Purges old cached repositories from the .docsgrep workspace. Removes repos older than the specified max age (default 7 days).",
    inputSchema: {
      type: "object",
      properties: {
        localProjectPath: {
          type: "string",
          description: "The absolute path to the local project containing .docsgrep workspace.",
        },
        maxAgeDays: {
          type: "number",
          description: "Maximum age in days for cached repos (default: 7).",
        },
      },
      required: ["localProjectPath"],
    },
  },
  {
    name: "grep_docs",
    description: "Greps for a pattern within documentation files (README, docs/**/*.md) in a local directory. Returns matching lines with file path and line number. Results ranked by relevance.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to search.",
        },
        pattern: {
          type: "string",
          description: "The regex pattern to search for in documentation files.",
        },
        filePattern: {
          type: "string",
          description: "Optional. Regex pattern to filter which documentation files to search (e.g., 'README.*').",
        },
        contextLines: {
          type: "number",
          description: "Optional. Number of surrounding context lines to include (max 5).",
        },
        includePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to include in scanning.",
        },
        excludePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to exclude from scanning.",
        },
      },
      required: ["dirPath", "pattern"],
    },
  },
  {
    name: "lint_code",
    description: "Performs an enterprise-grade code quality audit (linting). Analyzes tech stack, conventions, and applies industry best practices to detect issues like dead code, god classes, SOC violations, and more.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to audit.",
        },
        filePatterns: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Array of glob patterns to specify which files to audit (e.g., ['src/**/*.tsx']).",
        },
        focusAreas: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Focus audit on specific areas: 'dead_code', 'structure', 'performance', 'naming', 'all'.",
        },
        includePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to include in scanning.",
        },
        excludePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to exclude from scanning.",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "ask_lint",
    description: "Asks what you want to lint. Generates an interactive prompt showing detected tech stack and available linting options.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory.",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "guard_security",
    description: "Guards your code with enterprise-grade security audit covering OWASP Top 10, ISO/IEC 27001, secrets detection, privacy (GDPR/CCPA), and dependency vulnerabilities. Provides comprehensive security analysis with remediation steps.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to audit.",
        },
        filePatterns: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Array of glob patterns to specify which files to scan (e.g., ['**/*.js', '**/*.env']).",
        },
        includePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to include in scanning.",
        },
        excludePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to exclude from scanning.",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "ask_guard",
    description: "Asks before guarding. Shows what will be scanned (OWASP Top 10, secrets, privacy, dependencies) and available options.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory.",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "catch_bugs",
    description: "Catches bugs, errors, warnings, and potential issues in code: race conditions, memory leaks, runtime errors, dependency coupling, and performance issues with large data handling.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to analyze.",
        },
        filePatterns: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Array of glob patterns to specify which files to scan (e.g., ['src/**/*.ts']).",
        },
        includePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to include in scanning.",
        },
        excludePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to exclude from scanning.",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "fathom_meaning",
    description: "Searches documentation based on meaning (semantic search), not just keyword matching. Understands natural language queries and finds relevant docs.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to search.",
        },
        query: {
          type: "string",
          description: "Natural language query about what you're looking for.",
        },
        topK: {
          type: "number",
          description: "Optional. Number of top results to return (default: 5).",
        },
      },
      required: ["dirPath", "query"],
    },
  },
  {
    name: "tldr_docs",
    description: "Automatically summarizes specific documentation files into concise, digestible chunks. Gets the essence without the noise.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the documentation file to summarize.",
        },
        maxLength: {
          type: "number",
          description: "Optional. Maximum summary length in characters (default: 500).",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "hunt_related",
    description: "Hunts for documentation related to a specific topic, pattern, or concept. Uses similarity matching to find docs that cover the same domain.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to search.",
        },
        topic: {
          type: "string",
          description: "Topic or concept to find related docs for.",
        },
        threshold: {
          type: "number",
          description: "Optional. Similarity threshold 0-1 (default: 0.7).",
        },
      },
      required: ["dirPath", "topic"],
    },
  },
  {
    name: "smell_stale",
    description: "Sniffs out documentation that has gone stale - not updated in 30+ days or out of sync with the actual code.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local directory to check.",
        },
        maxAgeDays: {
          type: "number",
          description: "Optional. Maximum age in days before considered stale (default: 30).",
        },
        compareWithCode: {
          type: "boolean",
          description: "Optional. Also check if docs match current code (default: true).",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "sync_docs",
    description: "Automatically creates or updates documentation based on code changes. Detects new methods, changed signatures, and generates doc stubs.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local project.",
        },
        filePaths: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Specific files that changed (default: auto-detect from git).",
        },
        updateMode: {
          type: "string",
          description: "Optional. 'create', 'update', or 'both' (default: 'update').",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "verify_truth",
    description: "Checks consistency between code and documentation. Verifies that all documented methods actually exist and that parameters match reality.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local project.",
        },
        docPath: {
          type: "string",
          description: "The path to the documentation file to validate.",
        },
        strictMode: {
          type: "boolean",
          description: "Optional. Fail on warnings too (default: false).",
        },
      },
      required: ["dirPath", "docPath"],
    },
  },
  {
    name: "sense_surroundings",
    description: "Automatically provides relevant documentation context based on what code you're currently working on. No need to ask - it just knows.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local project.",
        },
        currentFilePath: {
          type: "string",
          description: "The path to the file currently being worked on.",
        },
        contextDepth: {
          type: "string",
          description: "Optional. 'minimal', 'standard', or 'deep' (default: 'standard').",
        },
      },
      required: ["dirPath", "currentFilePath"],
    },
  },
  {
    name: "spot_delta",
    description: "Compares what's documented versus what's actually in the code. Shows the delta between documentation claims and implementation reality.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local project.",
        },
        docPath: {
          type: "string",
          description: "The path to the documentation file.",
        },
        includeCodeSnippets: {
          type: "boolean",
          description: "Optional. Include actual code in diff (default: true).",
        },
      },
      required: ["dirPath", "docPath"],
    },
  },
  {
    name: "doc_the_tools",
    description: "Provides comprehensive help for all docsgrep tools with detailed examples, common patterns, and pro tips.",
    inputSchema: {
      type: "object",
      properties: {
        toolName: {
          type: "string",
          description: "Optional. Specific tool to get help for (default: all tools).",
        },
        includeExamples: {
          type: "boolean",
          description: "Optional. Include usage examples (default: true).",
        },
      },
    },
  },
  {
    name: "catch_fossils",
    description: "Analyzes which documentation artifacts need updates based on recent codebase changes. Uses git diff to prioritize doc updates.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the local project.",
        },
        sinceCommit: {
          type: "string",
          description: "Optional. Check changes since this commit (default: last commit).",
        },
        priorityMode: {
          type: "string",
          description: "Optional. 'impact' or 'recency' (default: 'impact').",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "gauge_docs",
    description: "Measures documentation coverage (docblocks) across the codebase. Language-agnostic support for JS, TS, PHP, Python, Go, Rust, etc.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the source directory.",
        },
        filePatterns: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to filter source files.",
        },
        publicOnly: {
          type: "boolean",
          description: "Optional. Only count public APIs (exported/public). Defaults to true.",
        },
        includePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to include in scanning.",
        },
        excludePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Glob patterns to exclude from scanning.",
        },
      },
      required: ["dirPath"],
    },
  },
  {
    name: "map_archetypes",
    description: "Maps project architectural patterns (MVC, Repository, etc.) and suggests refactoring candidates (Base Class, Trait, Interface).",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "The absolute path to the project directory.",
        },
        minSimilarity: {
          type: "number",
          description: "Minimum similarity score (0-1) to suggest abstraction. Default: 0.8",
        },
        focus: {
          type: "string",
          enum: ["interface", "base_class", "trait", "all"],
          description: "Optional focus area for suggestions.",
        },
        includePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional glob patterns to include in scanning.",
        },
        excludePath: {
          type: "array",
          items: { type: "string" },
          description: "Optional glob patterns to exclude from scanning.",
        },
      },
      required: ["dirPath"],
    },
  },
];
