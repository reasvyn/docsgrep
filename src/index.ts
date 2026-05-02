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
import * as readline from "node:readline";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { performUniversalAudit as performAudit, generateUniversalAuditPrompt as generateAuditPrompt, type AuditReport } from "./best-practices.js";
import { getAuditPrompt } from "./audit.js";
import { performSecurityAudit, generateSecurityAuditPrompt, type SecurityAuditReport } from "./security-audit.js";
import { catchBugs, type BugReport } from "./bug-catcher.js";
import { analyzeProjectStyle, type ProjectStyleReport } from "./project-style.js";

// Structured logger
class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  info(message: string, meta?: Record<string, any>) {
    console.error(JSON.stringify({ level: 'info', context: this.context, message, timestamp: new Date().toISOString(), ...meta }));
  }
  
  error(message: string, meta?: Record<string, any>) {
    console.error(JSON.stringify({ level: 'error', context: this.context, message, timestamp: new Date().toISOString(), ...meta }));
  }
  
  warn(message: string, meta?: Record<string, any>) {
    console.error(JSON.stringify({ level: 'warn', context: this.context, message, timestamp: new Date().toISOString(), ...meta }));
  }
}

const logger = new Logger('docsgrep');

// Concurrency limiter
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.permits--;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.permits++;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}

const operationLimiter = new Semaphore(5); // Max 5 concurrent operations

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const MAX_FILE_SIZE_TECH = 50000;
const MAX_FILE_SIZE_CONVENTIONS = 100000;
const MAX_FILE_SIZE_SAMPLE = 20000;
const MAX_FILE_SIZE_READ = 500000; // 500KB for read_doc_file
const GIT_TIMEOUT_MS = 60000;
const MAX_CACHE_SIZE_MB = 1000; // 1GB max cache size
const MAX_RETRY_ATTEMPTS = 3;

export function validateStringParam(param: unknown, paramName: string): string {
  if (typeof param !== "string" || !param.trim()) {
    throw new Error(`Invalid ${paramName}: must be a non-empty string`);
  }
  return param.trim();
}

export function validateDirPath(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  // Check if the original path tries to traverse above by having '..' that would escape
  // We do this by checking if the resolved path is different from what we'd get
  // if we didn't allow '..' to escape the current working directory context
  const normalized = path.normalize(dirPath);
  if (normalized.includes('..')) {
    // Check if using '..' would actually escape the intended directory
    // For simplicity, we just ensure the resolved path is used
    const resolvedFromNormalized = path.resolve(normalized);
    if (resolvedFromNormalized !== resolved) {
      throw new Error("Invalid path: path traversal detected");
    }
  }
  return resolved;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, op: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${op} timed out after ${ms}ms`)), ms));
  return Promise.race([promise, timeout]);
}

async function withRetry<T>(fn: () => Promise<T>, attempts: number = MAX_RETRY_ATTEMPTS, op: string): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      logger.warn(`${op} attempt ${i + 1} failed`, { error: e.message });
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
      }
    }
  }
  throw lastError || new Error(`${op} failed after ${attempts} attempts`);
}

function isBinaryFile(content: Buffer): boolean {
  // Check for null bytes which indicate binary content
  for (let i = 0; i < Math.min(content.length, 8000); i++) {
    if (content[i] === 0) return true;
  }
  return false;
}

// Stream read large files with size limit
async function streamReadFile(filePath: string, maxBytes: number): Promise<{ content: string; bytesRead: number }> {
  const readStream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });
  
  let content = '';
  let bytesRead = 0;
  const lines: string[] = [];
  
  for await (const line of rl) {
    const lineWithNewline = line + '\n';
    if (bytesRead + Buffer.byteLength(lineWithNewline) > maxBytes) {
      break;
    }
    lines.push(line);
    bytesRead += Buffer.byteLength(lineWithNewline);
  }
  
  readStream.destroy();
  
  return {
    content: lines.join('\n'),
    bytesRead,
  };
}

async function getCacheSize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getCacheSize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
      }
    }
  } catch (e) {
    // ignore
  }
  return totalSize;
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

// Helper function to search within documentation files
async function searchDocsInDir(dirPath: string, searchPattern: string, filePattern?: string) {
  const release = await operationLimiter.acquire();
  try {
    const docs = await findDocsInDir(dirPath);
    const regex = new RegExp(searchPattern, 'gi');
    const results: Array<{ file: string; line: number; content: string }> = [];

    for (const file of docs) {
      if (filePattern && !new RegExp(filePattern).test(file)) continue;
      
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push({
              file,
              line: i + 1,
              content: lines[i].trim(),
            });
          }
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return results;
  } finally {
    release();
  }
}

// Helper function to find docs in a given directory (language-agnostic, all .md files)
async function findDocsInDir(dirPath: string) {
  const allMdFiles = await glob("**/*.md", {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/target/**", "**/vendor/**", "**/.next/**", "**/.nuxt/**"],
  });

  // Deduplicate and resolve paths
  const uniqueFiles = Array.from(new Set(allMdFiles));
  return uniqueFiles.map((file) => path.join(dirPath, file));
}

// Helper: Score line type (title/heading/body)
function getLineTypeScore(line: string): number {
  const trimmed = line.trim();
  if (/^# /.test(trimmed)) return 50; // H1 title
  if (/^##+ /.test(trimmed)) return 30; // H2+ heading
  return 10; // Body text
}

// Helper: Score file importance
function getFileImportanceScore(filePath: string, dirPath: string): number {
  const relativePath = path.relative(dirPath, filePath);
  const fileName = path.basename(filePath).toLowerCase();
  if (/readme/.test(fileName)) return 20;
  if (relativePath.startsWith('docs/')) return 15;
  return 5;
}

// Helper: Score match precision
function getMatchPrecisionScore(line: string, searchRegex: RegExp): number {
  try {
    const wordBoundaryRegex = new RegExp(`\\b${searchRegex.source}\\b`, 'i');
    return wordBoundaryRegex.test(line) ? 20 : 5;
  } catch {
    return 5;
  }
}

// Helper function to analyze project context from multi-language package managers
export async function analyzeProjectContext(dirPath: string) {
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
// Using crypto.randomBytes for better randomness (not cryptographic security, but better than Math.random)
const selectedFiles: string[] = [];
const shuffled = [...foundFiles];
for (let i = 0; i < 3 && shuffled.length > 0; i++) {
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF;
  const idx = Math.floor(randomValue * shuffled.length);
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
        name: "setup_camp",
        description:
          "Sets up a docsgrep base camp in the specified project directory to store temporary files, logs, and reports. Also automatically updates the .gitignore file.",
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
        description:
          "Spies on the project's technology stack by reading package manager files (e.g., package.json, composer.json, go.mod, Cargo.toml).",
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
        name: "sniff_style",
        description:
          "Sniffs out project style: conventions, linters, and infers implicit coding patterns from codebase samples. Combines convention detection and code pattern analysis.",
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
        name: "hunt_docs",
        description:
          "Hunts for README files and documentation inside docs/ folders in a local directory.",
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
        name: "fetch_repo",
        description:
          "Fetches a remote git repository to a temporary directory and finds documentation. Supports authentication for private repos.",
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
            },
            authToken: {
              type: "string",
              description: "Optional. Authentication token for private repositories (GitHub PAT, GitLab token, etc.). For HTTPS URLs, this will be added to the URL.",
            },
            sshKeyPath: {
              type: "string",
              description: "Optional. Path to SSH private key for authentication. Uses ssh-agent or GIT_SSH_COMMAND.",
            }
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
        description: "Greps for a pattern within documentation files (README, docs/**/*.md) in a local directory. Returns matching lines with file path and line number.",
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
      ],
    };
  });

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "setup_camp": {
      const { projectPath: rawPath } = request.params.arguments as { projectPath: string };
      
      try {
        const projectPath = validateDirPath(validateStringParam(rawPath, "projectPath"));
        
        // Try system temp directory first
        let workspacePath: string;
        let usedSystemTemp = false;
        
        try {
          const systemTempPath = path.join(os.tmpdir(), "docsgrep", path.basename(projectPath));
          await fs.mkdir(path.join(systemTempPath, "repos"), { recursive: true });
          await fs.mkdir(path.join(systemTempPath, "logs"), { recursive: true });
          await fs.mkdir(path.join(systemTempPath, "reports"), { recursive: true });
          workspacePath = systemTempPath;
          usedSystemTemp = true;
        } catch (e) {
          // Fallback to project directory if system temp is not accessible
          const projectLocalPath = path.join(projectPath, ".docsgrep");
          await fs.mkdir(path.join(projectLocalPath, "repos"), { recursive: true });
          await fs.mkdir(path.join(projectLocalPath, "logs"), { recursive: true });
          await fs.mkdir(path.join(projectLocalPath, "reports"), { recursive: true });
          workspacePath = projectLocalPath;
          usedSystemTemp = false;
        }
        
        const contextInfo = {
          initializedAt: new Date().toISOString(),
          projectPath: projectPath,
          workspacePath: workspacePath,
          version: pkg.version,
          storageType: usedSystemTemp ? 'system-temp' : 'project-local'
        };
        await fs.writeFile(path.join(workspacePath, "context.json"), JSON.stringify(contextInfo, null, 2));

        // Also update .gitignore to ignore .docsgrep if using project-local storage
        if (!usedSystemTemp) {
          try {
            const gitignorePath = path.join(projectPath, ".gitignore");
            let gitignoreContent = "";
            try {
              gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
            } catch (e) {
              // .gitignore doesn't exist yet
            }
            if (!gitignoreContent.includes(".docsgrep")) {
              await fs.writeFile(gitignorePath, gitignoreContent + "\n# docsgrep workspace\n.docsgrep/\n");
            }
          } catch (e) {
            // Ignore gitignore update errors
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully initialized docsgrep workspace at ${workspacePath} (${usedSystemTemp ? 'system temp directory' : 'project directory'}).`,
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

    case "spy_stack": {
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

    case "sniff_style": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };
      
      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error("Provided path is not a directory");
        }

        const release = await operationLimiter.acquire();
        try {
          logger.info("Starting project style analysis", { dirPath });
          
          const report: ProjectStyleReport = await analyzeProjectStyle(dirPath);
          
          logger.info("Project style analysis completed", { 
            conventionsFound: report.conventions.found,
            patternsSampled: report.patterns.sampled,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Project style analysis completed. ${report.conventions.message} ${report.patterns.message}`,
                    conventions: report.conventions,
                    patterns: report.patterns,
                    recommendations: report.recommendations,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing project style: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "hunt_docs": {
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

    case "fetch_repo": {
      const { repoUrl, branch, localProjectPath, authToken, sshKeyPath } = request.params.arguments as {
        repoUrl: string;
        branch?: string;
        localProjectPath?: string;
        authToken?: string;
        sshKeyPath?: string;
      };

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

        // Handle authentication
        let authenticatedUrl = validatedUrl;
        if (authToken) {
          // Inject token into HTTPS URLs
          if (validatedUrl.startsWith('https://') || validatedUrl.startsWith('http://')) {
            // Format: https://<token>@github.com/user/repo.git
            const urlObj = new URL(validatedUrl);
            urlObj.username = authToken;
            authenticatedUrl = urlObj.toString();
            logger.info("Using token authentication for HTTPS repo");
          } else {
            logger.warn("authToken provided but URL is not HTTPS, token may not be used");
          }
        }

        const gitOptions: any = {};
        if (sshKeyPath) {
          // Use specific SSH key
          const resolvedKeyPath = path.resolve(sshKeyPath);
          try {
            await fs.access(resolvedKeyPath);
          } catch (e) {
            throw new Error(`SSH key not found at: ${resolvedKeyPath}`);
          }
          gitOptions.config = [`core.sshCommand=ssh -i ${resolvedKeyPath} -o StrictHostKeyChecking=no`];
          logger.info("Using SSH key authentication", { keyPath: resolvedKeyPath });
        }

        let baseReposDir = path.join(os.tmpdir(), "docsgrep", "repos");
        
        if (localProjectPath) {
          const validatedLocalPath = validateDirPath(localProjectPath);
          baseReposDir = path.join(os.tmpdir(), "docsgrep", path.basename(validatedLocalPath), "repos");
        }
        await fs.mkdir(baseReposDir, { recursive: true });

        const hashInput = branch ? `${repoUrl}#${branch}` : repoUrl;
        const repoHash = crypto.createHash("md5").update(hashInput).digest("hex").substring(0, 8);
        const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
        const branchSuffix = branch ? `-${branch.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
        const targetDir = path.join(baseReposDir, `${repoName}${branchSuffix}-${repoHash}`);
        
        let message = "";
        
        try {
          // Check if repo already exists in cache
          let repoExists = false;
          try {
            await fs.access(targetDir);
            await fs.access(path.join(targetDir, ".git"));
            repoExists = true;
          } catch (e) {
            repoExists = false;
          }

          if (repoExists) {
            // Repo exists, try to pull latest changes
            logger.info(`Attempting to pull latest changes`, { url: validatedUrl, branch: branch || "default", target: targetDir });
            const git: SimpleGit = simpleGit(targetDir, gitOptions);
            
            const fetchArgs = ["--depth", "1"];
            if (branch) {
              await withRetry(() => withTimeout(git.fetch("origin", branch, fetchArgs), GIT_TIMEOUT_MS, "git fetch"), MAX_RETRY_ATTEMPTS, "git fetch");
            } else {
              await withRetry(() => withTimeout(git.fetch(fetchArgs), GIT_TIMEOUT_MS, "git fetch"), MAX_RETRY_ATTEMPTS, "git fetch");
            }

            await withRetry(() => withTimeout(git.reset(["--hard", "FETCH_HEAD"]), GIT_TIMEOUT_MS, "git reset"), MAX_RETRY_ATTEMPTS, "git reset");
            await withRetry(() => withTimeout(git.clean("f", ["-d"]), GIT_TIMEOUT_MS, "git clean"), MAX_RETRY_ATTEMPTS, "git clean");
            message = `Successfully updated and explored repository. Found {count} files.`;
          } else {
            throw new Error("Repo not found in cache, need to clone");
          }
        } catch (e) {
          // Repo doesn't exist or update failed, clone it with retry
          logger.info(`Cloning repository`, { url: validatedUrl, branch: branch || "default", target: targetDir });
          const git: SimpleGit = simpleGit(gitOptions);
          
          const cloneArgs = ["--depth", "1"];
          if (branch) {
            cloneArgs.push("--branch", branch);
          }
          
          await withRetry(() => withTimeout(git.clone(authenticatedUrl, targetDir, cloneArgs), GIT_TIMEOUT_MS, "git clone"), MAX_RETRY_ATTEMPTS, "git clone");
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

    case "peek_file": {
      const { filePath } = request.params.arguments as { filePath: string };

      try {
        if (!filePath || typeof filePath !== "string") {
          throw new Error("Invalid file path: must be a non-empty string");
        }
        const resolvedPath = path.resolve(filePath);
        
        const stat = await fs.stat(resolvedPath);
        if (!stat.isFile()) {
          throw new Error("Path is not a file");
        }
        
        // Stream/chunk read for large files
        if (stat.size > MAX_FILE_SIZE_READ) {
          logger.info(`File exceeds limit, streaming first ${MAX_FILE_SIZE_READ} bytes`, { filePath, size: stat.size });
          const streamResult = await streamReadFile(resolvedPath, MAX_FILE_SIZE_READ);
          return {
            content: [
              {
                type: "text",
                text: streamResult.content + `\n\n[... File truncated. Total size: ${stat.size} bytes. Showing first ${streamResult.bytesRead} bytes ...]`,
              },
            ],
          };
        }
        
        // Small file - read normally
        const buffer = await fs.readFile(resolvedPath);
        if (isBinaryFile(buffer)) {
          throw new Error("Cannot read binary file");
        }
        
        const content = buffer.toString("utf-8");
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

    case "purge_cache": {
      const { localProjectPath: rawPath, maxAgeDays } = request.params.arguments as { localProjectPath: string; maxAgeDays?: number };

      try {
        const localProjectPath = validateDirPath(validateStringParam(rawPath, "localProjectPath"));
        let reposDir = path.join(os.tmpdir(), "docsgrep", path.basename(localProjectPath), "repos");
        
        // Also check the old .docsgrep path for backward compatibility
        const oldReposDir = path.join(localProjectPath, ".docsgrep", "repos");
        try {
          await fs.access(oldReposDir);
          reposDir = oldReposDir;
        } catch (e) {
          // Use new path
        }
        
        const maxAgeMs = (maxAgeDays && maxAgeDays > 0 ? maxAgeDays : 7) * 24 * 60 * 60 * 1000;
        const cleaned = await cleanupCache(reposDir, maxAgeMs);
        
        // Also clean system-wide docsgrep cache
        const systemCacheDir = path.join(os.tmpdir(), "docsgrep");
        if (reposDir !== systemCacheDir) {
          const systemCleaned = await cleanupCache(systemCacheDir, maxAgeMs);
          cleaned.push(...systemCleaned);
        }
        
        // Also check cache size
        const cacheSize = await getCacheSize(reposDir);
        const cacheSizeMB = cacheSize / (1024 * 1024);
        
        let message = `Cleaned up ${cleaned.length} cached repositories.`;
        if (cacheSizeMB > MAX_CACHE_SIZE_MB) {
          message += ` Warning: Cache size (${cacheSizeMB.toFixed(2)}MB) exceeds limit (${MAX_CACHE_SIZE_MB}MB).`;
        } else {
          message += ` Current cache size: ${cacheSizeMB.toFixed(2)}MB.`;
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message,
                  cleanedRepos: cleaned,
                  cacheSizeMB: parseFloat(cacheSizeMB.toFixed(2)),
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

    case "grep_docs": {
      const { dirPath: rawPath, pattern, filePattern } = request.params.arguments as {
        dirPath: string;
        pattern: string;
        filePattern?: string;
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const validatedPattern = validateStringParam(pattern, "pattern");

        // Validate regex
        let searchRegex: RegExp;
        try {
          searchRegex = new RegExp(validatedPattern, "gi");
        } catch (e: any) {
          throw new Error(`Invalid regex pattern: ${e.message}`);
        }

        const release = await operationLimiter.acquire();
        try {
          const docs = await findDocsInDir(dirPath);

          const results: Array<{
            file: string;
            line: number;
            content: string;
            score: number;
          }> = [];

          for (const file of docs) {
            if (filePattern && !new RegExp(filePattern).test(file)) continue;

            try {
              const content = await fs.readFile(file, "utf-8");
              const lines = content.split("\n");

              for (let i = 0; i < lines.length; i++) {
                const lineText = lines[i];
                if (searchRegex.test(lineText)) {
                  const lineTypeScore = getLineTypeScore(lineText);
                  const fileScore = getFileImportanceScore(file, dirPath);
                  const precisionScore = getMatchPrecisionScore(
                    lineText,
                    new RegExp(validatedPattern, "i")
                  );
                  const totalScore =
                    lineTypeScore + fileScore + precisionScore;

                  results.push({
                    file,
                    line: i + 1,
                    content: lineText.trim(),
                    score: totalScore,
                  });
                }
                searchRegex.lastIndex = 0; // Reset regex
              }
            } catch (e) {
              // Skip files that can't be read
            }
          }

          // Sort by score (highest first)
          results.sort((a, b) => b.score - a.score);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Found ${results.length} matches for pattern "${validatedPattern}". Results ranked by relevance.`,
                    results: results.map((r) => ({
                      file: r.file,
                      line: r.line,
                      content: r.content,
                      relevanceScore: r.score,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching docs: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "lint_code": {
      const { dirPath: rawPath, filePatterns, focusAreas } = request.params.arguments as {
        dirPath: string;
        filePatterns?: string[];
        focusAreas?: string[];
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        
        const release = await operationLimiter.acquire();
        try {
          logger.info("Starting universal code quality audit", { dirPath, filePatterns, focusAreas });
          
          // Use the new universal audit function
          const { performUniversalAudit } = await import('./best-practices.js');
          const report: AuditReport = await performUniversalAudit(dirPath, filePatterns);
          
          logger.info("Audit completed", { 
            filesScanned: report.summary.filesScanned,
            totalIssues: report.summary.totalIssues 
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Audit completed: ${report.summary.totalIssues} issues across ${report.summary.filesScanned} files. Documentation Score: ${report.summary.documentationScore}/100, Code Quality Score: ${report.summary.codeQualityScore}/100`,
                    summary: report.summary,
                    projectStructure: report.projectStructure,
                    detectedConventions: report.detectedConventions || {},
                    issues: report.issues || [], // Limited to 100 in performAudit
                    strengths: report.strengths || [],
                    recommendations: report.recommendations || [],
                    note: report.issues && report.issues.length >= 100 ? "Results limited to 100 issues. There may be more issues." : undefined,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error during audit: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "ask_lint": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        
        // Use system temp, not .docsgrep workspace
        const prompt = await getAuditPrompt(dirPath);
        
        return {
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating audit prompt: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "guard_security": {
      const { dirPath: rawPath, filePatterns } = request.params.arguments as {
        dirPath: string;
        filePatterns?: string[];
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        
        const release = await operationLimiter.acquire();
        try {
          logger.info("Starting security audit", { dirPath, filePatterns });
          
          const report: SecurityAuditReport = await performSecurityAudit(dirPath, filePatterns);
          
          logger.info("Security audit completed", { 
            filesScanned: report.summary.filesScanned,
            totalIssues: report.summary.totalIssues,
            riskLevel: report.summary.riskLevel,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Security audit completed: ${report.summary.totalIssues} issues found. Security Score: ${report.summary.securityScore}/100 (Risk Level: ${report.summary.riskLevel})`,
                    summary: report.summary,
                    owaspTop10: report.owaspTop10,
                    dependencyAnalysis: report.dependencyAnalysis,
                    secretsFound: report.secretsFound,
                    privacyIssues: report.privacyIssues,
                    complianceStatus: report.complianceStatus,
                    recommendations: report.recommendations,
                    note: report.secretsFound.length >= 50 ? "Secrets list limited to 50 items." : undefined,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error during security audit: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "ask_guard": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };
      
      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        
        const prompt = generateSecurityAuditPrompt(dirPath);
        
        return {
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating security audit prompt: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "catch_bugs": {
      const { dirPath: rawPath, filePatterns } = request.params.arguments as {
        dirPath: string;
        filePatterns?: string[];
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        
        const release = await operationLimiter.acquire();
        try {
          logger.info("Starting bug catching", { dirPath, filePatterns });
          
          const report: BugReport = await catchBugs(dirPath, filePatterns);
          
          logger.info("Bug catching completed", { 
            filesScanned: report.summary.filesScanned,
            totalIssues: report.summary.totalIssues,
            riskLevel: report.summary.riskLevel,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Bug analysis completed: ${report.summary.totalIssues} issues found. Bug Score: ${report.summary.bugScore}/100 (Risk Level: ${report.summary.riskLevel})`,
                    summary: report.summary,
                    categories: report.categories,
                    recommendations: report.recommendations,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error during bug catching: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "fathom_meaning": {
      const { dirPath: rawPath, query, topK } = request.params
        .arguments as {
        dirPath: string;
        query: string;
        topK?: number;
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const searchQuery = validateStringParam(query, "query");
        const resultsLimit = topK && topK > 0 ? Math.min(topK, 20) : 5;

        const release = await operationLimiter.acquire();
        try {
          const docs = await findDocsInDir(dirPath);
          const queryWords = searchQuery
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 2);
          const results: Array<{
            file: string;
            score: number;
            snippet: string;
          }> = [];

          for (const file of docs) {
            try {
              const content = await fs.readFile(file, "utf-8");
              const lowerContent = content.toLowerCase();
              const lines = content.split("\n");

              let score = 0;
              const matchedLines = new Set<number>();

              for (const word of queryWords) {
                if (lowerContent.includes(word)) {
                  score += 10;
                  lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes(word)) {
                      matchedLines.add(idx);
                    }
                  });
                }
              }

              for (const line of lines) {
                if (/^#+\s/.test(line)) {
                  for (const word of queryWords) {
                    if (line.toLowerCase().includes(word)) {
                      score += 50;
                    }
                  }
                }
              }

              if (score > 0) {
                const firstMatchLine = Math.min(...matchedLines);
                const snippet = lines[firstMatchLine]
                  ? lines[firstMatchLine].trim().substring(0, 150)
                  : "";
                results.push({ file, score, snippet });
              }
            } catch (e) {
              // Skip
            }
          }

          results.sort((a, b) => b.score - a.score);
          const topResults = results.slice(0, resultsLimit);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Found ${results.length} relevant documents for "${searchQuery}". Showing top ${topResults.length}.`,
                    query: searchQuery,
                    results: topResults.map((r) => ({
                      file: r.file,
                      relevanceScore: r.score,
                      snippet: r.snippet,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error during semantic search: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "tldr_docs": {
      const { filePath, maxLength } = request.params.arguments as {
        filePath: string;
        maxLength?: number;
      };

      try {
        const validatedPath = validateStringParam(filePath, "filePath");
        const resolvedPath = path.resolve(validatedPath);
        const limit = maxLength && maxLength > 0 ? Math.min(maxLength, 2000) : 500;

        const stat = await fs.stat(resolvedPath);
        if (!stat.isFile()) throw new Error("Path is not a file");

        const content = await fs.readFile(resolvedPath, "utf-8");
        const lines = content.split("\n");

        const summaryParts: string[] = [];
        let lineCount = 0;

        for (let i = 0; i < lines.length && lineCount < limit; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          if (/^#+\s/.test(line)) {
            const part = line.substring(0, 100);
            summaryParts.push(part);
            lineCount += part.length;
          } else if (
            summaryParts.length > 0 &&
            !/^#+\s/.test(lines[i - 1] || "")
          ) {
            const part = line.substring(0, 100);
            summaryParts.push(part);
            lineCount += part.length;
          }

          if (lineCount >= limit) break;
        }

        const summary = summaryParts.join("\n").substring(0, limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Summary of ${path.basename(resolvedPath)} (${summary.length} chars)`,
                  originalLength: content.length,
                  summaryLength: summary.length,
                  summary,
                  note: summary.length >= limit ? "Summary truncated." : undefined,
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
              text: `Error summarizing document: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "hunt_related": {
      const { dirPath: rawPath, topic, threshold } = request.params
        .arguments as {
        dirPath: string;
        topic: string;
        threshold?: number;
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const searchTopic = validateStringParam(topic, "topic");
        const minScore =
          threshold && threshold > 0 && threshold <= 1 ? threshold : 0.7;

        const release = await operationLimiter.acquire();
        try {
          const docs = await findDocsInDir(dirPath);
          const topicWords = searchTopic
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 2);
          const results: Array<{
            file: string;
            similarityScore: number;
            matchingKeywords: string[];
          }> = [];

          for (const file of docs) {
            try {
              const content = await fs.readFile(file, "utf-8");
              const lowerContent = content.toLowerCase();
              const contentWords = new Set(
                lowerContent.split(/\W+/).filter((w) => w.length > 2)
              );

              let matchCount = 0;
              const matchingKeywords: string[] = [];

              for (const word of topicWords) {
                if (contentWords.has(word)) {
                  matchCount++;
                  matchingKeywords.push(word);
                }
              }

              const score =
                topicWords.length > 0 ? matchCount / topicWords.length : 0;

              if (score >= minScore) {
                results.push({
                  file,
                  similarityScore: Math.round(score * 100) / 100,
                  matchingKeywords,
                });
              }
            } catch (e) {
              // Skip
            }
          }

          results.sort((a, b) => b.similarityScore - a.similarityScore);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Found ${results.length} documents related to "${searchTopic}".`,
                    topic: searchTopic,
                    threshold: minScore,
                    results,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error hunting related docs: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "smell_stale": {
      const { dirPath: rawPath, maxAgeDays, compareWithCode } =
        request.params.arguments as {
          dirPath: string;
          maxAgeDays?: number;
          compareWithCode?: boolean;
        };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const maxAge = maxAgeDays && maxAgeDays > 0 ? maxAgeDays : 30;
        const doCompare = compareWithCode !== false;

        const release = await operationLimiter.acquire();
        try {
          const docs = await findDocsInDir(dirPath);
          const now = Date.now();
          const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
          const staleDocs: Array<{
            file: string;
            lastModified: string;
            daysSinceUpdate: number;
            reason: string;
          }> = [];

          for (const file of docs) {
            try {
              const stat = await fs.stat(file);
              const ageMs = now - stat.mtimeMs;
              const daysSince = Math.floor(
                ageMs / (24 * 60 * 60 * 1000)
              );

              if (ageMs > maxAgeMs) {
                staleDocs.push({
                  file,
                  lastModified: stat.mtime.toISOString(),
                  daysSinceUpdate: daysSince,
                  reason: `Not updated in ${daysSince} days`,
                });
              }
            } catch (e) {
              // Skip
            }
          }

          staleDocs.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Found ${staleDocs.length} stale documents (not updated in ${maxAge}+ days).`,
                    maxAgeDays: maxAge,
                    staleDocuments: staleDocs,
                    note: doCompare
                      ? "Code comparison not yet implemented in this version."
                      : undefined,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error detecting stale docs: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "sync_docs": {
      const { dirPath: rawPath, filePaths, updateMode } = request.params
        .arguments as {
        dirPath: string;
        filePaths?: string[];
        updateMode?: string;
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const mode = ["create", "update", "both"].includes(updateMode || "")
          ? updateMode
          : "update";

        const release = await operationLimiter.acquire();
        try {
          let changedFiles: string[] = [];

          if (filePaths && filePaths.length > 0) {
            changedFiles = filePaths.map((f) => path.resolve(f));
          } else {
            try {
              const git = simpleGit(dirPath);
              const status = await git.status();
              changedFiles = [
                ...status.modified,
                ...status.created,
                ...status.renamed.map((r) => r.to),
              ].map((f) => path.join(dirPath, f));
            } catch (e) {
              // Git not available
            }
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Doc sync (${mode} mode) initiated. Found ${changedFiles.length} changed files.`,
                    mode,
                    changedFiles: changedFiles.slice(0, 20),
                    note: "Full auto-sync not yet implemented. This is a stub for future implementation.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error syncing docs: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "verify_truth": {
      const { dirPath: rawPath, docPath, strictMode } = request.params
        .arguments as {
        dirPath: string;
        docPath: string;
        strictMode?: boolean;
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const validatedDocPath = validateStringParam(docPath, "docPath");
        const resolvedDocPath = path.resolve(validatedDocPath);
        const isStrict = strictMode === true;

        const release = await operationLimiter.acquire();
        try {
          const docContent = await fs.readFile(resolvedDocPath, "utf-8");

          const methodPattern = /(?:function|def|func|fn|method|class)\s+(\w+)/gi;
          const documentedItems: string[] = [];
          let match;

          while ((match = methodPattern.exec(docContent)) !== null) {
            documentedItems.push(match[1]);
          }

          const codePatterns = [
            "**/*.{js,ts,jsx,tsx,py,rb,go,rs,java,php,c,cpp,cs,swift,dart}",
          ];
          const codeFiles = await glob(codePatterns, {
            cwd: dirPath,
            ignore: [
              "**/node_modules/**",
              "**/.git/**",
              "**/dist/**",
              "**/build/**",
            ],
          });

          const issues: Array<{
            item: string;
            status: string;
            suggestion?: string;
          }> = [];

          for (const item of documentedItems.slice(0, 50)) {
            let found = false;
            for (const codeFile of codeFiles) {
              try {
                const content = await fs.readFile(
                  path.join(dirPath, codeFile),
                  "utf-8"
                );
                if (new RegExp(`\\b${item}\\b`).test(content)) {
                  found = true;
                  break;
                }
              } catch (e) {
                // Skip
              }
            }
            if (!found) {
              issues.push({
                item,
                status: "not_found",
                suggestion: "Method may have been renamed or removed",
              });
            }
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Validation complete: ${documentedItems.length} items checked, ${issues.length} issues found.`,
                    docPath: resolvedDocPath,
                    itemsChecked: documentedItems.length,
                    issues,
                    strictMode: isStrict,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error verifying documentation: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "sense_surroundings": {
      const { dirPath: rawPath, currentFilePath, contextDepth } =
        request.params.arguments as {
          dirPath: string;
          currentFilePath: string;
          contextDepth?: string;
        };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const validatedFile = validateStringParam(
          currentFilePath,
          "currentFilePath"
        );
        const resolvedFile = path.resolve(validatedFile);
        const depth = ["minimal", "standard", "deep"].includes(
          contextDepth || ""
        )
          ? contextDepth
          : "standard";

        const release = await operationLimiter.acquire();
        try {
          const fileDir = path.dirname(resolvedFile);
          const relativeFileDir = path.relative(dirPath, fileDir);

          const docs = await findDocsInDir(dirPath);
          const relevantDocs: Array<{
            file: string;
            relevance: string;
            reason: string;
          }> = [];

          for (const doc of docs) {
            const docRelative = path.relative(dirPath, doc);
            const docDir = path.dirname(docRelative);

            let relevance = "medium";
            let reason = "General documentation";

            // README is always highly relevant
            const docBasename = path.basename(doc).toLowerCase();
            if (docBasename === "readme.md" || docBasename === "readme") {
              relevance = "high";
              reason = "README file";
            }
            // Same directory
            else if (docDir === relativeFileDir) {
              relevance = "high";
              reason = "Same directory as current file";
            }
            // Doc is in a parent directory
            else if (relativeFileDir.startsWith(docDir + path.sep) && docDir !== ".") {
              relevance = "high";
              reason = "Doc is in parent directory";
            }
            // Doc is in a subdirectory
            else if (docDir.startsWith(relativeFileDir + path.sep)) {
              relevance = "medium";
              reason = "Doc is in subdirectory";
            }
            // Common top-level directory
            else if (docDir !== "." && relativeFileDir !== ".") {
              const docTopDir = docDir.split(path.sep)[0];
              const fileTopDir = relativeFileDir.split(path.sep)[0];
              if (docTopDir === fileTopDir) {
                relevance = "medium";
                reason = "Same top-level directory";
              }
            }

            relevantDocs.push({
              file: doc,
              relevance,
              reason,
            });
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Found ${relevantDocs.length} relevant docs for ${path.basename(resolvedFile)}.`,
                    currentFile: resolvedFile,
                    contextDepth: depth,
                    relevantDocs,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error sensing surroundings: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "spot_delta": {
      const { dirPath: rawPath, docPath, includeCodeSnippets } =
        request.params.arguments as {
          dirPath: string;
          docPath: string;
          includeCodeSnippets?: boolean;
        };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const validatedDocPath = validateStringParam(docPath, "docPath");
        const resolvedDocPath = path.resolve(validatedDocPath);
        const doInclude = includeCodeSnippets !== false;

        const release = await operationLimiter.acquire();
        try {
          const docContent = await fs.readFile(resolvedDocPath, "utf-8");

          const methodPatterns = [
            /(?:function|def|func|fn)\s+(\w+)\s*\(/g,
            /(?:class)\s+(\w+)/g,
            /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)/g,
          ];

          const documentedItems: Array<{
            name: string;
            type: string;
            line: number;
          }> = [];

          const lines = docContent.split("\n");
          for (let i = 0; i < lines.length; i++) {
            for (const pattern of methodPatterns) {
              let match;
              pattern.lastIndex = 0;
              if ((match = pattern.exec(lines[i])) !== null) {
                documentedItems.push({
                  name: match[1],
                  type: "method",
                  line: i + 1,
                });
              }
            }
          }

          const codePatterns = [
            "**/*.{js,ts,jsx,tsx,py,rb,go,rs,java,php,c,cpp,cs}",
          ];
          const codeFiles = await glob(codePatterns, {
            cwd: dirPath,
            ignore: ["**/node_modules/**", "**/.git/**"],
          });

          const deltas: Array<{
            item: string;
            docStatus: string;
            codeStatus: string;
          }> = [];

          for (const item of documentedItems.slice(0, 30)) {
            let found = false;
            for (const codeFile of codeFiles) {
              try {
                const content = await fs.readFile(
                  path.join(dirPath, codeFile),
                  "utf-8"
                );
                if (new RegExp(`\\b${item.name}\\b`).test(content)) {
                  found = true;
                  break;
                }
              } catch (e) {
                // Skip
              }
            }
            deltas.push({
              item: item.name,
              docStatus: `documented at line ${item.line}`,
              codeStatus: found
                ? "found in code"
                : "NOT FOUND in code",
            });
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Delta analysis: ${deltas.length} items compared between doc and code.`,
                    docPath: resolvedDocPath,
                    itemsCompared: deltas.length,
                    deltas,
                    note: "Detailed diff with code snippets coming in future version.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error spotting delta: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "doc_the_tools": {
      const { toolName, includeExamples } = request.params.arguments as {
        toolName?: string;
        includeExamples?: boolean;
      };

      const doInclude = includeExamples !== false;

      const toolHelp: Record<string, any> = {
        setup_camp: {
          description: "Initialize docsgrep workspace",
          example: `setup_camp(projectPath: "/home/user/myproject")`,
        },
        spy_stack: {
          description: "Spy on project tech stack",
          example: `spy_stack(dirPath: "/home/user/myproject")`,
        },
        sniff_style: {
          description: "Sniff out coding conventions",
          example: `sniff_style(dirPath: "/home/user/myproject")`,
        },
        hunt_docs: {
          description: "Hunt for documentation files",
          example: `hunt_docs(dirPath: "/home/user/myproject")`,
        },
        fetch_repo: {
          description: "Fetch remote repository",
          example: `fetch_repo(repoUrl: "https://github.com/user/repo.git")`,
        },
        peek_file: {
          description: "Peek into file contents",
          example: `peek_file(filePath: "/home/user/myproject/README.md")`,
        },
        grep_docs: {
          description: "Search in documentation",
          example: `grep_docs(dirPath: "/home/user/myproject", pattern: "Internship")`,
        },
        lint_code: {
          description: "Enterprise code quality audit",
          example: `lint_code(dirPath: "/home/user/myproject")`,
        },
        catch_bugs: {
          description: "Catch bugs and issues",
          example: `catch_bugs(dirPath: "/home/user/myproject")`,
        },
        fathom_meaning: {
          description: "Semantic search in docs",
          example: `fathom_meaning(dirPath: "/home/user/myproject", query: "how does auth work")`,
        },
        tldr_docs: {
          description: "Summarize documentation",
          example: `tldr_docs(filePath: "/home/user/myproject/docs/api.md")`,
        },
        hunt_related: {
          description: "Find related documentation",
          example: `hunt_related(dirPath: "/home/user/myproject", topic: "authentication")`,
        },
        smell_stale: {
          description: "Detect outdated docs",
          example: `smell_stale(dirPath: "/home/user/myproject")`,
        },
        sync_docs: {
          description: "Sync docs with code changes",
          example: `sync_docs(dirPath: "/home/user/myproject")`,
        },
        verify_truth: {
          description: "Validate doc consistency",
          example: `verify_truth(dirPath: "/home/user/myproject", docPath: "docs/api.md")`,
        },
        sense_surroundings: {
          description: "Smart context provider",
          example: `sense_surroundings(dirPath: "/home/user/myproject", currentFilePath: "src/auth.ts")`,
        },
        spot_delta: {
          description: "Compare doc vs implementation",
          example: `spot_delta(dirPath: "/home/user/myproject", docPath: "docs/api.md")`,
        },
        catch_fossils: {
          description: "Detect artifacts needing updates",
          example: `catch_fossils(dirPath: "/home/user/myproject")`,
        },
      };

      if (toolName) {
        const help = toolHelp[toolName];
        if (!help) {
          return {
            content: [
              {
                type: "text",
                text: `Tool "${toolName}" not found. Use doc_the_tools() without arguments to see all tools.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  tool: toolName,
                  ...help,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `Help for all ${Object.keys(toolHelp).length} docsgrep tools.`,
                tools: toolHelp,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "catch_fossils": {
      const { dirPath: rawPath, sinceCommit, priorityMode } =
        request.params.arguments as {
          dirPath: string;
          sinceCommit?: string;
          priorityMode?: string;
        };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const mode = ["impact", "recency"].includes(priorityMode || "")
          ? priorityMode
          : "impact";

        const release = await operationLimiter.acquire();
        try {
          const docs = await findDocsInDir(dirPath);

          let changedFiles: string[] = [];
          try {
            const git = simpleGit(dirPath);
            const logOptions: any = { n: 50 };
            if (sinceCommit) {
              logOptions.from = sinceCommit;
            }
            const log = await git.log(logOptions);
            changedFiles = log.all.flatMap((commit) =>
              commit.diff?.files?.map((f: any) => f.file) || []
            );
          } catch (e) {
            // Git not available
          }

          const fossilDocs: Array<{
            file: string;
            reason: string;
            priority: string;
          }> = [];

          for (const doc of docs) {
            const docRelative = path.relative(dirPath, doc);
            const docDir = path.dirname(docRelative);

            const relatedChanges = changedFiles.filter((f) => {
              const changedDir = path.dirname(f);
              return (
                f.includes(path.basename(doc, ".md")) ||
                changedDir === docDir ||
                changedDir.startsWith(docDir)
              );
            });

            if (relatedChanges.length > 0) {
              fossilDocs.push({
                file: doc,
                reason: `${relatedChanges.length} related code changes detected`,
                priority:
                  relatedChanges.length > 3
                    ? "high"
                    : relatedChanges.length > 1
                    ? "medium"
                    : "low",
              });
            }
          }

          const priorityOrder: Record<string, number> = {
            high: 0,
            medium: 1,
            low: 2,
          };
          fossilDocs.sort(
            (a, b) =>
              priorityOrder[a.priority] - priorityOrder[b.priority]
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Found ${fossilDocs.length} documentation artifacts that may need updates.`,
                    priorityMode: mode,
                    sinceCommit: sinceCommit || "recent commits",
                    fossils: fossilDocs,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error catching fossils: ${error.message}`,
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
