/**
 * Sync & artifact tools: sync_documentation, check_artefacts
 */
import { glob } from "glob";
import { getIgnorePatterns } from "../utils/file.js";
import * as path from "node:path";
import { simpleGit } from "simple-git";
import {
  validateStringParam,
  validateDirPath,
} from "../utils/validation.js";
import { operationLimiter } from "../utils/semaphore.js";
import { logger } from "../utils/logger.js";
import {
  type McpToolResponse,
  type SyncDocumentationArgs,
  type CheckArtefactsArgs,
} from "../types/tools.js";

export async function handleSyncDocumentation(
  args: SyncDocumentationArgs
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
        try {
          const git = simpleGit(dirPath);
          const status = await git.status();
          changedFiles = [
            ...status.modified,
            ...status.created,
            ...status.renamed.map((r: any) => r.to),
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

export async function handleCheckArtefacts(
  args: CheckArtefactsArgs
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
        const ignorePatterns = await getIgnorePatterns(dirPath);
        docs = await glob("**/*.md", {
          cwd: dirPath,
          ignore: ignorePatterns,
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

      const staleDocArtefacts: Array<{
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
          staleDocArtefacts.push({
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
      staleDocArtefacts.sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: `Found ${staleDocArtefacts.length} documentation artefacts that may need updates.`,
                priorityMode: mode,
                sinceCommit: sinceCommit || "recent commits",
                staleArtefacts: staleDocArtefacts,
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
        { type: "text", text: `Error checking artefacts: ${error.message}` },
      ],
      isError: true,
    };
  }
}
