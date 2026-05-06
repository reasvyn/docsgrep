/**
 * Help information for all docsgrep tools
 */
import { AppInfo } from "../utils/app-info.js";
import { 
  type McpToolResponse, 
  type DocTheToolsArgs,
  type SpyStackArgs,
  type SniffStyleArgs,
  type FetchRepoArgs
} from "../types/tools.js";
import { validateDirPath, validateStringParam } from "../utils/validation.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { operationLimiter } from "../utils/semaphore.js";
import { FileScanner } from "./base.js";

export async function handleDocTheTools(
  args: DocTheToolsArgs
): Promise<McpToolResponse> {
  const { toolName, includeExamples } = args;

  const toolHelp: Record<string, { description: string; example: string }> = {
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
      description: "Search in documentation with optional surrounding context",
      example: `grep_docs(dirPath: "/home/user/myproject", pattern: "Internship", contextLines: 2)`,
    },
    lint_code: {
      description: "Enterprise code quality audit with smart noise reduction",
      example: `lint_code(dirPath: "/home/user/myproject")`,
    },
    catch_bugs: {
      description: "Catch bugs and issues with intelligent try-catch detection",
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
      description: "Validate doc consistency including function signature (arity)",
      example: `verify_truth(dirPath: "/home/user/myproject", docPath: "docs/api.md")`,
    },
    sense_surroundings: {
      description: "Smart context provider with import-based dependency analysis",
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
    gauge_docs: {
      description: "Measure documentation coverage (docblocks) in code",
      example: `gauge_docs(dirPath: "/home/user/myproject", publicOnly: true)`,
    },
    map_archetypes: {
      description: "Maps project architectural patterns and suggests refactorings (Base Class, Trait, Interface).",
      example: `map_archetypes(dirPath: "/home/user/myproject", minSimilarity: 0.8)`,
    }
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

    let text = `# Tool: ${toolName}\n\n${help.description}\n\n`;
    if (includeExamples !== false) {
      text += `## Example\n\`\`\`javascript\n${help.example}\n\`\`\`\n`;
    }

    return { content: [{ type: "text", text }] };
  }

  // General help
  let helpText = `# docsgrep Tool Suite (v${AppInfo.version})\n\n`;
  helpText += `${AppInfo.description}\n\n`;
  helpText += `## Available Tools\n\n`;

  for (const [name, info] of Object.entries(toolHelp)) {
    helpText += `### \`${name}\`\n${info.description}\n`;
    if (includeExamples !== false) {
      helpText += `Example: \`${info.example}\`\n`;
    }
    helpText += `\n`;
  }

  return { content: [{ type: "text", text: helpText }] };
}

export async function handleSpyStack(
  args: SpyStackArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, excludePath } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

    // Find package manager files
    const packageFiles = await FileScanner.findFiles({ dirPath, excludePath }, [
      "package.json",
      "composer.json",
      "go.mod",
      "Cargo.toml",
      "requirements.txt",
      "Gemfile",
      "build.gradle",
      "pom.xml",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "composer.lock",
      "Cargo.lock",
    ]);

    const files: Record<string, string> = {};
    for (const file of packageFiles) {
      try {
        const fullPath = path.join(dirPath, file);
        const content = await fs.readFile(fullPath, "utf-8");
        // Only take the first 100 lines for each file to avoid huge output
        files[file] = content.split("\n").slice(0, 100).join("\n");
      } catch (e) {
        // Skip
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Found ${packageFiles.length} package manager files in local directory.`,
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
      content: [{ type: "text", text: `Error spying on stack: ${error.message}` }],
      isError: true,
    };
  }
}

export async function handleSniffStyle(
  args: SniffStyleArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, excludePath } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

    // 1. Explicit Conventions
    const conventionFiles = await FileScanner.findFiles({ dirPath, excludePath }, [
      ".eslintrc*",
      ".prettierrc*",
      "tsconfig.json",
      ".editorconfig",
      "CONTRIBUTING*",
      "ARCHITECTURE*",
      "STYLEGUIDE*",
      "docs/tools/sniff_style.md", // include doc as convention reference if exists
    ]);

    const conventions: Record<string, string> = {};
    for (const file of conventionFiles) {
      try {
        const fullPath = path.join(dirPath, file);
        const content = await fs.readFile(fullPath, "utf-8");
        conventions[file] = content.split("\n").slice(0, 100).join("\n");
      } catch (e) {
        // Skip
      }
    }

    // 2. Implicit Pattern Analysis (Sampling)
    const sourceFiles = await FileScanner.findFiles({ dirPath, excludePath }, [
      "src/**/*.{js,ts,jsx,tsx,py,rb,go,rs,java,php,c,cpp,cs,swift}",
      "app/**/*.{js,ts,jsx,tsx,py,rb,go,rs,java,php,c,cpp,cs,swift}",
      "lib/**/*.{js,ts,jsx,tsx,py,rb,go,rs,java,php,c,cpp,cs,swift}",
    ]);

    // Sample up to 3 files
    const sampledFiles = sourceFiles.sort(() => 0.5 - Math.random()).slice(0, 3);
    const patterns: Record<string, any> = {};

    for (const file of sampledFiles) {
      try {
        const fullPath = path.join(dirPath, file);
        const content = await fs.readFile(fullPath, "utf-8");
        patterns[file] = content.split("\n").slice(0, 100).join("\n");
      } catch (e) {
        // Skip
      }
    }

    // Heuristic analysis
    const allSampleContent = Object.values(patterns).join("\n");
    const detected = {
      namingStyle: /_/.test(allSampleContent) ? "snake_case" : "camelCase",
      indentation: /\t/.test(allSampleContent) ? "tabs" : "spaces",
      quoteStyle: /'/.test(allSampleContent) ? "single" : "double",
      lineLengthAvg: Math.round(allSampleContent.length / (allSampleContent.split("\n").length || 1)),
      hasComments: /\/\/|#|\/\*/.test(allSampleContent),
      commentStyle: /\/\*/.test(allSampleContent) ? "multi-line" : "single-line",
    };

    const recommendations = [];
    if (conventionFiles.length > 0) {
      recommendations.push("Project has explicit conventions/linter config - good for maintainability!");
    } else {
      recommendations.push("No explicit linter/style config found. Consider adding .eslintrc or .editorconfig.");
    }
    recommendations.push(`Detected naming style: ${detected.namingStyle}. Ensure consistency across the codebase.`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Project style analysis completed. Found ${conventionFiles.length} convention/linter files in local directory. Sampled ${sampledFiles.length} source files to infer codebase patterns.`,
              conventions: {
                found: conventionFiles.length > 0,
                files: conventions,
                message: `Found ${conventionFiles.length} convention/linter files in local directory.`,
              },
              patterns: {
                sampled: sampledFiles.length,
                files: patterns,
                detected,
                message: `Sampled ${sampledFiles.length} source files to infer codebase patterns.`,
              },
              recommendations,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error sniffing style: ${error.message}` }],
      isError: true,
    };
  }
}

export async function handleFetchRepo(
  args: FetchRepoArgs
): Promise<McpToolResponse> {
  const { repoUrl, branch, tag, authToken, sshKeyPath, localProjectPath } = args;

  try {
    const url = validateStringParam(repoUrl, "repoUrl");
    const release = await operationLimiter.acquire();
    
    try {
      const { cloneOrUpdateRepo, getRepoCachePath } = await import("../utils/git.js");
      const targetDir = getRepoCachePath(url, { branch, tag, localProjectPath });
      
      await cloneOrUpdateRepo(url, targetDir, { branch, tag, authToken, sshKeyPath });

      const files = await FileScanner.findFiles({ dirPath: targetDir }, [
        "README*",
        "docs/**/*.md",
        "DOCUMENTATION*",
        "CONTRIBUTING*",
        "CODE_OF_CONDUCT*",
        "GEMINI.md",
      ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `Successfully cloned/fetched and explored repository. Found ${files.length} files.`,
                tempDirectory: targetDir,
                files: files.map((f: string) => path.join(targetDir, f)),
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
      content: [{ type: "text", text: `Error fetching repo: ${error.message}` }],
      isError: true,
    };
  }
}
