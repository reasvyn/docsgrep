/**
 * Verification tools: verify_docs, check_delta
 */
import { glob } from "glob";
import { getIgnorePatterns } from "../utils/file.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  validateStringParam,
  validateDirPath,
  escapeRegex,
} from "../utils/validation.js";
import { operationLimiter } from "../utils/semaphore.js";
import { logger } from "../utils/logger.js";
import { SupportedLanguage } from "../utils/supported-language.js";
import {
  type McpToolResponse,
  type VerifyDocsArgs,
  type CheckDeltaArgs,
} from "../types/tools.js";

const CODE_FILE_PATTERNS = (() => {
  const ext = SupportedLanguage.all().flatMap(l => l.extensions).join(",");
  return [`**/*.{${ext}}`];
})();

export async function handleVerifyDocs(
  args: VerifyDocsArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, docPath, strictMode } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    const validatedDocPath = validateStringParam(docPath, "docPath");
    const resolvedDocPath = path.resolve(validatedDocPath);
    const isStrict = strictMode === true;

    const release = await operationLimiter.acquire();
    try {
      const docContent = await fs.readFile(resolvedDocPath, "utf-8");

      const methodPattern = /(?:function|def|func|fn|method)\s+(\w+)\s*\(([^)]*)\)/gi;
      const documentedItems: Array<{name: string, params: string}> = [];
      let match;

      while ((match = methodPattern.exec(docContent)) !== null) {
        documentedItems.push({
          name: match[1],
          params: match[2].trim()
        });
      }

      let codeFiles: string[] = [];
      try {
        const ignorePatterns = await getIgnorePatterns(dirPath);
        codeFiles = await glob(CODE_FILE_PATTERNS, {
          cwd: dirPath,
          ignore: ignorePatterns,
        });

      } catch (e: any) {
        logger.error("Error finding code files", { error: e.message });
      }

      const issues: Array<{
        item: string;
        status: string;
        suggestion?: string;
      }> = [];

      for (const item of documentedItems.slice(0, 50)) {
        let found = false;
        let signatureMatch = false;
        const escapedName = escapeRegex(item.name);
        const docParamCount = item.params ? item.params.split(',').length : 0;

        for (const codeFile of codeFiles) {
          try {
            const content = await fs.readFile(
              path.join(dirPath, codeFile),
              "utf-8"
            );
            
            const codePattern = new RegExp(`(?:function|def|func|fn|method|class)\\s+${escapedName}\\s*\\(([^)]*)\\)`, 'gi');
            let codeMatch;
            while ((codeMatch = codePattern.exec(content)) !== null) {
              found = true;
              const codeParams = codeMatch[1].trim();
              const codeParamCount = codeParams ? codeParams.split(',').length : 0;
              
              if (codeParamCount === docParamCount) {
                signatureMatch = true;
                break;
              }
            }
            if (signatureMatch) break;
          } catch (e) {
            // Skip
          }
        }

        if (!found) {
          issues.push({
            item: item.name,
            status: "not_found",
            suggestion: "Symbol not found in any code file.",
          });
        } else if (!signatureMatch) {
          issues.push({
            item: item.name,
            status: "signature_mismatch",
            suggestion: `Parameter count mismatch. Doc has ${docParamCount}, but code implementation differs.`,
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

export async function handleCheckDelta(
  args: CheckDeltaArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, docPath, includeCodeSnippets } = args;

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

      let codeFiles: string[] = [];
      try {
        const ignorePatterns = await getIgnorePatterns(dirPath);
        codeFiles = await glob(CODE_FILE_PATTERNS, {
          cwd: dirPath,
          ignore: ignorePatterns,
        });

      } catch (e: any) {
        logger.error("Error finding code files", { error: e.message });
      }

      const deltas: Array<{
        item: string;
        docStatus: string;
        codeStatus: string;
      }> = [];

      for (const item of documentedItems.slice(0, 30)) {
        let found = false;
        const escapedName = escapeRegex(item.name);
        for (const codeFile of codeFiles) {
          try {
            const content = await fs.readFile(
              path.join(dirPath, codeFile),
              "utf-8"
            );
            if (new RegExp(`\\b${escapedName}\\b`).test(content)) {
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
          codeStatus: found ? "found in code" : "NOT FOUND in code",
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
        { type: "text", text: `Error spotting delta: ${error.message}` },
      ],
      isError: true,
    };
  }
}
