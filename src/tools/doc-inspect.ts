/**
 * Inspection tools: read_file, summarize_doc, check_stale, get_context
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  validateStringParam,
  validateDirPath,
} from "../utils/validation.js";
import { operationLimiter } from "../utils/semaphore.js";
import { streamReadFile, isBinaryFile } from "../utils/file.js";
import { MAX_FILE_SIZE_READ } from "../utils/constants.js";
import { logger } from "../utils/logger.js";
import {
  type McpToolResponse,
  type ReadFileArgs,
  type SummarizeDocArgs,
  type CheckStaleArgs,
  type GetContextArgs,
} from "../types/tools.js";
import { findDocsInDir } from "./doc-find.js";

export async function handleReadFile(
  args: ReadFileArgs
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

export async function handleSummarizeDoc(
  args: SummarizeDocArgs
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

export async function handleCheckStale(
  args: CheckStaleArgs
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

export async function handleGetContext(
  args: GetContextArgs
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

        const isImported = importedModules.some(
          (m) => docBasename.includes(m) || m.includes(docBasename)
        );

        if (isImported) {
          relevance = "high";
          reason = "Related to an imported module";
        } else if (docBasename === "readme") {
          relevance = "high";
          reason = "README file";
        } else if (docDir === relativeFileDir) {
          relevance = "high";
          reason = "Same directory as current file";
        } else if (
          relativeFileDir.startsWith(docDir + path.sep) &&
          docDir !== "."
        ) {
          relevance = "high";
          reason = "Doc is in parent directory";
        } else if (docDir.startsWith(relativeFileDir + path.sep)) {
          relevance = "medium";
          reason = "Doc is in subdirectory";
        } else if (docDir !== "." && relativeFileDir !== ".") {
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
