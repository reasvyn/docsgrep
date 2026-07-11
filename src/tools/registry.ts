/**
 * ToolRegistry - Centralizes all tool handlers for dynamic execution
 */
import { type McpToolResponse } from "../types/tools.js";
import { handleInitWorkspace, handleClearCache } from "./workspace.js";

// Documentation — doc-find
import { handleFindDocs } from "./doc-find.js";
// Documentation — doc-search
import { handleSearchDocs, handleSemanticSearch, handleFindRelated } from "./doc-search.js";
// Documentation — doc-inspect
import { handleReadFile, handleSummarizeDoc, handleCheckStale, handleGetContext } from "./doc-inspect.js";
// Documentation — doc-coverage
import { handleMeasureCoverage } from "./doc-coverage.js";

// Sync & Verify — doc-verify
import { handleVerifyDocs, handleCheckDelta } from "./doc-verify.js";
// Sync & Verify — doc-sync
import { handleSyncDocumentation, handleCheckArtefacts } from "./doc-sync.js";

// Help & Info — help, repo-analysis, repo
import { handleShowHelp } from "./help.js";
import { handleDetectStack, handleCheckStyle } from "./repo-analysis.js";
import { handleCloneRepo } from "./repo.js";

// Archetypes & interactive audit
import { handleDetectPatternsTool } from "./archetypes.js";
import { handleLintInteractiveTool, handleSecurityInteractiveTool } from "./audit-ask.js";

// Core audit tool classes
import { AnalyzeCodeTool, AuditSecurityTool, CatchBugsTool } from "../core-tools.js";

// Plugin support
import { PluginManager } from "../utils/plugin-manager.js";

export type ToolHandler = (args: any) => Promise<McpToolResponse>;

export class ToolRegistry {
  private static handlers: Map<string, ToolHandler> = new Map();

  static register(name: string, handler: ToolHandler) {
    this.handlers.set(name, handler);
  }

  static async execute(name: string, args: any): Promise<McpToolResponse> {
    const handler = this.handlers.get(name) || PluginManager.getHandler(name);
    
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return await handler(args);
  }

  static initialize(overrides: Record<string, ToolHandler> = {}) {
    // Workspace
    this.register("init_workspace", handleInitWorkspace);
    this.register("clear_cache", handleClearCache);

    // Documentation — find
    this.register("find_docs", handleFindDocs);

    // Documentation — search
    this.register("search_docs", handleSearchDocs);
    this.register("semantic_search", handleSemanticSearch);
    this.register("find_related", handleFindRelated);

    // Documentation — inspect
    this.register("read_file", handleReadFile);
    this.register("summarize_doc", handleSummarizeDoc);
    this.register("check_stale", handleCheckStale);
    this.register("get_context", handleGetContext);

    // Documentation — coverage
    this.register("measure_coverage", handleMeasureCoverage);

    // Sync & Verify
    this.register("sync_documentation", handleSyncDocumentation);
    this.register("verify_docs", handleVerifyDocs);
    this.register("check_delta", handleCheckDelta);
    this.register("check_artefacts", handleCheckArtefacts);

    // Help & Info
    this.register("show_help", handleShowHelp);
    this.register("detect_stack", handleDetectStack);
    this.register("check_style", handleCheckStyle);
    this.register("clone_repo", handleCloneRepo);

    // Architectural Intel
    this.register("detect_patterns", handleDetectPatternsTool);

    // Ask Handlers
    this.register("lint_interactive", handleLintInteractiveTool);
    this.register("security_interactive", handleSecurityInteractiveTool);

    // Core class-based tools
    this.register("analyze_code", (a) => new AnalyzeCodeTool().execute(a));
    this.register("audit_security", (a) => new AuditSecurityTool().execute(a));
    this.register("catch_bugs", (a) => new CatchBugsTool().execute(a));

    // Register any caller-provided overrides
    for (const [name, handler] of Object.entries(overrides)) {
      this.register(name, handler);
    }
  }

  static getCoreToolNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}
