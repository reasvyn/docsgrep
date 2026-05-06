import { McpToolResponse } from "../types/tools.js";
import { logger } from "../utils/logger.js";
import { operationLimiter } from "../utils/semaphore.js";
import { getIgnorePatterns } from "../utils/file.js";
import { validateDirPath, validateStringParam } from "../utils/validation.js";
import { glob } from "glob";

/**
 * Base interface for tool arguments that involve path filtering
 */
export interface PathFilterArgs {
  dirPath: string;
  includePath?: string[];
  excludePath?: string[];
}

/**
 * Abstract Base Class for all docsgrep tools
 */
export abstract class BaseTool<T> {
  protected abstract name: string;

  /**
   * Main execution entry point with common safety and logging
   */
  async execute(args: T): Promise<McpToolResponse> {
    const release = await operationLimiter.acquire();
    try {
      logger.info(`Executing tool: ${this.name}`, { args: this.maskSensitive(args) });
      return await this.run(args);
    } catch (error: any) {
      logger.error(`Error in tool ${this.name}: ${error.message}`, { error });
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    } finally {
      release();
    }
  }

  /**
   * The actual implementation logic to be defined by subclasses
   */
  protected abstract run(args: T): Promise<McpToolResponse>;

  /**
   * Extract standard path and include filters from args
   */
  protected getStandardArgs(args: any): { dir: string, inc?: string[] } {
    const dir = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
    const inc = args.includePath || args.filePatterns;
    return { dir, inc };
  }

  /**
   * Common helper to resolve ignore patterns
   */
  protected async getIgnorePatterns(dirPath: string): Promise<string[]> {
    return await getIgnorePatterns(dirPath);
  }

  /**
   * Placeholder for masking sensitive arguments in logs (e.g. authTokens)
   */
  protected maskSensitive(args: T): any {
    const masked = { ...args as any };
    if (masked.authToken) masked.authToken = "***";
    return masked;
  }
}

/**
 * Utility for unified file scanning across tools
 */
export class FileScanner {
  /**
   * Scans for files respecting .gitignore, includePath, and excludePath
   */
  static async findFiles(args: PathFilterArgs, defaultPatterns: string[]): Promise<string[]> {
    const { dirPath, includePath, excludePath } = args;
    const ignorePatterns = await getIgnorePatterns(dirPath);
    
    // Combine base ignore patterns with user-provided excludePaths
    const finalIgnore = [...ignorePatterns, ...(excludePath || [])];
    
    // If includePath is provided, it overrides defaultPatterns
    const searchPatterns = includePath && includePath.length > 0 ? includePath : defaultPatterns;

    return await glob(searchPatterns, {
      cwd: dirPath,
      ignore: finalIgnore,
      nocase: true,
      absolute: false // Usually tool handlers prefer relative paths for reporting
    });
  }

  /**
   * Specifically for finding directories
   */
  static async findDirectories(args: PathFilterArgs): Promise<string[]> {
    const { dirPath, excludePath } = args;
    const ignorePatterns = await getIgnorePatterns(dirPath);
    const finalIgnore = [...ignorePatterns, ...(excludePath || [])];

    return (await glob("*/", { cwd: dirPath, ignore: finalIgnore }))
      .map(d => d.replace(/\/$/, ""));
  }
}
