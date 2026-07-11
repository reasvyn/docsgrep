/**
 * show_help tool — reads docs/tools/*.md and renders help text
 */
import { AppInfo } from "../utils/app-info.js";
import { 
  type McpToolResponse, 
  type ShowHelpArgs,
} from "../types/tools.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DOCS_TOOLS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "docs", "tools"
);

async function readDocFile(toolName: string): Promise<string | null> {
  const filePath = path.join(DOCS_TOOLS_DIR, `${toolName}.md`);
  try {
    await fs.access(filePath);
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function handleShowHelp(
  args: ShowHelpArgs
): Promise<McpToolResponse> {
  const { toolName } = args;

  if (toolName) {
    const content = await readDocFile(toolName);
    if (!content) {
      return {
        content: [
          {
            type: "text",
            text: `Tool "${toolName}" not found. Use show_help() without arguments to see all tools.`,
          },
        ],
        isError: true,
      };
    }

    return { content: [{ type: "text", text: content }] };
  }

  let files: string[];
  try {
    files = await fs.readdir(DOCS_TOOLS_DIR);
  } catch {
    return {
      content: [{ type: "text", text: "Error: docs/tools/ directory not found." }],
      isError: true,
    };
  }

  const mdFiles = files.filter(f => f.endsWith(".md")).sort();
  if (mdFiles.length === 0) {
    return {
      content: [{ type: "text", text: "No documentation files found in docs/tools/." }],
      isError: true,
    };
  }

  let helpText = `# docsgrep Tool Suite (v${AppInfo.version})\n\n`;
  helpText += `${AppInfo.description}\n\n`;
  helpText += `## Available Tools\n\n`;

  for (const file of mdFiles) {
    const fullPath = path.join(DOCS_TOOLS_DIR, file);
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      helpText += `---\n\n${content}\n\n`;
    } catch {
      // skip unreadable files
    }
  }

  return { content: [{ type: "text", text: helpText }] };
}
