/**
 * Universal Code Quality Audit
 * Language-agnostic patterns for Clean Code and maintainability.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileScanner } from "./tools/base.js";
import { ConventionAnalyzer } from "./utils/audit/convention-analyzer.js";
import { SmellDetector } from "./utils/audit/smell-detector.js";
import { 
  type CodeIssue, 
  type AuditReport 
} from "./types/audit.js";

export { type CodeIssue, type AuditReport };

/**
 * Perform a universal code quality audit.
 */
export async function performUniversalAudit(
  dirPath: string,
  includePath?: string[],
  excludePath?: string[]
): Promise<AuditReport> {
  const filesToAudit = await readSampleFiles(dirPath, (await FileScanner.findFiles({ dirPath, includePath, excludePath }, [
    '**/*.{js,ts,jsx,tsx,py,go,rs,rb,java,cpp,c,cs,php,swift,dart,kt,scala,groovy,ex,erl,clj,sql,lua,ada,hs,sh,bash,ps1,yaml,yml,json,xml,html,css}'
  ])).slice(0, 50));
  const projectStructure = await analyzeStructure(dirPath, excludePath);
  
  const allIssuesDetected: CodeIssue[] = [];
  for (const fileObject of filesToAudit) {
    allIssuesDetected.push(...SmellDetector.detect(fileObject.content, fileObject.path, fileObject.lines));
  }

  const combinedSampleText = filesToAudit.map(f => f.content).join('\n');
  const detectedConventions = detectConventions(filesToAudit, combinedSampleText);
  const auditSummary = calculateSummary(allIssuesDetected, filesToAudit.length, projectStructure);

  return {
    summary: auditSummary,
    projectStructure,
    detectedConventions,
    issues: allIssuesDetected.slice(0, 50),
    strengths: getStrengths(projectStructure, allIssuesDetected),
    recommendations: getRecommendations(allIssuesDetected, auditSummary)
  };
}

async function readSampleFiles(rootPath: string, matches: string[]) {
  const auditResults = [];
  for (const matchName of matches) {
    try {
      const fullPath = path.join(rootPath, matchName);
      const content = await fs.readFile(fullPath, 'utf-8');
      auditResults.push({ path: fullPath, content, lines: content.split('\n') });
    } catch (e) { /* skip */ }
  }
  return auditResults;
}

async function analyzeStructure(rootPath: string, excludePatterns?: string[]) {
  const { existsSync } = await import('node:fs');
  const checkFile = (f: string) => existsSync(path.join(rootPath, f));
  
  return {
    hasDocumentation: checkFile('README.md') || checkFile('docs'),
    hasLinterConfig: checkFile('.eslintrc') || checkFile('package.json') || checkFile('pyproject.toml'),
    hasTests: checkFile('tests') || checkFile('test') || checkFile('vitest.config.ts'),
    hasCI: checkFile('.github') || checkFile('.gitlab-ci.yml'),
    directories: [],
    entryPoints: []
  };
}

function detectConventions(files: any[], text: string) {
  const commentInfo = ConventionAnalyzer.hasComments(text);
  return {
    namingStyle: ConventionAnalyzer.detectNaming(files),
    indentation: ConventionAnalyzer.detectIndentation(text),
    quoteStyle: ConventionAnalyzer.detectQuote(text),
    lineLengthAvg: ConventionAnalyzer.calculateAvgLineLength(text),
    hasComments: commentInfo.has,
    commentStyle: commentInfo.style
  };
}

function calculateSummary(issues: CodeIssue[], filesCount: number, structure: any) {
  const countObj = {
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length,
  };

  let qualityVal = 100;
  qualityVal -= Math.min(countObj.critical * 20, 40);
  qualityVal -= Math.min(countObj.high * 10, 30);
  qualityVal -= Math.min(countObj.medium * 5, 20);
  
  let docsVal = 60;
  if (structure.hasDocumentation) docsVal += 20;
  if (structure.hasLinterConfig) docsVal += 10;
  if (structure.hasTests) docsVal += 10;

  return {
    filesScanned: filesCount,
    totalIssues: issues.length,
    ...countObj,
    documentationScore: Math.min(docsVal, 100),
    codeQualityScore: Math.max(qualityVal, 0)
  };
}

function getStrengths(structure: any, issues: CodeIssue[]) {
  const strengthList = [];
  if (structure.hasDocumentation) strengthList.push("Good documentation found.");
  if (structure.hasTests) strengthList.push("Test suite detected.");
  if (issues.length === 0) strengthList.push("Very clean codebase!");
  return strengthList.length > 0 ? strengthList : ["Functional code detected."];
}

function getRecommendations(issues: CodeIssue[], summary: any) {
  const recList = [];
  if (summary.codeQualityScore < 80) recList.push("Focus on reducing complexity and nesting.");
  if (issues.some(i => i.category === 'Dead Code')) recList.push("Clean up unused variables.");
  return recList.length > 0 ? recList : ["Keep up the good work!"];
}
