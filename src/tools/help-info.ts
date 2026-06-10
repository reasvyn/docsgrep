/**
 * Help information for all docsgrep tools — reads docs/tools/*.md directly
 */
import { AppInfo } from "../utils/app-info.js";
import { 
  type McpToolResponse, 
  type ShowHelpArgs,
  type DetectStackArgs,
  type CheckStyleArgs,
  type CloneRepoArgs
} from "../types/tools.js";
import { validateDirPath, validateStringParam } from "../utils/validation.js";
import { SupportedLanguage } from "../utils/supported-language.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { operationLimiter } from "../utils/semaphore.js";
import { FileScanner } from "./base.js";
import { loadConfig } from "../utils/config.js";

const appConfig = loadConfig<any>("app");

const DOCS_TOOLS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "docs", "tools"
);

async function readDocFile(toolName: string): Promise<string | null> {
  const filePath = path.join(DOCS_TOOLS_DIR, `${toolName}.md`);
  try {
    await fs.access(filePath);
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function handleShowHelp(
  args: ShowHelpArgs
): Promise<McpToolResponse> {
  const { toolName } = args;

  if (toolName) {
    const content = await readDocFile(toolName);
    if (!content) {
      return {
        content: [
          {
            type: "text",
            text: `Tool "${toolName}" not found. Use show_help() without arguments to see all tools.`,
          },
        ],
        isError: true,
      };
    }

    return { content: [{ type: "text", text: content }] };
  }

  // List all doc files
  let files: string[];
  try {
    files = await fs.readdir(DOCS_TOOLS_DIR);
  } catch {
    return {
      content: [{ type: "text", text: "Error: docs/tools/ directory not found." }],
      isError: true,
    };
  }

  const mdFiles = files.filter(f => f.endsWith(".md")).sort();
  if (mdFiles.length === 0) {
    return {
      content: [{ type: "text", text: "No documentation files found in docs/tools/." }],
      isError: true,
    };
  }

  let helpText = `# docsgrep Tool Suite (v${AppInfo.version})\n\n`;
  helpText += `${AppInfo.description}\n\n`;
  helpText += `## Available Tools\n\n`;

  for (const file of mdFiles) {
    const fullPath = path.join(DOCS_TOOLS_DIR, file);
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      helpText += `---\n\n${content}\n\n`;
    } catch {
      // skip unreadable files
    }
  }

  return { content: [{ type: "text", text: helpText }] };
}

export async function handleDetectStack(
  args: DetectStackArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, excludePath } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

    // Find package manager files
    const packageFiles = await FileScanner.findFiles({ dirPath, excludePath }, [
      ...SupportedLanguage.all().flatMap(l => l.configFiles),
      "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
      "composer.lock", "Cargo.lock", "Gemfile.lock", "mix.lock",
    ]);

    const files: Record<string, string> = {};
    for (const file of packageFiles) {
      try {
        const fullPath = path.join(dirPath, file);
        const content = await fs.readFile(fullPath, "utf-8");
        files[file] = content.split("\n").slice(0, 100).join("\n");
      } catch (e) {
      }
    }

    const language = SupportedLanguage.fromConfigFile(packageFiles[0]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Found ${packageFiles.length} package manager files in local directory.`,
              language,
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
      content: [{ type: "text", text: `Error detecting stack: ${error.message}` }],
      isError: true,
    };
  }
}

export async function handleCheckStyle(
  args: CheckStyleArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, excludePath } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

    const conventionFiles = await FileScanner.findFiles({ dirPath, excludePath }, [
      ".eslintrc*",
      ".prettierrc*",
      "tsconfig.json",
      ".editorconfig",
      "CONTRIBUTING*",
      "ARCHITECTURE*",
      "STYLEGUIDE*",
      "docs/tools/check_style.md",
    ]);

    const conventions: Record<string, string> = {};
    for (const file of conventionFiles) {
      try {
        const fullPath = path.join(dirPath, file);
        const content = await fs.readFile(fullPath, "utf-8");
        conventions[file] = content.split("\n").slice(0, 100).join("\n");
      } catch (e) {
      }
    }

    const sourceFiles = await FileScanner.findFiles({ dirPath, excludePath }, [
      `src/**/*.{${SupportedLanguage.all().flatMap(l => l.extensions).join(",")}}`,
      `app/**/*.{${SupportedLanguage.all().flatMap(l => l.extensions).join(",")}}`,
      `lib/**/*.{${SupportedLanguage.all().flatMap(l => l.extensions).join(",")}}`,
    ]);

    const sampledFiles = sourceFiles.sort(() => 0.5 - Math.random()).slice(0, 3);
    const patterns: Record<string, any> = {};

    for (const file of sampledFiles) {
      try {
        const fullPath = path.join(dirPath, file);
        const content = await fs.readFile(fullPath, "utf-8");
        patterns[file] = content.split("\n").slice(0, 100).join("\n");
      } catch (e) {
      }
    }

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
      recommendations.push("Project has explicit conventions/linter config.");
    } else {
      recommendations.push("No explicit linter/style config found.");
    }
    recommendations.push(`Detected naming style: ${detected.namingStyle}.`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Found ${conventionFiles.length} convention files. Sampled ${sampledFiles.length} source files.`,
              conventions: { found: conventionFiles.length > 0, files: conventions },
              patterns: { sampled: sampledFiles.length, files: patterns, detected },
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
      content: [{ type: "text", text: `Error checking style: ${error.message}` }],
      isError: true,
    };
  }
}

export async function handleCloneRepo(
  args: CloneRepoArgs
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
        "README*", "docs/**/*.md", "DOCUMENTATION*", "CONTRIBUTING*", "CODE_OF_CONDUCT*", "GEMINI.md",
      ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: `Cloned repository. Found ${files.length} files.`,
              tempDirectory: targetDir,
              files: files.map((f: string) => path.join(targetDir, f)),
            }, null, 2),
          },
        ],
      };
    } finally {
      release();
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error cloning repo: ${error.message}` }],
      isError: true,
    };
  }
}
