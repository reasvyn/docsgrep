/**
 * find_docs tool — discover documentation files in a directory
 */
import * as path from "node:path";
import {
  validateStringParam,
  validateDirPath,
} from "../utils/validation.js";
import {
  type McpToolResponse,
  type FindDocsArgs,
} from "../types/tools.js";

import { BaseTool, FileScanner } from "./base.js";

class FindDocsTool extends BaseTool<FindDocsArgs> {
  protected name = "find_docs";

  protected async run(args: FindDocsArgs): Promise<McpToolResponse> {
    const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
    const files = await findDocsInDir(dirPath, args.includePath, args.excludePath);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Found ${files.length} documentation files in local directory.`,
              files,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

export async function handleFindDocs(args: FindDocsArgs): Promise<McpToolResponse> {
  return new FindDocsTool().execute(args); // docsgrep-ignore
}

export async function findDocsInDir(dirPath: string, includePath?: string[], excludePath?: string[]): Promise<string[]> {
  const allMdFiles = await FileScanner.findFiles({ dirPath, includePath, excludePath }, ["**/*.md"]);

  const uniqueFiles = Array.from(new Set(allMdFiles));
  return uniqueFiles.map((file) => path.join(dirPath, file));
}
