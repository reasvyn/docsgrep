/**
 * Workspace tools: init_workspace, clear_cache
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { validateStringParam, validateDirPath } from "../utils/validation.js";
import { logger } from "../utils/logger.js";
import { AppInfo } from "../utils/app-info.js";
import { getCacheSize, cleanupCache } from "../utils/file.js";
import { MAX_CACHE_SIZE_MB } from "../utils/constants.js";
import { ensureWorkspace, ensureGitignore, resolveWorkspace } from "../utils/workspace.js";
import {
  type McpToolResponse,
  type InitWorkspaceArgs,
  type ClearCacheArgs,
} from "../types/tools.js";

export function registerWorkspaceTools(server: Server): void {
  // Tools are registered in the main ListTools handler
}

export async function handleInitWorkspace(
  args: InitWorkspaceArgs
): Promise<McpToolResponse> {
  const { projectPath: rawPath } = args;

  try {
    const projectPath = validateDirPath(
      validateStringParam(rawPath, "projectPath")
    );

    const paths = await ensureWorkspace(projectPath);

    const contextInfo = {
      initializedAt: new Date().toISOString(),
      projectPath,
      workspacePath: paths.root,
      version: AppInfo.version,
      storageType: "project-local",
    };
    await fs.writeFile(paths.contextFile, JSON.stringify(contextInfo, null, 2));

    // Ensure .gitignore includes .docsgrep/
    await ensureGitignore(projectPath);

    return {
      content: [
        {
          type: "text",
          text: `Successfully initialized docsgrep workspace at ${paths.root}.`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error initializing workspace: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleClearCache(
  args: ClearCacheArgs
): Promise<McpToolResponse> {
  const { localProjectPath: rawPath, maxAgeDays } = args;

  try {
    const localProjectPath = validateDirPath(
      validateStringParam(rawPath, "localProjectPath")
    );

    const paths = resolveWorkspace(localProjectPath);
    let reposDir = paths.repos;

    // Backward compat: check old path without cache/ intermediate
    const oldReposDir = path.join(localProjectPath, ".docsgrep", "repos");
    try {
      await fs.access(reposDir);
    } catch {
      try {
        await fs.access(oldReposDir);
        reposDir = oldReposDir;
      } catch {
        // Neither exists — nothing to clean
      }
    }

    const maxAgeMs =
      (maxAgeDays && maxAgeDays > 0 ? maxAgeDays : 7) * 24 * 60 * 60 * 1000;
    const cleaned = await cleanupCache(reposDir, maxAgeMs);

    const cacheSize = await getCacheSize(reposDir);
    const cacheSizeMB = cacheSize / (1024 * 1024);

    let message = `Cleaned up ${cleaned.length} cached repositories.`;
    if (cacheSizeMB > MAX_CACHE_SIZE_MB) {
      message += ` Warning: Cache size (${cacheSizeMB.toFixed(
        2
      )}MB) exceeds limit (${MAX_CACHE_SIZE_MB}MB).`;
    } else {
      message += ` Current cache size: ${cacheSizeMB.toFixed(2)}MB.`;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message,
              cleanedRepos: cleaned,
              cacheSizeMB: parseFloat(cacheSizeMB.toFixed(2)),
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
        { type: "text", text: `Error cleaning cache: ${error.message}` },
      ],
      isError: true,
    };
  }
}
