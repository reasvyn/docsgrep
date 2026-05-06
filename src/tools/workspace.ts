/**
 * Workspace tools: setup_camp, purge_cache
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { validateStringParam, validateDirPath } from "../utils/validation.js";
import { logger } from "../utils/logger.js";
import { AppInfo } from "../utils/app-info.js";
import { getCacheSize, cleanupCache } from "../utils/file.js";
import { MAX_CACHE_SIZE_MB } from "../utils/constants.js";
import {
  type McpToolResponse,
  type SetupCampArgs,
  type PurgeCacheArgs,
} from "../types/tools.js";

export function registerWorkspaceTools(server: Server): void {
  // Tools are registered in the main ListTools handler
}

export async function handleSetupCamp(
  args: SetupCampArgs
): Promise<McpToolResponse> {
  const { projectPath: rawPath } = args;

  try {
    const projectPath = validateDirPath(
      validateStringParam(rawPath, "projectPath")
    );

    // Prioritize project directory for persistence, fallback to system temp
    let workspacePath: string;
    let usedSystemTemp = false;

    try {
      const projectLocalPath = path.join(projectPath, ".docsgrep");
      await fs.mkdir(path.join(projectLocalPath, "cache", "repos"), { recursive: true });
      await fs.mkdir(path.join(projectLocalPath, "logs"), { recursive: true });
      await fs.mkdir(path.join(projectLocalPath, "reports"), {
        recursive: true,
      });
      workspacePath = projectLocalPath;
      usedSystemTemp = false;
    } catch (e) {
      // Fallback to system temp directory
      const systemTempPath = path.join(
        os.tmpdir(),
        "docsgrep",
        path.basename(projectPath)
      );
      await fs.mkdir(path.join(systemTempPath, "repos"), { recursive: true });
      await fs.mkdir(path.join(systemTempPath, "logs"), { recursive: true });
      await fs.mkdir(path.join(systemTempPath, "reports"), {
        recursive: true,
      });
      workspacePath = systemTempPath;
      usedSystemTemp = true;
    }

    const contextInfo = {
      initializedAt: new Date().toISOString(),
      projectPath: projectPath,
      workspacePath: workspacePath,
      version: AppInfo.version,
      storageType: usedSystemTemp ? "system-temp" : "project-local",
    };
    await fs.writeFile(
      path.join(workspacePath, "context.json"),
      JSON.stringify(contextInfo, null, 2)
    );

    // Update .gitignore - Always ensure .docsgrep is ignored in the project
    try {
      const gitignorePath = path.join(projectPath, ".gitignore");
      let gitignoreContent = "";
      try {
        gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
      } catch (e) {
        // .gitignore doesn't exist
      }
      if (!gitignoreContent.includes(".docsgrep/")) {
        const padding = gitignoreContent && !gitignoreContent.endsWith("\n") ? "\n" : "";
        await fs.writeFile(
          gitignorePath,
          gitignoreContent + `${padding}\n# docsgrep workspace and cache\n.docsgrep/\n`
        );
      }
    } catch (e) {
      // Ignore errors updating .gitignore
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully initialized docsgrep workspace at ${workspacePath} (${
            usedSystemTemp ? "system temp directory" : "project directory"
          }).`,
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

export async function handlePurgeCache(
  args: PurgeCacheArgs
): Promise<McpToolResponse> {
  const { localProjectPath: rawPath, maxAgeDays } = args;

  try {
    const localProjectPath = validateDirPath(
      validateStringParam(rawPath, "localProjectPath")
    );
    let reposDir = path.join(
      os.tmpdir(),
      "docsgrep",
      path.basename(localProjectPath),
      "repos"
    );

    // Check new persistent path first
    const newReposDir = path.join(localProjectPath, ".docsgrep", "cache", "repos");
    // Check old path for backward compatibility
    const oldReposDir = path.join(localProjectPath, ".docsgrep", "repos");
    
    try {
      await fs.access(newReposDir);
      reposDir = newReposDir;
    } catch (e) {
      try {
        await fs.access(oldReposDir);
        reposDir = oldReposDir;
      } catch (e2) {
        // Use system temp as default if project folders don't exist
      }
    }

    const maxAgeMs =
      (maxAgeDays && maxAgeDays > 0 ? maxAgeDays : 7) * 24 * 60 * 60 * 1000;
    const cleaned = await cleanupCache(reposDir, maxAgeMs);

    // Also clean system-wide cache
    const systemCacheDir = path.join(os.tmpdir(), "docsgrep");
    if (reposDir !== systemCacheDir) {
      const systemCleaned = await cleanupCache(systemCacheDir, maxAgeMs);
      cleaned.push(...systemCleaned);
    }

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
