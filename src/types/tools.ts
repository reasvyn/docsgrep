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
  excludePath?: string[];
}

export interface SniffStyleArgs {
  dirPath: string;
  excludePath?: string[];
}

export interface HuntDocsArgs {
  dirPath: string;
  includePath?: string[];
  excludePath?: string[];
}

export interface FetchRepoArgs {
  repoUrl: string;
  branch?: string;
  tag?: string;
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
  includePath?: string[];
  excludePath?: string[];
}

export interface LintCodeArgs {
  dirPath: string;
  filePatterns?: string[]; // Kept for backward compatibility, will map to includePath
  focusAreas?: string[];
  includePath?: string[];
  excludePath?: string[];
}

export interface AskLintArgs {
  dirPath: string;
}

export interface GuardSecurityArgs {
  dirPath: string;
  filePatterns?: string[]; // Kept for backward compatibility
  includePath?: string[];
  excludePath?: string[];
}

export interface AskGuardArgs {
  dirPath: string;
}

export interface CatchBugsArgs {
  dirPath: string;
  filePatterns?: string[]; // Kept for backward compatibility
  includePath?: string[];
  excludePath?: string[];
}

export interface FathomMeaningArgs {
  dirPath: string;
  query: string;
  topK?: number;
  includePath?: string[];
  excludePath?: string[];
}

export interface TldrDocsArgs {
  filePath: string;
  maxLength?: number;
}

export interface HuntRelatedArgs {
  dirPath: string;
  topic: string;
  threshold?: number;
  includePath?: string[];
  excludePath?: string[];
}

export interface SmellStaleArgs {
  dirPath: string;
  maxAgeDays?: number;
  compareWithCode?: boolean;
  includePath?: string[];
  excludePath?: string[];
}

export interface SyncDocsArgs {
  dirPath: string;
  filePaths?: string[];
  updateMode?: "create" | "update" | "both";
  includePath?: string[];
  excludePath?: string[];
}

export interface VerifyTruthArgs {
  dirPath: string;
  docPath: string;
  strictMode?: boolean;
  includePath?: string[];
  excludePath?: string[];
}

export interface SenseSurroundingsArgs {
  dirPath: string;
  currentFilePath: string;
  contextDepth?: "minimal" | "standard" | "deep";
  includePath?: string[];
  excludePath?: string[];
}

export interface SpotDeltaArgs {
  dirPath: string;
  docPath: string;
  includeCodeSnippets?: boolean;
  includePath?: string[];
  excludePath?: string[];
}

export interface DocTheToolsArgs {
  toolName?: string;
  includeExamples?: boolean;
}

export interface CatchFossilsArgs {
  dirPath: string;
  sinceCommit?: string;
  priorityMode?: "impact" | "recency";
  includePath?: string[];
  excludePath?: string[];
}

export interface GaugeDocsArgs {
  dirPath: string;
  filePatterns?: string[];
  publicOnly?: boolean;
  includePath?: string[];
  excludePath?: string[];
}

export interface MapArchetypesArgs {
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
