/**
 * Core tool classes that wrap audit orchestrators into BaseTool subclasses.
 * These are registered in ToolRegistry.initialize().
 */
import {
  type McpToolResponse,
  type AnalyzeCodeArgs,
  type AuditSecurityArgs,
  type CatchBugsArgs,
} from "./types/tools.js";
import { checkCapabilities, getCapabilityGapMessage } from "./utils/capabilities.js";
import { BaseTool } from "./tools/base.js";
import { performUniversalAudit as performAudit, type AuditReport } from "./best-practices.js";
import { performSecurityAudit, type SecurityAuditReport } from "./security-audit.js";
import { catchBugs, type BugReport as B_Report } from "./bug-catcher.js"; // docsgrep-ignore

function wrap(data: any): McpToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

export class AnalyzeCodeTool extends BaseTool<AnalyzeCodeArgs> {
  protected name = "analyze_code";
  protected async run(args: AnalyzeCodeArgs): Promise<McpToolResponse> {
    const { dir, inc } = this.getStandardArgs(args);
    const caps = await checkCapabilities();
    const report: AuditReport = await performAudit(dir, inc, args.excludePath);
    report.recommendations.push(...getCapabilityGapMessage(caps));
    return wrap({ ...report, capabilities: caps });
  }
}

export class AuditSecurityTool extends BaseTool<AuditSecurityArgs> {
  protected name = "audit_security";
  protected async run(args: AuditSecurityArgs): Promise<McpToolResponse> {
    const { dir, inc } = this.getStandardArgs(args);
    const caps = await checkCapabilities();
    const report: SecurityAuditReport = await performSecurityAudit(dir, inc, args.excludePath);
    report.recommendations.push(...getCapabilityGapMessage(caps));
    return wrap({ ...report, capabilities: caps });
  }
}

export class CatchBugsTool extends BaseTool<CatchBugsArgs> {
  protected name = "catch_bugs";
  protected async run(args: CatchBugsArgs): Promise<McpToolResponse> {
    const { dir, inc } = this.getStandardArgs(args);
    const report: B_Report = await catchBugs(dir, inc, args.excludePath);
    return wrap(report);
  }
}
