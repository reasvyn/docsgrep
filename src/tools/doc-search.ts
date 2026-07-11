/**
 * Search tools: search_docs, semantic_search, find_related
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  validateStringParam,
  validateDirPath,
} from "../utils/validation.js";
import { operationLimiter } from "../utils/semaphore.js";
import {
  type McpToolResponse,
  type SearchDocsArgs,
  type SemanticSearchArgs,
  type FindRelatedArgs,
} from "../types/tools.js";
import { findDocsInDir } from "./doc-find.js";

// Score line type (title/heading/body)
function getLineTypeScore(line: string): number {
  const trimmed = line.trim();
  if (/^# /.test(trimmed)) return 50; // H1 title
  if (/^##+ /.test(trimmed)) return 30; // H2+ heading
  return 10; // Body text
}

// Score file importance
function getFileImportanceScore(filePath: string, dirPath: string): number {
  const relativePath = path.relative(dirPath, filePath);
  const fileName = path.basename(filePath).toLowerCase();
  if (/readme/.test(fileName)) return 20;
  if (relativePath.startsWith("docs/")) return 15;
  return 5;
}

// Score match precision
function getMatchPrecisionScore(line: string, searchRegex: RegExp): number {
  try {
    const wordBoundaryRegex = new RegExp(`\\b${searchRegex.source}\\b`, "i");
    return wordBoundaryRegex.test(line) ? 20 : 5;
  } catch {
    return 5;
  }
}

export async function handleSearchDocs(
  args: SearchDocsArgs
): Promise<McpToolResponse> {
  const { dirPath: rawPath, pattern, filePattern, contextLines } = args;

  try {
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    const validatedPattern = validateStringParam(pattern, "pattern");
    const contextSize =
      contextLines && contextLines > 0 ? Math.min(contextLines, 5) : 0;

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
            const filePatternRegex = new RegExp(filePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
            if (!filePatternRegex.test(file)) continue;
          } catch (e) {
            throw new Error(`Invalid filePattern regex: ${filePattern}`);
          }
        }

        try {
          const content = await fs.readFile(file, "utf-8");
          const lines = content.split("\n");
          const numLines = lines.length;
          for (let i = 0; i < numLines; i++) {
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

export async function handleSemanticSearch(
  args: SemanticSearchArgs
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

export async function handleFindRelated(
  args: FindRelatedArgs
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
        { type: "text", text: `Error finding related documentation: ${error.message}` },
      ],
      isError: true,
    };
  }
}
