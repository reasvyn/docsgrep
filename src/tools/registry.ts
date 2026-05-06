/**
 * ToolRegistry - Centralizes all tool handlers for dynamic execution
 */
import { type McpToolResponse } from "../types/tools.js";
import { handleSetupCamp, handlePurgeCache } from "./workspace.js";
import {
  handleHuntDocs,
  handlePeekFile,
  handleGrepDocs,
  handleFathomMeaning,
  handleTldrDocs,
  handleHuntRelated,
  handleSmellStale,
  handleSenseSurroundings,
  handleGaugeDocs,
} from "./documentation.js";
import {
  handleSyncDocs,
  handleVerifyTruth,
  handleSpotDelta,
  handleCatchFossils,
} from "./sync-verify.js";
import {
  handleDocTheTools,
  handleSpyStack,
  handleSniffStyle,
  handleFetchRepo,
} from "./help-info.js";
import { handleMapArchetypesTool } from "./archetypes.js";
import { handleAskLintTool, handleAskGuardTool } from "./audit-ask.js";
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
    this.register("setup_camp", handleSetupCamp);
    this.register("purge_cache", handlePurgeCache);

    // Documentation
    this.register("hunt_docs", handleHuntDocs);
    this.register("peek_file", handlePeekFile);
    this.register("grep_docs", handleGrepDocs);
    this.register("fathom_meaning", handleFathomMeaning);
    this.register("tldr_docs", handleTldrDocs);
    this.register("hunt_related", handleHuntRelated);
    this.register("smell_stale", handleSmellStale);
    this.register("sense_surroundings", handleSenseSurroundings);
    this.register("gauge_docs", handleGaugeDocs);

    // Sync & Verify
    this.register("sync_docs", handleSyncDocs);
    this.register("verify_truth", handleVerifyTruth);
    this.register("spot_delta", handleSpotDelta);
    this.register("catch_fossils", handleCatchFossils);

    // Help & Info
    this.register("doc_the_tools", handleDocTheTools);
    this.register("spy_stack", handleSpyStack);
    this.register("sniff_style", handleSniffStyle);
    this.register("fetch_repo", handleFetchRepo);

    // Architectural Intel
    this.register("map_archetypes", handleMapArchetypesTool);

    // Ask Handlers
    this.register("ask_lint", handleAskLintTool);
    this.register("ask_guard", handleAskGuardTool);

    // Register overrides (for class-based tools like LintCodeTool)
    for (const [name, handler] of Object.entries(overrides)) {
      this.register(name, handler);
    }
  }

  static getCoreToolNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}
