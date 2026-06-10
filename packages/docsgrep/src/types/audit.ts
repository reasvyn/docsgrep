/**
 * Code quality audit types
 */

export interface CodeIssue {
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  evidence?: string;
  suggestion?: string;
}

export interface AuditReport {
  summary: {
    filesScanned: number;
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    documentationScore: number;
    codeQualityScore: number;
  };
  projectStructure: {
    hasDocumentation: boolean;
    hasLinterConfig: boolean;
    hasTests: boolean;
    hasCI: boolean;
    directories: string[];
    entryPoints: string[];
  };
  projectReadiness: {
    hasLicense: boolean;
    hasEditorconfig: boolean;
    hasGitignore: boolean;
    hasEnvExample: boolean;
    gitignoreCoversBasics: boolean;
    detectedType: string;
    hasPackageMeta: boolean;
    packageDescription: string;
    packageAuthor: string;
    packageLicense: string;
    packageHomepage: string;
  };
  detectedConventions: {
    namingStyle: string;
    indentation: string;
    quoteStyle: string;
    lineLengthAvg: number;
    hasComments: boolean;
    commentStyle: string;
  };
  issues: CodeIssue[];
  strengths: string[];
  recommendations: string[];
}
