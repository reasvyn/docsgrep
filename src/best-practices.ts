import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileScanner } from "./tools/base.js";
import { ConventionAnalyzer } from "./utils/audit/convention-analyzer.js";
import { SmellDetector } from "./utils/audit/smell-detector.js";
import { SupportedLanguage } from "./utils/supported-language.js";
import { 
  type CodeIssue, 
  type AuditReport 
} from "./types/audit.js";

export { type CodeIssue, type AuditReport };

export async function performUniversalAudit(
  dirPath: string,
  includePath?: string[],
  excludePath?: string[]
): Promise<AuditReport> {
  const allExts = SupportedLanguage.all().flatMap(l => l.extensions).join(",");
  const filesToAudit = await readSampleFiles(dirPath, (await FileScanner.findFiles({ dirPath, includePath, excludePath }, [
    `**/*.{${allExts}}`
  ])).slice(0, 50));
  const projectStructure = await analyzeStructure(dirPath, excludePath);
  const projectReadiness = await analyzeReadiness(dirPath);
  
  const allIssuesDetected: CodeIssue[] = [];
  for (const fileObject of filesToAudit) {
    allIssuesDetected.push(...SmellDetector.detect(fileObject.content, fileObject.path, fileObject.lines));
  }

  const combinedSampleText = filesToAudit.map(f => f.content).join('\n');
  const detectedConventions = detectConventions(filesToAudit, combinedSampleText);

  const readinessIssues = evaluateReadiness(projectReadiness, dirPath);
  allIssuesDetected.push(...readinessIssues);

  const auditSummary = calculateSummary(allIssuesDetected, filesToAudit.length, projectStructure);

  return {
    summary: auditSummary,
    projectStructure,
    projectReadiness,
    detectedConventions,
    issues: allIssuesDetected.slice(0, 50),
    strengths: getStrengths(projectStructure, allIssuesDetected, projectReadiness),
    recommendations: getRecommendations(allIssuesDetected, auditSummary, projectReadiness)
  };
}

async function readSampleFiles(rootPath: string, matches: string[]) {
  const auditResults = [];
  for (const matchName of matches) {
    try {
      const fullPath = path.join(rootPath, matchName);
      const content = await fs.readFile(fullPath, 'utf-8');
      auditResults.push({ path: fullPath, content, lines: content.split('\n') });
    } catch (e) { }
  }
  return auditResults;
}

async function analyzeStructure(rootPath: string, excludePatterns?: string[]) {
  const { existsSync } = await import('node:fs');
  const checkFile = (f: string) => existsSync(path.join(rootPath, f));
  
  const allConfigFiles = SupportedLanguage.all().flatMap(l => l.configFiles);
  const hasPackage = allConfigFiles.some(f => {
    if (f.startsWith("*.")) return checkFile(f.slice(1)) || false;
    return checkFile(f);
  });

  return {
    hasDocumentation: checkFile('README.md') || checkFile('README.rst') || checkFile('README') || checkFile('docs'),
    hasLinterConfig: hasPackage || checkFile('.eslintrc') || checkFile('pyproject.toml') || checkFile('rustfmt.toml'),
    hasTests: checkFile('tests') || checkFile('test') || checkFile('__tests__') || checkFile('spec'),
    hasCI: checkFile('.github') || checkFile('.gitlab-ci.yml') || checkFile('.circleci') || checkFile('.woodpecker'),
    directories: [],
    entryPoints: []
  };
}

async function analyzeReadiness(rootPath: string) {
  const { existsSync, readFileSync } = await import('node:fs');
  const checkFile = (f: string) => existsSync(path.join(rootPath, f));

  let gitignoreCoversBasics = false;
  if (checkFile('.gitignore')) {
    const content = readFileSync(path.join(rootPath, '.gitignore'), 'utf-8');
    const allIgnoreHints = SupportedLanguage.all().flatMap(l => l.ignoreFiles.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const covered = allIgnoreHints.filter(pat => new RegExp(pat).test(content));
    gitignoreCoversBasics = covered.length >= 3;
  }

  let detectedLang: SupportedLanguage | null = null;
  let meta: Record<string, string> = {};
  for (const lang of SupportedLanguage.all()) {
    for (const cf of lang.configFiles) {
      const fileName = cf.startsWith("*.") ? cf.slice(1) : cf;
      if (checkFile(fileName)) {
        detectedLang = lang;
        try {
          const raw = readFileSync(path.join(rootPath, fileName), 'utf-8');
          if (fileName.endsWith('.json')) {
            const json = JSON.parse(raw);
            meta.description = json.description || json.name || '';
            meta.author = json.author || json.authors || '';
            meta.license = json.license || json.license_file || '';
            meta.homepage = json.homepage || json.repository?.url || json.url || '';
          } else if (fileName === 'Cargo.toml') {
            const m = raw.match(/^\s*name\s*=\s*"([^"]+)"/m);
            if (m) meta.description = m[1];
            const d = raw.match(/^\s*description\s*=\s*"([^"]+)"/m);
            if (d) meta.description = d[1];
            const l = raw.match(/^\s*license\s*=\s*"([^"]+)"/m);
            if (l) meta.license = l[1];
            const a = raw.match(/^\s*authors\s*=\s*\[([^\]]+)\]/m);
            if (a) meta.author = a[1];
          } else if (fileName === 'go.mod') {
            const m = raw.match(/^module\s+(\S+)/m);
            if (m) meta.description = m[1];
          }
        } catch {}
        break;
      }
    }
  }

  return {
    hasLicense: checkFile('LICENSE') || checkFile('LICENSE.md') || checkFile('LICENSE.txt'),
    hasEditorconfig: checkFile('.editorconfig'),
    hasGitignore: checkFile('.gitignore'),
    hasEnvExample: checkFile('.env.example') || checkFile('.env.sample'),
    gitignoreCoversBasics,
    detectedType: detectedLang ? detectedLang.name : 'unknown',
    hasPackageMeta: !!meta.description,
    packageDescription: meta.description || '',
    packageAuthor: meta.author || '',
    packageLicense: meta.license || '',
    packageHomepage: meta.homepage || '',
  };
}

function evaluateReadiness(readiness: any, dirPath: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  if (!readiness.hasLicense) issues.push({
    file: dirPath, severity: 'high', category: 'Project Readiness',
    title: 'Missing License',
    description: 'No LICENSE file found. Every project should have an open-source license.',
    suggestion: 'Add a LICENSE file (MIT, Apache-2.0, GPL-3.0, etc.).'
  });
  if (!readiness.hasGitignore) issues.push({
    file: dirPath, severity: 'high', category: 'Project Readiness',
    title: 'Missing .gitignore',
    description: 'No .gitignore file found. Build artifacts and secrets may be committed.',
    suggestion: 'Add a .gitignore covering build artifacts, dependencies, and env files.'
  });
  if (readiness.hasGitignore && !readiness.gitignoreCoversBasics) issues.push({
    file: path.join(dirPath, '.gitignore'), severity: 'medium', category: 'Project Readiness',
    title: 'Incomplete .gitignore',
    description: '.gitignore may miss critical entries (build/, .env, deps).',
    suggestion: 'Ensure build output, dependency folders, .env files, and OS files are ignored.'
  });
  if (!readiness.hasEnvExample) issues.push({
    file: dirPath, severity: 'medium', category: 'Project Readiness',
    title: 'Missing .env.example',
    description: 'No .env.example file for required environment variables.',
    suggestion: 'Create .env.example documenting required env vars without secrets.'
  });
  if (!readiness.hasEditorconfig) issues.push({
    file: dirPath, severity: 'low', category: 'Project Readiness',
    title: 'Missing .editorconfig',
    description: 'No .editorconfig to enforce consistent indentation across editors.',
    suggestion: 'Add .editorconfig with indent style, charset, and end-of-line settings.'
  });
  if (readiness.detectedType !== 'unknown' && !readiness.packageDescription) issues.push({
    file: dirPath, severity: 'low', category: 'Project Readiness',
    title: 'Project metadata missing description',
    description: `Project uses ${readiness.detectedType} but has no description.`,
    suggestion: 'Add a short description of what the project does.'
  });
  return issues;
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

function getStrengths(structure: any, issues: CodeIssue[], readiness: any) {
  const strengthList = [];
  if (structure.hasDocumentation) strengthList.push("Documentation found.");
  if (structure.hasTests) strengthList.push("Test suite detected.");
  if (readiness.hasLicense) strengthList.push("License file present.");
  if (readiness.hasGitignore && readiness.gitignoreCoversBasics) strengthList.push(".gitignore covers essentials.");
  if (readiness.hasEditorconfig) strengthList.push(".editorconfig present.");
  if (issues.length === 0) strengthList.push("Very clean codebase!");
  return strengthList.length > 0 ? strengthList : ["Functional code detected."];
}

function getRecommendations(issues: CodeIssue[], summary: any, readiness: any) {
  const recList = [];
  if (summary.codeQualityScore < 80) recList.push("Reduce complexity and nesting.");
  if (issues.some(i => i.category === 'Dead Code')) recList.push("Remove unused variables/imports.");
  if (!readiness.hasLicense) recList.push("Add an open-source license file.");
  if (!readiness.hasEnvExample) recList.push("Create .env.example for required environment variables.");
  if (!readiness.hasEditorconfig) recList.push("Add .editorconfig to enforce consistent formatting.");
  if (readiness.hasGitignore && !readiness.gitignoreCoversBasics) recList.push("Review .gitignore for critical missing entries.");
  return recList.length > 0 ? recList : ["Keep up the good work!"];
}
