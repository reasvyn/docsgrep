/**
 * File utilities for reading, binary detection, and streaming
 */
import * as fs from "node:fs/promises";
import * as readline from "node:readline";
import { createReadStream } from "node:fs";
import * as path from "node:path";

export function isBinaryFile(content: Buffer): boolean {
  // Check for null bytes which indicate binary content
  for (let i = 0; i < Math.min(content.length, 8000); i++) {
    if (content[i] === 0) return true;
  }
  return false;
}

// Stream read large files with size limit
export async function streamReadFile(
  filePath: string,
  maxBytes: number
): Promise<{ content: string; bytesRead: number }> {
  const readStream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity,
  });

  let content = "";
  let bytesRead = 0;
  const lines: string[] = [];

  for await (const line of rl) {
    const lineWithNewline = line + "\n";
    if (bytesRead + Buffer.byteLength(lineWithNewline) > maxBytes) {
      break;
    }
    lines.push(line);
    bytesRead += Buffer.byteLength(lineWithNewline);
  }

  readStream.destroy();

  return {
    content: lines.join("\n"),
    bytesRead,
  };
}

export async function getCacheSize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getCacheSize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
      }
    }
  } catch (e) {
    // ignore
  }
  return totalSize;
}

export async function cleanupCache(
  baseDir: string,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<string[]> {
  const cleaned: string[] = [];
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(baseDir, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.rm(fullPath, { recursive: true, force: true });
          cleaned.push(entry.name);
        }
      } catch (e) {
        // skip
      }
    }
  } catch (e) {
    // baseDir may not exist
  }
  return cleaned;
}
