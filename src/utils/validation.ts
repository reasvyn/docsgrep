/**
 * Input validation utilities
 */
import * as path from "node:path";

export function validateStringParam(param: unknown, paramName: string): string {
  if (typeof param !== "string" || !param.trim()) {
    throw new Error(`Invalid ${paramName}: must be a non-empty string`);
  }
  return param.trim();
}

export function validateDirPath(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  // Check if the original path tries to traverse above by having '..' that would escape
  const normalized = path.normalize(dirPath);
  if (normalized.includes("..")) {
    const resolvedFromNormalized = path.resolve(normalized);
    if (resolvedFromNormalized !== resolved) {
      throw new Error("Invalid path: path traversal detected");
    }
  }
  return resolved;
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
