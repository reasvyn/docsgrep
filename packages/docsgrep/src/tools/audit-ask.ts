/**
 * Interactive audit prompt handlers: lint_interactive, security_interactive
 */
import { type McpToolResponse } from "../types/tools.js";
import { validateDirPath, validateStringParam } from "../utils/validation.js";
import { getAuditPrompt } from "../audit.js";
import { generateSecurityAuditPrompt } from "../security-audit.js";
import { BaseTool } from "./base.js";

export async function handleLintInteractiveTool(args: any): Promise<McpToolResponse> {
  const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
  const prompt = await getAuditPrompt(dirPath);
  return { content: [{ type: "text", text: prompt }] };
}

export async function handleSecurityInteractiveTool(args: any): Promise<McpToolResponse> {
  const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
  const prompt = await generateSecurityAuditPrompt(dirPath);
  return { content: [{ type: "text", text: prompt }] };
}
