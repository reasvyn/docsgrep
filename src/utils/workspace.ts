/**
 * Centralized workspace path resolution for .docsgrep/ at project root.
 *
 * All caches, logs, and internal data live under `<projectPath>/.docsgrep/`.
 * No data is written to os.tmpdir() or os.homedir().
 */
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { validateDirPath } from "./validation.js";

const WORKSPACE_DIR = ".docsgrep";

export interface WorkspacePaths {
  root: string;
  repos: string;
  cache: string;
  logs: string;
  reports: string;
  contextFile: string;
}

/**
 * Resolve all .docsgrep/ sub-paths for a given project directory.
 * Does NOT create directories — use `ensureWorkspace()` for that.
 */
export function resolveWorkspace(projectPath: string): WorkspacePaths {
  const root = path.join(projectPath, WORKSPACE_DIR);
  return {
    root,
    repos: path.join(root, "repos"),
    cache: path.join(root, "cache"),
    logs: path.join(root, "logs"),
    reports: path.join(root, "reports"),
    contextFile: path.join(root, "context.json"),
  };
}

/**
 * Ensure the full .docsgrep/ directory tree exists.
 * Returns the resolved paths.
 */
export async function ensureWorkspace(projectPath: string): Promise<WorkspacePaths> {
  const paths = resolveWorkspace(projectPath);
  await fs.mkdir(paths.repos, { recursive: true });
  await fs.mkdir(path.join(paths.cache, "data"), { recursive: true });
  await fs.mkdir(paths.logs, { recursive: true });
  await fs.mkdir(paths.reports, { recursive: true });
  return paths;
}

/**
 * Check if a .docsgrep/ workspace exists at the given project path.
 */
export async function workspaceExists(projectPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectPath, WORKSPACE_DIR));
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure .docsgrep/ is listed in the project's .gitignore.
 */
export async function ensureGitignore(projectPath: string): Promise<void> {
  try {
    const gitignorePath = path.join(projectPath, ".gitignore");
    let content = "";
    try {
      content = await fs.readFile(gitignorePath, "utf-8");
    } catch {
      // .gitignore doesn't exist yet
    }
    if (!content.includes(`${WORKSPACE_DIR}/`)) {
      const padding = content && !content.endsWith("\n") ? "\n" : "";
      await fs.writeFile(
        gitignorePath,
        content + `${padding}\n# docsgrep workspace and cache\n${WORKSPACE_DIR}/\n`
      );
    }
  } catch {
    // Non-critical — ignore errors
  }
}
