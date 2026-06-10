/**
 * ToolRegistry - Centralizes all tool handlers for dynamic execution
 */
import { type McpToolResponse } from "../types/tools.js";
import { handleInitWorkspace, handleClearCache } from "./workspace.js";
import {
  handleFindDocs,
  handleReadFile,
  handleSearchDocs,
  handleSemanticSearch,
  handleSummarizeDoc,
  handleFindRelated,
  handleCheckStale,
  handleGetContext,
  handleMeasureCoverage,
} from "./documentation.js";
import {
  handleSyncDocumentation,
  handleVerifyDocs,
  handleCheckDelta,
  handleCheckArtefacts,
} from "./sync-verify.js";
import {
  handleShowHelp,
  handleDetectStack,
  handleCheckStyle,
  handleCloneRepo,
} from "./help-info.js";
import { handleDetectPatternsTool } from "./archetypes.js";
import { handleLintInteractiveTool, handleSecurityInteractiveTool } from "./audit-ask.js";
import { PluginManager } from "../utils/plugin-manager.js";

// Import core audit handlers (these will remain class-based for now)
// We use a dynamic lookup map to replace switch-cases
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

  /**
   * Initialize and register all core handlers
   */
  static initialize(overrides: Record<string, ToolHandler> = {}) {
    // Workspace
    this.register("init_workspace", handleInitWorkspace);
    this.register("clear_cache", handleClearCache);

    // Documentation
    this.register("find_docs", handleFindDocs);
    this.register("read_file", handleReadFile);
    this.register("search_docs", handleSearchDocs);
    this.register("semantic_search", handleSemanticSearch);
    this.register("summarize_doc", handleSummarizeDoc);
    this.register("find_related", handleFindRelated);
    this.register("check_stale", handleCheckStale);
    this.register("get_context", handleGetContext);
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

    // Register overrides (for class-based tools like AnalyzeCodeTool)
    for (const [name, handler] of Object.entries(overrides)) {
      this.register(name, handler);
    }
  }

  static getCoreToolNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}
