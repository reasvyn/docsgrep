/**
 * measure_coverage tool — analyze documentation coverage across source files
 */
import { glob } from "glob";
import { getIgnorePatterns } from "../utils/file.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  validateStringParam,
  validateDirPath,
} from "../utils/validation.js";
import { operationLimiter } from "../utils/semaphore.js";
import {
  type McpToolResponse,
  type MeasureCoverageArgs,
} from "../types/tools.js";
import { SupportedLanguage } from "../utils/supported-language.js";

export async function handleMeasureCoverage(
  args: MeasureCoverageArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, filePatterns, publicOnly } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    const isPublicOnly = publicOnly !== false;

    const allExt = SupportedLanguage.all().flatMap(l => l.extensions).join(",");
    const patterns = filePatterns || [
      `src/**/*.{${allExt}}`,
      `lib/**/*.{${allExt}}`,
      `app/**/*.{${allExt}}`,
    ];

    const release = await operationLimiter.acquire();
    try {
      const ignorePatterns = await getIgnorePatterns(dirPath);
      const files = await glob(patterns, {
        cwd: dirPath,
        ignore: ignorePatterns,
      });

      let totalItems = 0;
      let documentedItems = 0;
      const undocumentedList: Array<{
        file: string;
        line: number;
        item: string;
        type: string;
      }> = [];

      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const lines = content.split("\n");
          const ext = path.extname(file).toLowerCase();

          let itemRegex: RegExp;
          if (ext === ".py") {
            itemRegex = /^\s*(?:def|class)\s+(\w+)/;
          } else if (ext === ".go") {
            itemRegex = /\bfunc\s+(?:\([^)]+\)\s+)?(\w+)/;
          } else if (ext === ".rs") {
            itemRegex = /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/;
          } else {
            itemRegex = /^\s*(?:export\s+)?(?:public|protected|private|static|async)?\s*(?:function|class|method|interface|enum|fn)\s+(\w+)/;
            if (isPublicOnly) {
              itemRegex = /^\s*(?:export|public)\s+(?:async\s+)?(?:function|class|method|interface|enum)\s+(\w+)/;
            }
          }

          const numDocLines = lines.length;
          for (let i = 0; i < numDocLines; i++) {
            const line = lines[i];
            const match = line.match(itemRegex);

            if (match) {
              const itemName = match[1];
              const itemType = line.includes("class") ? "class" : "function";
              totalItems++;

              let hasDoc = false;

              if (ext === ".py") {
                const nextLine = lines[i + 1]?.trim();
                if (nextLine && (nextLine.startsWith('"""') || nextLine.startsWith("'''"))) {
                  hasDoc = true;
                }
              } else {
                for (let j = 1; j <= 3; j++) {
                  const prevLine = lines[i - j]?.trim();
                  if (prevLine) {
                    if (prevLine.endsWith("*/") || prevLine.startsWith("///") || (ext === ".go" && prevLine.startsWith("//"))) {
                      hasDoc = true;
                      break;
                    }
                    if (!prevLine.startsWith("/") && !prevLine.startsWith("*")) {
                      break;
                    }
                  }
                }
              }

              if (hasDoc) {
                documentedItems++;
              } else {
                undocumentedList.push({
                  file,
                  line: i + 1,
                  item: itemName,
                  type: itemType,
                });
              }
            }
          }
        } catch (e) {
          // Skip
        }
      }

      const coverage = totalItems > 0 ? (documentedItems / totalItems) * 100 : 100;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `Documentation coverage: ${coverage.toFixed(
                  2
                )}% (${documentedItems}/${totalItems} items documented).`,
                summary: {
                  totalItems,
                  documentedItems,
                  undocumentedItems: totalItems - documentedItems,
                  coveragePercentage: parseFloat(coverage.toFixed(2)),
                },
                undocumentedList: undocumentedList.slice(0, 100),
                note:
                  undocumentedList.length > 100
                    ? "List limited to 100 items."
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
        { type: "text", text: `Error gauging doc coverage: ${error.message}` },
      ],
      isError: true,
    };
  }
}
