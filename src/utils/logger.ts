/**
 * Structured logger with dual output:
 *   1. stderr (always) — for MCP stdio transport compatibility
 *   2. File (.docsgrep/logs/<date>.log) — persistent structured logs
 *
 * File logging is opt-in via logger.enableFileLogging(projectPath).
 * When disabled (default), only stderr output occurs.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

type LogLevel = "info" | "debug" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export class Logger {
  private readonly context: string;
  private logDir: string | null = null;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Enable file-based logging. Creates log files under `<projectPath>/.docsgrep/logs/`.
   * File name format: `docsgrep-YYYY-MM-DD.log` (one file per day, appended to).
   */
  enableFileLogging(projectPath: string): void {
    this.logDir = path.join(projectPath, ".docsgrep", "logs");
  }

  /**
   * Disable file logging (revert to stderr-only).
   */
  disableFileLogging(): void {
    this.logDir = null;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write("info", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      this.write("debug", message, meta);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write("error", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write("warn", message, meta);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      context: this.context,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    // Always write to stderr (MCP transport)
    console.error(JSON.stringify(entry));

    // Append to log file if enabled
    if (this.logDir) {
      this.appendToFile(entry).catch(() => {
        // File logging must never crash the application
      });
    }
  }

  private async appendToFile(entry: LogEntry): Promise<void> {
    if (!this.logDir) return;
    await fs.mkdir(this.logDir, { recursive: true });
    const date = entry.timestamp.slice(0, 10); // YYYY-MM-DD
    const filePath = path.join(this.logDir, `docsgrep-${date}.log`);
    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(filePath, line);
  }
}

export const logger = new Logger("docsgrep");
