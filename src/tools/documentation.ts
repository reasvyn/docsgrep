/**
 * Documentation tools: hunt_docs, peek_file, grep_docs, fathom_meaning, tldr_docs, hunt_related, smell_stale, sense_surroundings
 */
import { glob } from "glob";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  validateStringParam,
  validateDirPath,
  escapeRegex,
} from "../utils/validation.js";
import { operationLimiter } from "../utils/semaphore.js";
import { streamReadFile, isBinaryFile } from "../utils/file.js";
import { MAX_FILE_SIZE_READ } from "../utils/constants.js";
import { logger } from "../utils/logger.js";
import {
  type McpToolResponse,
  type HuntDocsArgs,
  type PeekFileArgs,
  type GrepDocsArgs,
  type FathomMeaningArgs,
  type TldrDocsArgs,
  type HuntRelatedArgs,
  type SmellStaleArgs,
  type SenseSurroundingsArgs,
  type GaugeDocsArgs,
} from "../types/tools.js";

// Helper function to find docs in a given directory (language-agnostic, all .md files)
export async function findDocsInDir(dirPath: string): Promise<string[]> {
  const allMdFiles = await glob("**/*.md", {
    cwd: dirPath,
    nocase: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/target/**",
      "**/vendor/**",
      "**/.next/**",
      "**/.nuxt/**",
    ],
  });

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
  if (relativePath.startsWith("docs/")) return 15;
  return 5;
}

// Helper: Score match precision
function getMatchPrecisionScore(line: string, searchRegex: RegExp): number {
  try {
    const wordBoundaryRegex = new RegExp(`\\b${searchRegex.source}\\b`, "i");
    return wordBoundaryRegex.test(line) ? 20 : 5;
  } catch {
    return 5;
  }
}

export async function handleHuntDocs(
  args: HuntDocsArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath } = args;

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

export async function handlePeekFile(
  args: PeekFileArgs
): Promise<McpToolResponse> {
  const { filePath } = args;

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
      logger.info(
        `File exceeds limit, streaming first ${MAX_FILE_SIZE_READ} bytes`,
        {
          filePath,
          size: stat.size,
        }
      );
      const streamResult = await streamReadFile(
        resolvedPath,
        MAX_FILE_SIZE_READ
      );
      return {
        content: [
          {
            type: "text",
            text:
              streamResult.content +
              `\n\n[... File truncated. Total size: ${stat.size} bytes. Showing first ${streamResult.bytesRead} bytes ...]`,
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
        { type: "text", text: `Error reading file ${filePath}: ${error.message}` },
      ],
      isError: true,
    };
  }
}

export async function handleGrepDocs(
  args: GrepDocsArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, pattern, filePattern, contextLines } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    const validatedPattern = validateStringParam(pattern, "pattern");
    const contextSize =
      contextLines && contextLines > 0 ? Math.min(contextLines, 5) : 0;

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
        context?: string[];
        score: number;
      }> = [];

      for (const file of docs) {
        if (filePattern) {
          try {
            const filePatternRegex = new RegExp(escapeRegex(filePattern));
            if (!filePatternRegex.test(file)) continue;
          } catch (e) {
            throw new Error(`Invalid filePattern regex: ${filePattern}`);
          }
        }

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
              const totalScore = lineTypeScore + fileScore + precisionScore;

              const result: any = {
                file,
                line: i + 1,
                content: lineText.trim(),
                score: totalScore,
              };

              if (contextSize > 0) {
                const start = Math.max(0, i - contextSize);
                const end = Math.min(lines.length - 1, i + contextSize);
                result.context = lines
                  .slice(start, end + 1)
                  .map((l) => l.trimEnd());
              }

              results.push(result);
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
                results: results.slice(0, 50).map((r) => ({
                  file: r.file,
                  line: r.line,
                  content: r.content,
                  context: r.context,
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
        { type: "text", text: `Error searching docs: ${error.message}` },
      ],
      isError: true,
    };
  }
}

export async function handleFathomMeaning(
  args: FathomMeaningArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, query, topK } = args;

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
        .filter((w: string) => w.length > 2);
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
              lines.forEach((line: string, idx: number) => {
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

export async function handleTldrDocs(
  args: TldrDocsArgs
): Promise<McpToolResponse> {
  const { filePath, maxLength } = args;

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
      } else if (summaryParts.length > 0 && !/^#+\s/.test(lines[i - 1] || "")) {
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
              message: `Summary of ${path.basename(
                resolvedPath
              )} (${summary.length} chars)`,
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
        { type: "text", text: `Error summarizing document: ${error.message}` },
      ],
      isError: true,
    };
  }
}

export async function handleHuntRelated(
  args: HuntRelatedArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, topic, threshold } = args;

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
        .filter((w: string) => w.length > 2);
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
            lowerContent.split(/\W+/).filter((w: string) => w.length > 2)
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
        { type: "text", text: `Error hunting related docs: ${error.message}` },
      ],
      isError: true,
    };
  }
}

export async function handleSmellStale(
  args: SmellStaleArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, maxAgeDays, compareWithCode } = args;

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
          const daysSince = Math.floor(ageMs / (24 * 60 * 60 * 1000));

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
        { type: "text", text: `Error detecting stale docs: ${error.message}` },
      ],
      isError: true,
    };
  }
}

export async function handleSenseSurroundings(
  args: SenseSurroundingsArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, currentFilePath, contextDepth } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    const validatedFile = validateStringParam(
      currentFilePath,
      "currentFilePath"
    );
    const resolvedFile = path.resolve(validatedFile);
    const depth = ["minimal", "standard", "deep"].includes(contextDepth || "")
      ? contextDepth
      : "standard";

    const release = await operationLimiter.acquire();
    try {
      const fileDir = path.dirname(resolvedFile);
      const relativeFileDir = path.relative(dirPath, fileDir);

      // IMPORT ANALYSIS: Read current file to find imports
      const importedModules: string[] = [];
      try {
        const fileContent = await fs.readFile(resolvedFile, "utf-8");
        const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(fileContent)) !== null) {
          const importPath = match[1];
          if (importPath.startsWith(".")) {
            importedModules.push(
              path.basename(importPath, path.extname(importPath)).toLowerCase()
            );
          }
        }
      } catch (e) {
        // Skip import analysis if file can't be read
      }

      const docs = await findDocsInDir(dirPath);
      const relevantDocs: Array<{
        file: string;
        relevance: string;
        reason: string;
      }> = [];

      for (const doc of docs) {
        const docRelative = path.relative(dirPath, doc);
        const docDir = path.dirname(docRelative);
        const docBasename = path.basename(doc, ".md").toLowerCase();

        let relevance = "medium";
        let reason = "General documentation";

        // Check if doc matches an imported module
        const isImported = importedModules.some(
          (m) => docBasename.includes(m) || m.includes(docBasename)
        );

        if (isImported) {
          relevance = "high";
          reason = "Related to an imported module";
        }
        // README is always highly relevant
        else if (docBasename === "readme") {
          relevance = "high";
          reason = "README file";
        }
        // Same directory
        else if (docDir === relativeFileDir) {
          relevance = "high";
          reason = "Same directory as current file";
        }
        // Doc is in a parent directory
        else if (
          relativeFileDir.startsWith(docDir + path.sep) &&
          docDir !== "."
        ) {
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
                message: `Found ${relevantDocs.length} relevant docs for ${path.basename(
                  resolvedFile
                )}.`,
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
        { type: "text", text: `Error sensing surroundings: ${error.message}` },
      ],
      isError: true,
    };
  }
}

export async function handleGaugeDocs(
  args: GaugeDocsArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, filePatterns, publicOnly } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    const isPublicOnly = publicOnly !== false;

    // Source file patterns to scan for docblocks
    const patterns = filePatterns || [
      "src/**/*.{js,ts,jsx,tsx,php,py,rb,go,rs,java,cpp,c,cs,swift,dart}",
      "lib/**/*.{js,ts,jsx,tsx,php,py,rb,go,rs,java,cpp,c,cs,swift,dart}",
      "app/**/*.{js,ts,jsx,tsx,php,py,rb,go,rs,java,cpp,c,cs,swift,dart}",
    ];

    const release = await operationLimiter.acquire();
    try {
      const files = await glob(patterns, {
        cwd: dirPath,
        ignore: [
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
          "**/*.test.*",
          "**/*.spec.*",
          "**/test/**",
          "**/tests/**",
        ],
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

          // Regex patterns for documentable items (functions, classes, etc.)
          let itemRegex: RegExp;
          if (ext === ".py") {
            itemRegex = /^\s*(?:def|class)\s+(\w+)/;
          } else if (ext === ".go") {
            itemRegex = /\bfunc\s+(?:\([^)]+\)\s+)?(\w+)/;
          } else if (ext === ".rs") {
            itemRegex = /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/;
          } else {
            // General C-style (JS, TS, PHP, Java, etc.)
            itemRegex = /^\s*(?:export\s+)?(?:public|protected|private|static|async)?\s*(?:function|class|method|interface|enum|fn)\s+(\w+)/;
            if (isPublicOnly) {
              itemRegex = /^\s*(?:export|public)\s+(?:async\s+)?(?:function|class|method|interface|enum)\s+(\w+)/;
            }
          }

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(itemRegex);

            if (match) {
              const itemName = match[1];
              const itemType = line.includes("class") ? "class" : "function";
              totalItems++;

              let hasDoc = false;

              if (ext === ".py") {
                // Python: docstring is inside the block on the next line(s)
                const nextLine = lines[i + 1]?.trim();
                if (nextLine && (nextLine.startsWith('"""') || nextLine.startsWith("'''"))) {
                  hasDoc = true;
                }
              } else {
                // Others: docblock is above the item
                // Check 3 lines above
                for (let j = 1; j <= 3; j++) {
                  const prevLine = lines[i - j]?.trim();
                  if (prevLine) {
                    if (prevLine.endsWith("*/") || prevLine.startsWith("///") || (ext === ".go" && prevLine.startsWith("//"))) {
                      hasDoc = true;
                      break;
                    }
                    // If we hit code that isn't a comment, stop searching
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

