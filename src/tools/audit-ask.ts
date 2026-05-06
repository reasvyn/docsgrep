/**
 * Interactive audit prompt handlers: ask_lint, ask_guard
 */
import { type McpToolResponse } from "../types/tools.js";
import { validateDirPath, validateStringParam } from "../utils/validation.js";
import { getAuditPrompt } from "../audit.js";
import { generateSecurityAuditPrompt } from "../security-audit.js";
import { BaseTool } from "./base.js";

export async function handleAskLintTool(args: any): Promise<McpToolResponse> {
  const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
  const prompt = await getAuditPrompt(dirPath);
  return { content: [{ type: "text", text: prompt }] };
}

export async function handleAskGuardTool(args: any): Promise<McpToolResponse> {
  const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
  const prompt = await generateSecurityAuditPrompt(dirPath);
  return { content: [{ type: "text", text: prompt }] };
}
