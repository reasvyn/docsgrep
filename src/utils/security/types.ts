/**
 * Security audit shared types
 */

export interface SecurityIssue {
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  owaspCategory?: string;
  title: string;
  description: string;
  evidence?: string;
  impact: string;
  remediation: string;
  references?: string[];
}

export interface SecurityAuditReport {
  summary: {
    filesScanned: number;
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    securityScore: number;
    riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  };
  owaspTop10: {
    category: string;
    title: string;
    issues: SecurityIssue[];
    compliant: boolean;
  }[];
  dependencyAnalysis: {
    hasLockFile: boolean;
    outdatedPackages: string[];
    vulnerablePackages: string[];
    totalDependencies: number;
  };
  secretsFound: {
    file: string;
    line?: number;
    type: string;
    value?: string;
  }[];
  privacyIssues: SecurityIssue[];
  complianceStatus: {
    standard: string;
    status: 'compliant' | 'partial' | 'non-compliant';
    issues: string[];
  }[];
  recommendations: string[];
}
