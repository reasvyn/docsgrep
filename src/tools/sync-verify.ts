/**
 * Sync & verification tools: sync_docs, verify_truth, spot_delta, catch_fossils
 */
import { glob } from "glob";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { simpleGit } from "simple-git";
import {
  validateStringParam,
  validateDirPath,
  escapeRegex,
} from "../utils/validation.js";
import { operationLimiter } from "../utils/semaphore.js";
import { logger } from "../utils/logger.js";
import {
  type McpToolResponse,
  type SyncDocsArgs,
  type VerifyTruthArgs,
  type SpotDeltaArgs,
  type CatchFossilsArgs,
} from "../types/tools.js";

// Language-agnostic code file patterns
const CODE_FILE_PATTERNS = [
  "**/*.{js,ts,jsx,tsx,py,rb,go,rs,java,php,c,cpp,cs,swift,dart,kt,scala,ex,exs,cljs,vue,svelte}",
];

export async function handleSyncDocs(
  args: SyncDocsArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, filePaths, updateMode } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    const mode = ["create", "update", "both"].includes(updateMode || "")
      ? updateMode
      : "update";

    const release = await operationLimiter.acquire();
    try {
      let changedFiles: string[] = [];

      if (filePaths && filePaths.length > 0) {
        changedFiles = filePaths.map((f: string) => path.resolve(f));
      } else {
        // Try to get changed files from git
        try {
          const git = simpleGit(dirPath);
          const status = await git.status();
          changedFiles = [
            ...status.modified,
            ...status.created,
            ...status.renamed.map((r) => r.to),
          ].map((f: string) => path.join(dirPath, f));
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
        { type: "text", text: `Error syncing docs: ${error.message}` },
      ],
      isError: true,
    };
  }
}

export async function handleVerifyTruth(
  args: VerifyTruthArgs
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

      // Enhanced pattern: capture name AND parameter list
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
        codeFiles = await glob(CODE_FILE_PATTERNS, {
          cwd: dirPath,
          ignore: [
            "**/node_modules/**",
            "**/.git/**",
            "**/dist/**",
            "**/build/**",
          ],
        });
      } catch (e: any) {
        logger.error("Error finding code files", { error: e.message });
      }

      const issues: Array<{
        item: string;
        status: string;
        suggestion?: string;
      }> = [];

      // Limit to 50 checks
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
            
            // Search for the symbol in code with its param list
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

export async function handleSpotDelta(
  args: SpotDeltaArgs
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

      // Language-agnostic patterns for documented items
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
        codeFiles = await glob(CODE_FILE_PATTERNS, {
          cwd: dirPath,
          ignore: ["**/node_modules/**", "**/.git/**"],
        });
      } catch (e: any) {
        logger.error("Error finding code files", { error: e.message });
      }

      const deltas: Array<{
        item: string;
        docStatus: string;
        codeStatus: string;
      }> = [];

      // Limit to 30 items
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

export async function handleCatchFossils(
  args: CatchFossilsArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, sinceCommit, priorityMode } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    const mode = ["impact", "recency"].includes(priorityMode || "")
      ? priorityMode
      : "impact";

    const release = await operationLimiter.acquire();
    try {
      let docs: string[] = [];
      try {
        docs = await glob("**/*.md", {
          cwd: dirPath,
          ignore: ["**/node_modules/**", "**/.git/**"],
        });
      } catch (e: any) {
        logger.error("Error finding docs", { error: e.message });
      }

      let changedFiles: string[] = [];
      try {
        const git = simpleGit(dirPath);
        const logOptions: any = { n: 50 };
        if (sinceCommit) {
          logOptions.from = sinceCommit;
        }
        const log = await git.log(logOptions);
        changedFiles = log.all.flatMap(
          (commit) => commit.diff?.files?.map((f: any) => f.file) || []
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
        const docRelative = doc;
        const docDir = path.dirname(docRelative);

        const relatedChanges = changedFiles.filter((f: string) => {
          const changedDir = path.dirname(f);
          return (
            f.includes(path.basename(doc, ".md")) ||
            changedDir === docDir ||
            changedDir.startsWith(docDir)
          );
        });

        if (relatedChanges.length > 0) {
          fossilDocs.push({
            file: path.join(dirPath, doc),
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
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
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
        { type: "text", text: `Error catching fossils: ${error.message}` },
      ],
      isError: true,
    };
  }
}
