/**
 * clone_repo tool — clone remote git repositories for documentation analysis
 */
import {
  type McpToolResponse,
  type CloneRepoArgs,
} from "../types/tools.js";
import { validateStringParam } from "../utils/validation.js";
import * as path from "node:path";
import { operationLimiter } from "../utils/semaphore.js";
import { FileScanner } from "./base.js";

export async function handleCloneRepo(
  args: CloneRepoArgs
): Promise<McpToolResponse> {
  const { repoUrl, branch, tag, authToken, sshKeyPath, localProjectPath } = args;

  try {
    const url = validateStringParam(repoUrl, "repoUrl");
    const release = await operationLimiter.acquire();
    
    try {
      const { cloneOrUpdateRepo, getRepoCachePath } = await import("../utils/git.js");
      const targetDir = getRepoCachePath(url, { branch, tag, localProjectPath });
      await cloneOrUpdateRepo(url, targetDir, { branch, tag, authToken, sshKeyPath });

      const files = await FileScanner.findFiles({ dirPath: targetDir }, [
        "README*", "docs/**/*.md", "DOCUMENTATION*", "CONTRIBUTING*", "CODE_OF_CONDUCT*", "GEMINI.md",
      ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: `Cloned repository. Found ${files.length} files.`,
              cachePath: targetDir,
              files: files.map((f: string) => path.join(targetDir, f)),
            }, null, 2),
          },
        ],
      };
    } finally {
      release();
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error cloning repo: ${error.message}` }],
      isError: true,
    };
  }
}
