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

export interface InitWorkspaceArgs {
  projectPath: string;
}

export interface DetectStackArgs {
  dirPath: string;
  excludePath?: string[];
}

export interface CheckStyleArgs {
  dirPath: string;
  excludePath?: string[];
}

export interface FindDocsArgs {
  dirPath: string;
  includePath?: string[];
  excludePath?: string[];
}

export interface CloneRepoArgs {
  repoUrl: string;
  branch?: string;
  tag?: string;
  localProjectPath?: string;
  authToken?: string;
  sshKeyPath?: string;
}

export interface ReadFileArgs {
  filePath: string;
}

export interface ClearCacheArgs {
  localProjectPath: string;
  maxAgeDays?: number;
}

export interface SearchDocsArgs {
  dirPath: string;
  pattern: string;
  filePattern?: string;
  contextLines?: number;
  includePath?: string[];
  excludePath?: string[];
}

export interface AnalyzeCodeArgs {
  dirPath: string;
  filePatterns?: string[]; // Kept for backward compatibility, will map to includePath
  focusAreas?: string[];
  includePath?: string[];
  excludePath?: string[];
}

export interface LintInteractiveArgs {
  dirPath: string;
}

export interface AuditSecurityArgs {
  dirPath: string;
  filePatterns?: string[]; // Kept for backward compatibility
  includePath?: string[];
  excludePath?: string[];
}

export interface SecurityInteractiveArgs {
  dirPath: string;
}

export interface CatchBugsArgs {
  dirPath: string;
  filePatterns?: string[]; // Kept for backward compatibility
  includePath?: string[];
  excludePath?: string[];
}

export interface SemanticSearchArgs {
  dirPath: string;
  query: string;
  topK?: number;
  includePath?: string[];
  excludePath?: string[];
}

export interface SummarizeDocArgs {
  filePath: string;
  maxLength?: number;
}

export interface FindRelatedArgs {
  dirPath: string;
  topic: string;
  threshold?: number;
  includePath?: string[];
  excludePath?: string[];
}

export interface CheckStaleArgs {
  dirPath: string;
  maxAgeDays?: number;
  compareWithCode?: boolean;
  includePath?: string[];
  excludePath?: string[];
}

export interface SyncDocumentationArgs {
  dirPath: string;
  filePaths?: string[];
  updateMode?: "create" | "update" | "both";
  includePath?: string[];
  excludePath?: string[];
}

export interface VerifyDocsArgs {
  dirPath: string;
  docPath: string;
  strictMode?: boolean;
  includePath?: string[];
  excludePath?: string[];
}

export interface GetContextArgs {
  dirPath: string;
  currentFilePath: string;
  contextDepth?: "minimal" | "standard" | "deep";
  includePath?: string[];
  excludePath?: string[];
}

export interface CheckDeltaArgs {
  dirPath: string;
  docPath: string;
  includeCodeSnippets?: boolean;
  includePath?: string[];
  excludePath?: string[];
}

export interface ShowHelpArgs {
  toolName?: string;
}

export interface CheckArtefactsArgs {
  dirPath: string;
  sinceCommit?: string;
  priorityMode?: "impact" | "recency";
  includePath?: string[];
  excludePath?: string[];
}

export interface MeasureCoverageArgs {
  dirPath: string;
  filePatterns?: string[];
  publicOnly?: boolean;
  includePath?: string[];
  excludePath?: string[];
}

export interface DetectPatternsArgs {
  dirPath: string;
  minSimilarity?: number;
  focus?: 'interface' | 'base_class' | 'trait' | 'all';
  includePath?: string[];
  excludePath?: string[];
}

export type ComponentRole = 'ENTRY_POINT' | 'LOGIC_HOLDER' | 'DATA_ACCESS' | 'CONTRACT' | 'DTO' | 'UTILITY' | 'DOMAIN_MODEL' | 'EVENT_HANDLER' | 'FACTORY' | 'UNKNOWN';

export interface ArchetypeComponent {
  file: string;
  name: string;
  role: ComponentRole;
  suffix: string;
  methods: Array<{ name: string, paramCount: number }>;
  complexity: number;
  dependencies: string[];
}

export interface ArchetypeAdvice {
  title: string;
  pattern: string;
  components: string[];
  similarity: number;
  recommendation: string;
  benefit: string;
}

export interface ArchetypeReport {
  message: string;
  zones: Record<string, {
    primaryPattern: string;
    components: number;
    roles: Record<string, number>;
  }>;
  suggestions: ArchetypeAdvice[];
}
