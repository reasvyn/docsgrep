/**
 * Shared types and interfaces for docsgrep tools
 */

export interface McpToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// Handler Arguments Interfaces

export interface SetupCampArgs {
  projectPath: string;
}

export interface SpyStackArgs {
  dirPath: string;
}

export interface SniffStyleArgs {
  dirPath: string;
}

export interface HuntDocsArgs {
  dirPath: string;
}

export interface FetchRepoArgs {
  repoUrl: string;
  branch?: string;
  localProjectPath?: string;
  authToken?: string;
  sshKeyPath?: string;
}

export interface PeekFileArgs {
  filePath: string;
}

export interface PurgeCacheArgs {
  localProjectPath: string;
  maxAgeDays?: number;
}

export interface GrepDocsArgs {
  dirPath: string;
  pattern: string;
  filePattern?: string;
  contextLines?: number;
}

export interface LintCodeArgs {
  dirPath: string;
  filePatterns?: string[];
  focusAreas?: string[];
}

export interface AskLintArgs {
  dirPath: string;
}

export interface GuardSecurityArgs {
  dirPath: string;
  filePatterns?: string[];
}

export interface AskGuardArgs {
  dirPath: string;
}

export interface CatchBugsArgs {
  dirPath: string;
  filePatterns?: string[];
}

export interface FathomMeaningArgs {
  dirPath: string;
  query: string;
  topK?: number;
}

export interface TldrDocsArgs {
  filePath: string;
  maxLength?: number;
}

export interface HuntRelatedArgs {
  dirPath: string;
  topic: string;
  threshold?: number;
}

export interface SmellStaleArgs {
  dirPath: string;
  maxAgeDays?: number;
  compareWithCode?: boolean;
}

export interface SyncDocsArgs {
  dirPath: string;
  filePaths?: string[];
  updateMode?: "create" | "update" | "both";
}

export interface VerifyTruthArgs {
  dirPath: string;
  docPath: string;
  strictMode?: boolean;
}

export interface SenseSurroundingsArgs {
  dirPath: string;
  currentFilePath: string;
  contextDepth?: "minimal" | "standard" | "deep";
}

export interface SpotDeltaArgs {
  dirPath: string;
  docPath: string;
  includeCodeSnippets?: boolean;
}

export interface DocTheToolsArgs {
  toolName?: string;
  includeExamples?: boolean;
}

export interface CatchFossilsArgs {
  dirPath: string;
  sinceCommit?: string;
  priorityMode?: "impact" | "recency";
}

export interface GaugeDocsArgs {
  dirPath: string;
  filePatterns?: string[];
  publicOnly?: boolean;
}
