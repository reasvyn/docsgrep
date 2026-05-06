/**
 * Security Audit Orchestrator for docsgrep.
 * Orchestrates OWASP, Secrets, Privacy, and Dependency checks.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileScanner } from "./tools/base.js";
import { OwaspChecker } from "./utils/security/owasp-checker.js";
import { SecretScanner } from "./utils/security/secret-scanner.js";
import { PrivacyAnalyzer } from "./utils/security/privacy-analyzer.js";
import { DependencyAuditor } from "./utils/security/dependency-auditor.js";
import { 
  type SecurityIssue, 
  type SecurityAuditReport 
} from "./utils/security/types.js";

export { type SecurityIssue, type SecurityAuditReport };

const MAX_SCAN_FILES = 50;
const MAX_FILE_SIZE = 500000;
const BASE_SCORE = 100;
const PENALTY_CRITICAL = 20;
const PENALTY_HIGH = 10;
const PENALTY_MEDIUM = 5;

const SCORE_EXCELLENT = 90;
const SCORE_GOOD = 70;
const SCORE_POOR = 50;

const MAX_PENALTY_CRITICAL = 40;
const MAX_PENALTY_HIGH = 30;
const MAX_PENALTY_MEDIUM = 20;

const ZERO = 0;

/**
 * Perform a comprehensive security audit on a directory.
 */
export async function performSecurityAudit(
  dirPath: string,
  includePath?: string[],
  excludePath?: string[]
): Promise<SecurityAuditReport> {
  const matches = await findSourceFiles(dirPath, includePath, excludePath);
  const files = await fetchFiles(dirPath, matches);
  const findings = analyzeFiles(files);
  const depAnalysis = await DependencyAuditor.audit(dirPath, excludePath);
  
  const score = computeScore(findings.issues);
  const owasp = mapOwasp(findings.issues);
  const summary = buildSummary(files.length, findings, score);
  
  return {
    summary,
    owaspTop10: owasp,
    dependencyAnalysis: depAnalysis,
    secretsFound: findings.secrets.slice(ZERO, MAX_SCAN_FILES),
    privacyIssues: findings.privacy,
    complianceStatus: [checkCompliance(depAnalysis, findings.privacy)],
    recommendations: getRecs(findings, depAnalysis, owasp),
  };
}

async function findSourceFiles(dirPath: string, includePath?: string[], excludePath?: string[]) {
  return FileScanner.findFiles({ dirPath, includePath, excludePath }, [
    '**/*.{js,ts,jsx,tsx,py,go,rs,rb,java,cpp,c,cs,php,swift,dart,kt,scala,groovy,ex,erl,clj}',
    '**/*.{yml,yaml,json,xml,conf,ini,env,cfg}',
    '**/Dockerfile*',
    '**/*.{sh,bash}',
  ]);
}

/**
 * Fetch and read file contents with limits.
 */
async function fetchFiles(dirPath: string, matches: string[]) {
  const result = [];
  const subset = matches.slice(ZERO, MAX_SCAN_FILES);
  for (const matchName of subset) {
    const fileObj = await readFileSafely(dirPath, matchName);
    if (fileObj) {
      result.push(fileObj);
    }
  }
  return result;
}

/**
 * Safely read a single file with size checks.
 */
async function readFileSafely(dirPath: string, matchName: string) {
  try {
    const fullPath = path.join(dirPath, matchName);
    const fileStat = await fs.stat(fullPath);
    if (!fileStat.isFile() || fileStat.size > MAX_FILE_SIZE) {
      return null;
    }
    const content = await fs.readFile(fullPath, 'utf-8');
    return { path: fullPath, content };
  } catch (error) {
    return null;
  }
}

/**
 * Run analysis engines on a list of files.
 */
function analyzeFiles(files: any[]) {
  const issues: SecurityIssue[] = [];
  const secrets: any[] = [];
  const privacy: SecurityIssue[] = [];

  for (const fileObj of files) {
    issues.push(...OwaspChecker.check(fileObj.content, fileObj.path));
    secrets.push(...SecretScanner.scan(fileObj.content, fileObj.path));
    privacy.push(...PrivacyAnalyzer.analyze(fileObj.content, fileObj.path));
  }
  return { issues, secrets, privacy };
}

/**
 * Calculate the overall security score.
 */
function computeScore(issues: SecurityIssue[]): number {
  let scoreValue = BASE_SCORE;
  const critical = issues.filter(i => i.severity === 'critical').length;
  const high = issues.filter(i => i.severity === 'high').length;
  const medium = issues.filter(i => i.severity === 'medium').length;
  
  scoreValue -= Math.min(critical * PENALTY_CRITICAL, MAX_PENALTY_CRITICAL);
  scoreValue -= Math.min(high * PENALTY_HIGH, MAX_PENALTY_HIGH);
  scoreValue -= Math.min(medium * PENALTY_MEDIUM, MAX_PENALTY_MEDIUM);
  
  return Math.max(scoreValue, ZERO);
}

/**
 * Build report summary object.
 */
function buildSummary(scanned: number, findings: any, score: number) {
  const issues = findings.issues;
  return {
    filesScanned: scanned,
    totalIssues: issues.length + findings.secrets.length + findings.privacy.length,
    critical: issues.filter((i: any) => i.severity === 'critical').length,
    high: issues.filter((i: any) => i.severity === 'high').length,
    medium: issues.filter((i: any) => i.severity === 'medium').length,
    low: issues.filter((i: any) => i.severity === 'low').length,
    info: issues.filter((i: any) => i.severity === 'info').length,
    securityScore: score,
    riskLevel: getRiskLevelLabel(score)
  };
}

/**
 * Determine risk level label.
 */
function getRiskLevelLabel(score: number): any {
  if (score >= SCORE_EXCELLENT) return 'Low';
  if (score >= SCORE_GOOD) return 'Medium';
  if (score >= SCORE_POOR) return 'High';
  return 'Critical';
}

/**
 * Map issues to OWASP categories.
 */
function mapOwasp(issues: SecurityIssue[]) {
  const categories = ['Broken Access Control', 'Cryptographic Failures', 'Injection', 'Authentication Failures'];
  return categories.map(name => createOwaspItem(name, issues));
}

/**
 * Create a single OWASP summary item.
 */
function createOwaspItem(name: string, issues: SecurityIssue[]) {
  const matches = issues.filter(i => i.owaspCategory?.includes(name));
  return {
    category: name,
    title: name,
    issues: matches,
    compliant: matches.length === ZERO
  };
}

/**
 * Check compliance against standards.
 */
function checkCompliance(deps: any, privacyIssues: any[]) {
  const problems = [];
  if (deps.vulnerablePackages.length > 0) {
    problems.push('Vulnerable dependencies');
  }
  if (privacyIssues.length > 0) {
    problems.push('PII issues');
  }
  return { standard: 'ISO 27001', status: problems.length === ZERO ? 'compliant' : 'partial' as any, issues: problems };
}

/**
 * Generate security recommendations.
 */
function getRecs(findings: any, deps: any, owasp: any[]) {
  const recommendations = [];
  if (findings.secrets.length > ZERO) {
    recommendations.push('Rotate secrets.');
  }
  if (owasp.some(o => !o.compliant)) {
    recommendations.push('Fix OWASP issues.');
  }
  return recommendations.length > ZERO ? recommendations : ['✅ Secure.'];
}

/**
 * Generate audit prompt for agent.
 */
export function generateSecurityAuditPrompt(dirPath: string): string {
  return `Security Audit for ${dirPath}. Choose focus: 1. Full 2. Secrets 3. Deps.`;
}
