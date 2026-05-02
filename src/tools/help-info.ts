/**
 * Help & info tools: doc_the_tools, spy_stack, sniff_style, fetch_repo
 */
import { glob } from "glob";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { validateStringParam, validateDirPath } from "../utils/validation.js";
import { operationLimiter } from "../utils/semaphore.js";
import { analyzeProjectStyle } from "../project-style.js";
import { cloneOrUpdateRepo, getRepoCachePath } from "../utils/git.js";
import { logger } from "../utils/logger.js";
import { findDocsInDir as findDocsInDirUtil } from "../tools/documentation.js";

export async function handleDocTheTools(args: any): Promise<any> {
  const { toolName, includeExamples } = args;

  if (includeExamples === false) {
    // Return without examples
  }

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

export async function handleSpyStack(args: any): Promise<any> {
  const { dirPath: rawPath } = args;

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
      content: [{ type: "text", text: `Error analyzing tech stack: ${error.message}` }],
      isError: true,
    };
  }
}

export async function handleSniffStyle(args: any): Promise<any> {
  const { dirPath: rawPath } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      throw new Error("Provided path is not a directory");
    }

    const release = await operationLimiter.acquire();
    try {
      logger.info("Starting project style analysis", { dirPath });

      const report = await analyzeProjectStyle(dirPath);

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
      content: [{ type: "text", text: `Error analyzing project style: ${error.message}` }],
      isError: true,
    };
  }
}

export async function handleFetchRepo(args: any): Promise<any> {
  const { repoUrl, branch, localProjectPath, authToken, sshKeyPath } = args;

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

    const targetDir = getRepoCachePath(validatedUrl, branch, localProjectPath);

    // Ensure cache directory exists
    await fs.mkdir(path.dirname(targetDir), { recursive: true });

    await cloneOrUpdateRepo(validatedUrl, targetDir, {
      branch,
      authToken,
      sshKeyPath,
    });

    // Find docs in the cloned repo
    const docs = await findDocsInDirUtil(targetDir);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Successfully cloned/fetched and explored repository. Found ${docs.length} files.`,
              tempDirectory: targetDir,
              files: docs,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error cloning or exploring remote repo: ${error.message}` }],
      isError: true,
    };
  }
}

// Helper function to analyze project context (language-agnostic)
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
    "pubspec.yaml", "pubspec.lock",
    // Additional
    "Package.swift", "shard.yml", "rebar.config",
  ];

  const allPatterns = commonFiles;
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
      if (stat.isFile() && stat.size < 50000) {
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
