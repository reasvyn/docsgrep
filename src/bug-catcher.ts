/**
 * Professional Bug Detection Orchestrator
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileScanner } from "./tools/base.js";
import { BugAnalyzer } from "./utils/bugs/analyzer.js";

export interface BugIssue {
  file: string; line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string; title: string;
  description: string; evidence?: string;
  impact: string; remediation: string;
}

export interface BugReport {
  summary: {
    filesScanned: number; totalIssues: number;
    critical: number; high: number; medium: number; low: number;
    bugScore: number;
    riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  };
  categories: any[];
  recommendations: string[];
}

const FILE_SIZE_LIMIT = 500000;

/**
 * Catch bugs and runtime errors in the project.
 */
export async function catchBugs(dirPath: string, includePath?: string[], excludePath?: string[]): Promise<BugReport> {
  const matches = await FileScanner.findFiles({ dirPath, includePath, excludePath }, [
    '**/*.{js,ts,jsx,tsx,py,go,rs,php,java,rb,cs,cpp,c,swift,dart,kt,scala,groovy,ex,erl,clj}'
  ]);

  const allIssues: BugIssue[] = [];
  for (const match of matches.slice(0, 50)) {
    const issues = await analyzeFile(dirPath, match);
    allIssues.push(...issues);
  }

  const score = calculateScore(allIssues, matches.length);
  return {
    summary: buildSummary(matches.length, allIssues, score),
    categories: groupByCategory(allIssues),
    recommendations: generateRecs(allIssues, score)
  };
}

async function analyzeFile(root: string, match: string) {
  try {
    const full = path.join(root, match);
    const stat = await fs.stat(full);
    if (!stat.isFile() || stat.size > FILE_SIZE_LIMIT) return [];
    return BugAnalyzer.analyze(await fs.readFile(full, 'utf-8'), match);
  } catch (e) { return []; }
}

function calculateScore(issues: BugIssue[], scanned: number): number {
  if (scanned === 0) return 0;
  let scoreValue = 100;
  scoreValue -= Math.min(issues.filter(i => i.severity === 'critical').length * 15, 40);
  scoreValue -= Math.min(issues.filter(i => i.severity === 'high').length * 8, 25);
  return Math.max(scoreValue, 0);
}

function buildSummary(scanned: number, issues: BugIssue[], score: number) {
  const count = (sev: string) => issues.filter(i => i.severity === sev).length;
  return {
    filesScanned: scanned, totalIssues: issues.length,
    critical: count('critical'), high: count('high'),
    medium: count('medium'), low: count('low'),
    bugScore: score,
    riskLevel: score >= 90 ? 'Low' : score >= 70 ? 'Medium' : score >= 50 ? 'High' : 'Critical' as any
  };
}

function groupByCategory(issues: BugIssue[]) {
  const cats = ['Runtime', 'Race Condition', 'Memory Leak', 'Performance', 'Unresolved'];
  return cats.map(c => ({
    category: c,
    issues: issues.filter(i => i.category === c),
    status: issues.some(i => i.category === c && i.severity === 'critical') ? 'fail' : 'pass'
  }));
}

function generateRecs(issues: BugIssue[], score: number) {
  const recList = [];
  if (score < 80) recList.push("Address critical and high severity bugs first.");
  if (issues.some(i => i.category === 'Race Condition')) recList.push("Review concurrency logic.");
  return recList.length > 0 ? recList : ["System looks stable."];
}
