#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { glob } from "glob";
import { simpleGit, type SimpleGit } from "simple-git";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const MAX_FILE_SIZE_TECH = 50000;
const MAX_FILE_SIZE_CONVENTIONS = 100000;
const MAX_FILE_SIZE_SAMPLE = 20000;
const GIT_TIMEOUT_MS = 60000;

function validateStringParam(param: unknown, paramName: string): string {
  if (typeof param !== "string" || !param.trim()) {
    throw new Error(`Invalid ${paramName}: must be a non-empty string`);
  }
  return param.trim();
}

function validateDirPath(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  if (resolved !== path.normalize(resolved)) {
    throw new Error("Invalid path: path traversal detected");
  }
  return resolved;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, op: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${op} timed out after ${ms}ms`)), ms));
  return Promise.race([promise, timeout]);
}

async function cleanupCache(baseDir: string, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<string[]> {
  const cleaned: string[] = [];
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(baseDir, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.rm(fullPath, { recursive: true, force: true });
          cleaned.push(entry.name);
        }
      } catch (e) {
        // skip
      }
    }
  } catch (e) {
    // baseDir may not exist
  }
  return cleaned;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));

// Initialize the MCP server
const server = new Server(
  {
    name: pkg.name,
    version: pkg.version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to find docs in a given directory
async function findDocsInDir(dirPath: string) {
  const readmeFiles = await glob("**/*readme*.md", {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**"],
  });

  const docsFolderFiles = await glob("docs/**/*.md", {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**"],
  });

  // Combine and deduplicate
  const allFiles = Array.from(new Set([...readmeFiles, ...docsFolderFiles]));
  return allFiles.map((file) => path.join(dirPath, file));
}

// Helper function to analyze project context from multi-language package managers
async function analyzeProjectContext(dirPath: string) {
  const commonFiles = [
    // Node.js
    "package.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
    // PHP
    "composer.json", "composer.lock",
    // Go
    "go.mod", "go.sum",
    // Rust
    "Cargo.toml", "Cargo.lock",
    // Python
    "requirements.txt", "pyproject.toml", "Pipfile", "Pipfile.lock", "setup.py",
    // Ruby
    "Gemfile", "Gemfile.lock",
    // Java / Kotlin / Scala
    "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle",
    // C / C++
    "CMakeLists.txt", "Makefile", "conanfile.txt", "conanfile.py",
    // .NET / C#
    "*.csproj", "*.fsproj", "packages.config",
// Elixir / Erlang
"mix.exs", "mix.lock",
// Dart
"pubspec.yaml", "pubspec.lock"
  ];

  // Additional files
  const extraFiles = ["Package.swift", "shard.yml", "rebar.config"];

  const allPatterns = [...commonFiles, ...extraFiles];

  const foundFiles = await glob(allPatterns, {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**", "**/vendor/**", "**/.git/**", "**/target/**", "**/dist/**", "**/build/**"],
  });

  const analysis: Record<string, string> = {};
  
  for (const file of foundFiles) {
    const fullPath = path.join(dirPath, file);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isFile() && stat.size < MAX_FILE_SIZE_TECH) {
            const content = await fs.readFile(fullPath, "utf-8");
            analysis[file] = content;
          } else {
            analysis[file] = `[File too large or not a file: ${stat.size} bytes]`;
          }
    } catch (e: any) {
      analysis[file] = `[Error reading file: ${e.message}]`;
    }
  }

  return analysis;
}

// Helper function to gather project conventions, linters, and architectural guidelines (Agnostic)
async function gatherProjectConventions(dirPath: string) {
  const conventionPatterns = [
    // Markdown rules (fuzzy)
    "**/*contribut*.{md,txt}", "**/*architectur*.{md,txt}", "**/*style*.{md,txt}", "**/*convention*.{md,txt}", "**/*standard*.{md,txt}", "**/*guideline*.{md,txt}",
    // Generic linter/formatter configs (fuzzy)
    "**/*lint*rc*", "**/*.lint*", "**/*format*rc*", "**/*.format*", "**/*-cs-fixer*", "**/*rules*.{json,yaml,yml,xml,toml}",
    // Editor config
    "**/.editorconfig",
    // Known specific linters just in case
    "**/.eslintrc*", "**/eslint.config.*", "**/.prettierrc*", "**/prettier.config.*", "**/biome.json",
    "**/phpcs.xml", "**/phpstan.neon", "**/golangci.y*ml", "**/tox.ini", "**/.flake8", "**/.rubocop.yml", "**/rustfmt.toml"
  ];

  const foundFiles = await glob(conventionPatterns, {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**", "**/vendor/**", "**/.git/**", "**/target/**", "**/dist/**", "**/build/**", "**/.next/**", "**/.nuxt/**"],
  });

  const conventions: Record<string, string> = {};
  
  for (const file of foundFiles) {
    const fullPath = path.join(dirPath, file);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile() && stat.size < MAX_FILE_SIZE_CONVENTIONS) {
        const content = await fs.readFile(fullPath, "utf-8");
        conventions[file] = content;
      } else {
        conventions[file] = `[File too large to include context automatically: ${stat.size} bytes]`;
      }
    } catch (e: any) {
      conventions[file] = `[Error reading file: ${e.message}]`;
    }
  }

  return conventions;
}

// Helper function to extract code patterns (implicit conventions) from random source code files
async function sampleCodebasePatterns(dirPath: string) {
  // Grab a broad set of source files, ignoring configs, docs, and tests if possible.
  const sourcePatterns = [
    "src/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
    "app/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
    "lib/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
    "internal/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
    "pkg/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
  ];

  const foundFiles = await glob(sourcePatterns, {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**", "**/vendor/**", "**/.git/**", "**/target/**", "**/dist/**", "**/build/**", "**/*.test.*", "**/*.spec.*", "**/test/**", "**/tests/**"],
  });

// Limit to at most 3 random files to avoid huge token usage, but enough to establish a pattern
const selectedFiles: string[] = [];
const shuffled = [...foundFiles];
for (let i = 0; i < 3 && shuffled.length > 0; i++) {
  const idx = Math.floor(Math.random() * shuffled.length);
  selectedFiles.push(shuffled[idx]);
  shuffled.splice(idx, 1);
}
  
  const patterns: Record<string, string> = {};
  
  for (const file of selectedFiles) {
    const fullPath = path.join(dirPath, file);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile() && stat.size < MAX_FILE_SIZE_SAMPLE) {
        const content = await fs.readFile(fullPath, "utf-8");
        patterns[file] = content;
      }
    } catch (e: any) {
      patterns[file] = `[Error reading file: ${e.message}]`;
    }
  }

  return patterns;
}

// Define the tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "init_workspace",
        description:
          "Initializes a .docsgrep workspace in the specified project directory to store temporary files, logs, and reports. Also automatically updates the .gitignore file.",
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
        name: "analyze_project_tech_stack",
        description:
          "Analyzes a local directory to identify the project's technology stack by reading package manager files (e.g., package.json, composer.json, go.mod, Cargo.toml).",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to analyze.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "gather_project_conventions",
        description:
          "Gathers project conventions, linters, and architectural guidelines (e.g., .eslintrc, phpcs.xml, CONTRIBUTING.md, .editorconfig) to provide context for code quality audits.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to scan for conventions.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "sample_codebase_patterns",
        description:
          "Samples a few representative source code files from a local directory. Use this when a project lacks explicit documentation or linter configs to infer implicit coding conventions and style directly from the code.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to sample.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "explore_local_docs",
        description:
          "Explores a local directory to find README files and documentation inside docs/ folders.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to explore.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "explore_remote_repo",
        description:
          "Clones a remote git repository to a temporary directory and finds README files and documentation.",
        inputSchema: {
          type: "object",
          properties: {
            repoUrl: {
              type: "string",
              description: "The URL of the git repository (e.g., https://github.com/user/repo.git).",
            },
            branch: {
              type: "string",
              description: "Optional. Specific branch to explore (e.g., 'docs', 'gh-pages', 'v14'). If not provided, explores the default branch.",
            },
            localProjectPath: {
              type: "string",
              description: "Optional. The absolute path to the local project to use its .docsgrep workspace for storing cloned repositories.",
            }
          },
          required: ["repoUrl"],
        },
      },
        {
          name: "read_doc_file",
          description: "Reads the contents of a specific documentation or README file.",
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
          name: "cleanup_cache",
          description: "Cleans up old cached repositories in the .docsgrep workspace. Removes repos older than the specified max age (default 7 days).",
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
      ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "init_workspace": {
      const { projectPath: rawPath } = request.params.arguments as { projectPath: string };

      try {
        const projectPath = validateDirPath(validateStringParam(rawPath, "projectPath"));
        const workspacePath = path.join(projectPath, ".docsgrep");
        await fs.mkdir(path.join(workspacePath, "tmp"), { recursive: true });
        await fs.mkdir(path.join(workspacePath, "repos"), { recursive: true });
        await fs.mkdir(path.join(workspacePath, "logs"), { recursive: true });
        await fs.mkdir(path.join(workspacePath, "reports"), { recursive: true });

        const gitignorePath = path.join(projectPath, ".gitignore");
        try {
          const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
          if (!gitignoreContent.includes(".docsgrep")) {
            await fs.appendFile(gitignorePath, "\n.docsgrep\n");
          }
        } catch (e: any) {
          if (e.code === "ENOENT") {
            await fs.writeFile(gitignorePath, ".docsgrep\n");
          }
        }

        const contextInfo = {
          initializedAt: new Date().toISOString(),
          projectPath: projectPath,
          version: pkg.version
        };
        await fs.writeFile(path.join(workspacePath, "context.json"), JSON.stringify(contextInfo, null, 2));

        return {
          content: [
            {
              type: "text",
              text: `Successfully initialized .docsgrep workspace at ${workspacePath}. The directory has been added to .gitignore.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error initializing workspace: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "analyze_project_tech_stack": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error("Provided path is not a directory");
        }

        const analysis = await analyzeProjectContext(dirPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Found ${Object.keys(analysis).length} package manager files in local directory.`,
                  files: analysis,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing tech stack: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "gather_project_conventions": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error("Provided path is not a directory");
        }

        const conventions = await gatherProjectConventions(dirPath);
        
        let message = `Found ${Object.keys(conventions).length} convention/linter files in local directory.`;
        if (Object.keys(conventions).length === 0) {
          message += " No explicit documentation or linter config was found. Consider using the 'sample_codebase_patterns' tool to infer implicit conventions from the code.";
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message,
                  files: conventions,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error gathering conventions: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "sample_codebase_patterns": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error("Provided path is not a directory");
        }

        const patterns = await sampleCodebasePatterns(dirPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Sampled ${Object.keys(patterns).length} source files to infer codebase patterns. Please analyze these files to determine the project's unwritten conventions (e.g. naming, spacing, paradigm).`,
                  files: patterns,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error sampling codebase patterns: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "explore_local_docs": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error("Provided path is not a directory");
        }

        const files = await findDocsInDir(dirPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Found ${files.length} documentation files in local directory.`,
                  files,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error exploring local directory: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

case "explore_remote_repo": {
  const { repoUrl, branch, localProjectPath } = request.params.arguments as { repoUrl: string, branch?: string, localProjectPath?: string };

    try {
      // Validate repoUrl
      const validatedUrl = validateStringParam(repoUrl, "repoUrl");
      try {
        new URL(validatedUrl);
      } catch (e) {
        throw new Error("Invalid repoUrl: not a valid URL");
      }
      if (!/^(https?|git|ssh):\/\//.test(validatedUrl)) {
        throw new Error("Invalid repoUrl: must use http, https, git, or ssh protocol");
      }

      let baseReposDir = path.join(os.tmpdir(), "docsgrep-repos");
      
      if (localProjectPath) {
        const validatedLocalPath = validateDirPath(localProjectPath);
        baseReposDir = path.join(validatedLocalPath, ".docsgrep", "repos");
      }
        await fs.mkdir(baseReposDir, { recursive: true });

        const hashInput = branch ? `${repoUrl}#${branch}` : repoUrl;
        const repoHash = crypto.createHash("md5").update(hashInput).digest("hex").substring(0, 8);
        const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
        const branchSuffix = branch ? `-${branch.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
        const targetDir = path.join(baseReposDir, `${repoName}${branchSuffix}-${repoHash}`);
        
        let message = "";
        
        try {
          // Try to pull existing repo first
          console.error(`Repository might exist. Attempting to pull latest changes for ${validatedUrl} (branch: ${branch || "default"}) in ${targetDir}...`);
          const git: SimpleGit = simpleGit(targetDir);
          
          const fetchArgs = ["--depth", "1"];
          if (branch) {
            await withTimeout(git.fetch("origin", branch, fetchArgs), GIT_TIMEOUT_MS, "git fetch");
          } else {
            await withTimeout(git.fetch(fetchArgs), GIT_TIMEOUT_MS, "git fetch");
          }

          await withTimeout(git.reset(["--hard", "FETCH_HEAD"]), GIT_TIMEOUT_MS, "git reset");
          await withTimeout(git.clean("f", ["-d"]), GIT_TIMEOUT_MS, "git clean");
          message = `Successfully updated and explored repository. Found {count} files.`;
        } catch (e) {
          // Repo doesn't exist, clone it
          console.error(`Cloning ${validatedUrl} (branch: ${branch || "default"}) into ${targetDir}...`);
          const git: SimpleGit = simpleGit();
          
          const cloneArgs = ["--depth", "1"];
          if (branch) {
            cloneArgs.push("--branch", branch);
          }
          
          await withTimeout(git.clone(validatedUrl, targetDir, cloneArgs), GIT_TIMEOUT_MS, "git clone");
          message = `Successfully cloned and explored repository. Found {count} files.`;
        }

        const files = await findDocsInDir(targetDir);
        message = message.replace("{count}", files.length.toString());
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message,
                  tempDirectory: targetDir,
                  files,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error cloning or exploring remote repo: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

case "read_doc_file": {
  const { filePath } = request.params.arguments as { filePath: string };

  try {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("Invalid file path: must be a non-empty string");
    }
    const resolvedPath = path.resolve(filePath);
    // Basic path traversal check
    if (resolvedPath !== path.normalize(resolvedPath)) {
      throw new Error("Invalid file path: path traversal detected");
    }
    const content = await fs.readFile(resolvedPath, "utf-8");
    return {
      content: [
        {
          type: "text",
          text: content,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error reading file ${filePath}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

    case "cleanup_cache": {
      const { localProjectPath: rawPath, maxAgeDays } = request.params.arguments as { localProjectPath: string; maxAgeDays?: number };

      try {
        const localProjectPath = validateDirPath(validateStringParam(rawPath, "localProjectPath"));
        const reposDir = path.join(localProjectPath, ".docsgrep", "repos");
        const maxAgeMs = (maxAgeDays && maxAgeDays > 0 ? maxAgeDays : 7) * 24 * 60 * 60 * 1000;
        const cleaned = await cleanupCache(reposDir, maxAgeMs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Cleaned up ${cleaned.length} cached repositories.`,
                  cleanedRepos: cleaned,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error cleaning cache: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }
});

// Run the server
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("docsgrep server is running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
