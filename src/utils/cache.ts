/**
 * File-based cache system stored under .docsgrep/cache/data/.
 *
 * Each cache entry is a JSON file named `<key>.json` containing:
 *   { key, data, createdAt, expiresAt }
 *
 * TTL is set per-entry at write time. Expired entries are lazily
 * evicted on read and bulk-evicted via `pruneCache()`.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "./logger.js";

interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  createdAt: string;
  expiresAt: string;
}

/**
 * Resolve the cache directory for the given project path.
 */
function cacheDir(projectPath: string): string {
  return path.join(projectPath, ".docsgrep", "cache", "data");
}

function entryPath(projectPath: string, key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(cacheDir(projectPath), `${safeKey}.json`);
}

/**
 * Write a value to the file cache.
 *
 * @param projectPath - project root containing .docsgrep/
 * @param key - cache key (alphanumeric, hyphens, underscores)
 * @param data - value to store (will be JSON-serialized)
 * @param ttlMs - time-to-live in milliseconds (default: 1 hour)
 */
export async function cacheSet<T>(
  projectPath: string,
  key: string,
  data: T,
  ttlMs: number = 3600_000
): Promise<void> {
  const now = Date.now();
  const entry: CacheEntry<T> = {
    key,
    data,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
  const filePath = entryPath(projectPath, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
  logger.debug("cache: set", { key, ttlMs });
}

/**
 * Read a value from the file cache. Returns `null` if missing or expired.
 */
export async function cacheGet<T = unknown>(
  projectPath: string,
  key: string
): Promise<T | null> {
  const filePath = entryPath(projectPath, key);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (new Date(entry.expiresAt).getTime() < Date.now()) {
      // Expired — delete lazily
      await fs.unlink(filePath).catch(() => {});
      logger.debug("cache: expired", { key });
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Delete a specific cache entry.
 */
export async function cacheDelete(
  projectPath: string,
  key: string
): Promise<boolean> {
  const filePath = entryPath(projectPath, key);
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove all expired entries from the cache directory.
 * Returns the number of entries pruned.
 */
export async function pruneCache(projectPath: string): Promise<number> {
  const dir = cacheDir(projectPath);
  let pruned = 0;
  try {
    const files = await fs.readdir(dir);
    const now = Date.now();
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(dir, file), "utf-8");
        const entry: CacheEntry = JSON.parse(raw);
        if (new Date(entry.expiresAt).getTime() < now) {
          await fs.unlink(path.join(dir, file));
          pruned++;
        }
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // Cache dir doesn't exist — nothing to prune
  }
  if (pruned > 0) {
    logger.info("cache: pruned", { count: pruned });
  }
  return pruned;
}

/**
 * Get total size of the cache directory in bytes.
 */
export async function cacheSize(projectPath: string): Promise<number> {
  const dir = cacheDir(projectPath);
  let total = 0;
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      try {
        const stat = await fs.stat(path.join(dir, file));
        total += stat.size;
      } catch {
        // Skip
      }
    }
  } catch {
    // Dir doesn't exist
  }
  return total;
}

/**
 * Delete all entries in the cache directory.
 */
export async function cacheClear(projectPath: string): Promise<number> {
  const dir = cacheDir(projectPath);
  let cleared = 0;
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      try {
        await fs.unlink(path.join(dir, file));
        cleared++;
      } catch {
        // Skip
      }
    }
  } catch {
    // Dir doesn't exist
  }
  return cleared;
}
