/**
 * Project analysis tools: detect_stack, check_style
 */
import {
  type McpToolResponse,
  type DetectStackArgs,
  type CheckStyleArgs,
} from "../types/tools.js";
import { validateDirPath, validateStringParam } from "../utils/validation.js";
import { SupportedLanguage } from "../utils/supported-language.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { FileScanner } from "./base.js";

export async function handleDetectStack(
  args: DetectStackArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, excludePath } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

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
