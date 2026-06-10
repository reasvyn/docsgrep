/**
 * Git utilities for repository operations
 */
import { simpleGit, type SimpleGit } from "simple-git";
import * as crypto from "node:crypto";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import { withTimeout, withRetry } from "./async.js";
import { GIT_TIMEOUT_MS, MAX_RETRY_ATTEMPTS } from "./constants.js";
import { logger } from "./logger.js";

export async function cloneOrUpdateRepo(
  repoUrl: string,
  targetDir: string,
  options: {
    branch?: string;
    tag?: string;
    authToken?: string;
    sshKeyPath?: string;
  } = {}
): Promise<void> {
  let authenticatedUrl = repoUrl;
  
  // Handle authentication
  if (options.authToken && (repoUrl.startsWith('https://') || repoUrl.startsWith('http://'))) {
    const urlObj = new URL(repoUrl);
    urlObj.username = options.authToken;
    authenticatedUrl = urlObj.toString();
    logger.info("Using token authentication for HTTPS repo");
  }

  const gitOptions: any = {};
  if (options.sshKeyPath) {
    const resolvedKeyPath = path.resolve(options.sshKeyPath);
    gitOptions.config = [`core.sshCommand=ssh -i ${resolvedKeyPath} -o StrictHostKeyChecking=no`];
    logger.info("Using SSH key authentication", { keyPath: resolvedKeyPath });
  }

  // Determine the target version (tag takes precedence over branch)
  const targetVersion = options.tag || options.branch;

  try {
    // Check if repo already exists in cache
    let repoExists = false;
    try {
      await fs.access(targetDir);
      await fs.access(path.join(targetDir, ".git"));
      repoExists = true;
    } catch (e) {
      repoExists = false;
    }

    if (repoExists) {
      // Update existing repo
      logger.info(`Updating cached repository`, { url: repoUrl, target: targetDir, version: targetVersion });
      const git: SimpleGit = simpleGit(targetDir, gitOptions);
      
      const fetchArgs = ["--depth", "1"];
      if (targetVersion) {
        // For tags, we might need to fetch tags explicitly or fetch the ref
        if (options.tag) {
          await withRetry(
            () => withTimeout(git.fetch("origin", `refs/tags/${options.tag}:refs/tags/${options.tag}`, fetchArgs), GIT_TIMEOUT_MS, "git fetch tag"),
            MAX_RETRY_ATTEMPTS,
            "git fetch tag"
          );
        } else {
          await withRetry(
            () => withTimeout(git.fetch("origin", targetVersion, fetchArgs), GIT_TIMEOUT_MS, "git fetch"),
            MAX_RETRY_ATTEMPTS,
            "git fetch"
          );
        }
      } else {
        await withRetry(
          () => withTimeout(git.fetch(fetchArgs), GIT_TIMEOUT_MS, "git fetch"),
          MAX_RETRY_ATTEMPTS,
          "git fetch"
        );
      }

      await withRetry(
        () => withTimeout(git.reset(["--hard", options.tag ? options.tag : "FETCH_HEAD"]), GIT_TIMEOUT_MS, "git reset"),
        MAX_RETRY_ATTEMPTS,
        "git reset"
      );
      await withRetry(
        () => withTimeout(git.clean("f", ["-d"]), GIT_TIMEOUT_MS, "git clean"),
        MAX_RETRY_ATTEMPTS,
        "git clean"
      );
    } else {
      // Clone new repo
      logger.info(`Cloning repository`, { url: repoUrl, target: targetDir, version: targetVersion });
      const git: SimpleGit = simpleGit(gitOptions);
      
      const cloneArgs = ["--depth", "1"];
      if (targetVersion) {
        cloneArgs.push("--branch", targetVersion);
      }
      
      await withRetry(
        () => withTimeout(git.clone(authenticatedUrl, targetDir, cloneArgs), GIT_TIMEOUT_MS, "git clone"),
        MAX_RETRY_ATTEMPTS,
        "git clone"
      );
    }
  } catch (error: any) {
    throw new Error(`Git operation failed: ${error.message}`);
  }
}

export function getRepoCachePath(
  repoUrl: string,
  options: {
    branch?: string;
    tag?: string;
    localProjectPath?: string;
  } = {}
): string {
  const { branch, tag, localProjectPath } = options;
  
  // Use user home directory for persistence instead of system tmp
  const homeDir = os.homedir();
  let baseReposDir = path.join(homeDir, ".docsgrep", "repos");
  
  if (localProjectPath) {
    // If inside a project base camp, use project-specific cache
    baseReposDir = path.join(localProjectPath, ".docsgrep", "cache", "repos");
  }
  
  const version = tag || branch;
  const hashInput = version ? `${repoUrl}#${version}` : repoUrl;
  const repoHash = crypto.createHash("md5").update(hashInput).digest("hex").substring(0, 8);
  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
  const versionSuffix = version ? `-${version.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
  const targetDir = path.join(baseReposDir, `${repoName}${versionSuffix}-${repoHash}`);
  
  return targetDir;
}
