// Universal code quality rules that apply across ALL programming languages
// These are language-agnostic patterns that indicate code quality issues

import { getIgnorePatterns } from "./utils/file.js";
import { CodeSanitizer } from "./utils/code-analysis.js";

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
    documentationScore: number; // 0-100
    codeQualityScore: number; // 0-100
  };
  projectStructure: {
    hasDocumentation: boolean;
    hasLinterConfig: boolean;
    hasTests: boolean;
    hasCI: boolean;
    directories: string[];
    entryPoints: string[];
  };
  detectedConventions: {
    namingStyle: string; // camelCase, snake_case, PascalCase, etc.
    indentation: string; // spaces, tabs
    quoteStyle: string; // single, double, backtick
    lineLengthAvg: number;
    hasComments: boolean;
    commentStyle: string;
  };
  issues: CodeIssue[];
  strengths: string[];
  recommendations: string[];
}

// Universal code quality analyzers that work across languages
class UniversalCodeAnalyzer {
  
  // Detect naming conventions used in the project
  detectNamingConventions(files: Array<{ path: string; content: string }>): string {
    const scores: Record<string, number> = {
      camelCase: 0,
      snake_case: 0,
      PascalCase: 0,
      UPPER_SNAKE: 0,
    };
    
    for (const file of files) {
      const identifiers = file.content.match(/\b[a-zA-Z_]\w*\b/g) || [];
      for (const id of identifiers) {
        if (/^[a-z]+(?:[A-Z][a-z]*)*$/.test(id)) scores.camelCase++;
        if (/^[a-z]+(?:_[a-z]+)*$/.test(id)) scores.snake_case++;
        if (/^[A-Z][a-z]+(?:[A-Z][a-z]*)*$/.test(id)) scores.PascalCase++;
        if (/^[A-Z]+(?:_[A-Z]+)*$/.test(id)) scores.UPPER_SNAKE++;
      }
    }
    
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }
  
  // Detect indentation style
  detectIndentation(content: string): string {
    const lines = content.split('\n');
    let spaceCount = 0;
    let tabCount = 0;
    
    for (const line of lines) {
      if (/^ {2}/.test(line)) spaceCount++;
      if (/^\t/.test(line)) tabCount++;
    }
    
    return tabCount > spaceCount ? 'tabs' : 'spaces';
  }
  
  // Detect quote style
  detectQuoteStyle(content: string): string {
    const single = (content.match(/'/g) || []).length;
    const double = (content.match(/"/g) || []).length;
    const backtick = (content.match(/`/g) || []).length;
    
    if (backtick > single && backtick > double) return 'backtick';
    return double > single ? 'double' : 'single';
  }
  
  // Calculate average line length
  calculateAvgLineLength(content: string): number {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return 0;
    const total = lines.reduce((sum, line) => sum + line.length, 0);
    return Math.round(total / lines.length);
  }
  
  // Check if code has comments
  hasComments(content: string): { has: boolean; style: string } {
    const singleLine = (content.match(/\/\/|\#|--|%;/g) || []).length;
    const multiLine = (content.match(/\/\*|\*\/|"""|'''/g) || []).length;
    
    if (singleLine === 0 && multiLine === 0) {
      return { has: false, style: 'none' };
    }
    
    return {
      has: true,
      style: singleLine > multiLine ? 'single-line' : 'multi-line',
    };
  }
  
  // Detect code smells universal
  detectCodeSmells(content: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');
    const ext = filePath.split('.').pop()?.toLowerCase() || 'ts';
    
    // Create sanitized version for logic-based checks (ignore comments)
    const sanitizedContent = CodeSanitizer.stripComments(content, ext);
    const sanitizedLines = sanitizedContent.split('\n');

    // 1. File too long (generic: >400 lines is suspicious)
    if (lines.length > 400) {
      issues.push({
        file: filePath,
        severity: 'medium',
        category: 'Maintainability',
        title: 'Long File',
        description: `File has ${lines.length} lines, which may indicate violation of Single Responsibility Principle.`,
        suggestion: 'Consider splitting into smaller, focused modules.',
      });
    }
    
    // 2. Function/Method too long and Parameter Count
    const funcPatterns = [
      /\b(?:function|def|func|fn|sub|procedure)\s+(\w+)\s*\(([^)]*)\)/g, // Most languages
      /\b(?:public|private|protected|static|async)?\s*\w+\s+(\w+)\s*\(([^)]*)\)\s*{/g, // C-style
      /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\(([^)]*)\)\s*=>)/g, // JS arrows
    ];
    
    // Detect long functions by counting lines between braces (simplified)
    let currentDepth = 0;
    let funcStart = -1;
    let currentFuncName = '';
    
    for (let i = 0; i < sanitizedLines.length; i++) {
      const line = sanitizedLines[i];
      if (CodeSanitizer.isIgnored(lines[i])) continue;

      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      // Try to catch function name and params
      for (const pattern of funcPatterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(line);
        if (match && funcStart === -1) {
          funcStart = i;
          currentFuncName = match[1];
          const params = match[2] || '';
          const paramCount = params.split(',').filter(p => p.trim().length > 0).length;
          
          if (paramCount > 5) {
            issues.push({
              file: filePath,
              line: i + 1,
              severity: 'medium',
              category: 'Maintainability',
              title: 'Too Many Parameters',
              description: `Function '${currentFuncName}' has ${paramCount} parameters.`,
              suggestion: 'Consider using an object/struct to group parameters or splitting the function.',
            });
          }
        }
      }
      
      currentDepth += openBraces - closeBraces;
      
      if (funcStart !== -1 && currentDepth === 0 && (openBraces + closeBraces > 0)) {
        const funcLength = i - funcStart;
        if (funcLength > 60) {
          issues.push({
            file: filePath,
            line: funcStart + 1,
            severity: 'medium',
            category: 'Maintainability',
            title: 'Long Function/Method',
            description: `Function '${currentFuncName}' appears to be ${funcLength} lines long.`,
            suggestion: 'Break down into smaller, more focused functions.',
          });
        }
        funcStart = -1;
      }
    }
    
     // 3. Deep nesting (universal)
     let maxNesting = 0;
     for (let i = 0; i < sanitizedLines.length; i++) {
       const line = sanitizedLines[i];
       if (CodeSanitizer.isIgnored(lines[i])) continue;

       const indent = line.match(/^(\s*)/)?.[1] || '';
       const depth = indent.length / (indent.includes('\t') ? 1 : 2); // Assume 2 spaces
       if (depth > maxNesting) maxNesting = depth;
     }
    
    if (maxNesting > 4) {
      issues.push({
        file: filePath,
        severity: 'high',
        category: 'Readability',
        title: 'Deep Nesting',
        description: `Code has nesting level of ${maxNesting}, which hurts readability.`,
        suggestion: 'Use early returns, extract methods, or use guard clauses.',
      });
    }
    
    // 4. Complexity & Complex Conditionals
    let complexBlocks = 0;
    for (let i = 0; i < sanitizedLines.length; i++) {
      const line = sanitizedLines[i];
      if (CodeSanitizer.isIgnored(lines[i])) continue;
      
      // Cyclomatic complexity indicators
      const branchMatches = line.match(/\b(if|else if|case|for|while|catch|&&|\|\|)\b/g) || [];
      if (branchMatches.length > 3) {
        issues.push({
          file: filePath,
          line: i + 1,
          severity: 'medium',
          category: 'Complexity',
          title: 'Complex Expression',
          description: 'Line contains multiple logical branches or conditions.',
          suggestion: 'Simplify the expression or break it into multiple lines/variables.',
        });
      }
      
      if (branchMatches.length > 0) complexBlocks += branchMatches.length;
    }

    if (complexBlocks > 40) {
       issues.push({
        file: filePath,
        severity: 'medium',
        category: 'Complexity',
        title: 'High File Complexity',
        description: `File has a high number of logical branches (${complexBlocks}).`,
        suggestion: 'Refactor complex logic into smaller, testable functions.',
      });
    }
    
    // 5. Naming Smells (short names)
    const shortNameRegex = /\b(const|let|var|def|func|fn)\s+([a-zA-Z0-9_$]{1})\b/g;
    let nameMatch;
    while ((nameMatch = shortNameRegex.exec(sanitizedContent)) !== null) {
      const name = nameMatch[2];
      if (!['i', 'j', 'k', 'x', 'y', 'z', 'e', 'v', '_'].includes(name.toLowerCase())) {
        const lineNum = sanitizedContent.substring(0, nameMatch.index).split('\n').length;
        if (CodeSanitizer.isIgnored(lines[lineNum - 1])) continue;

        issues.push({
          file: filePath,
          line: lineNum,
          severity: 'low',
          category: 'Readability',
          title: 'Cryptic Name',
          description: `Variable name '${name}' is too short and non-descriptive.`,
          suggestion: 'Use descriptive names that convey intent.',
        });
      }
    }
    
    // 6. Magic numbers (universal)
    const magicNumberRegex = /(?<![.\w'"$])\d{2,}(?![.\w])/g;
    const magicNumbers = sanitizedContent.match(magicNumberRegex);
    if (magicNumbers && magicNumbers.length > 5) {
      const filtered = magicNumbers.filter(n => !['10', '100', '1000', '200', '400', '404', '500'].includes(n));
      if (filtered.length > 3) {
        issues.push({
          file: filePath,
          severity: 'low',
          category: 'Code Quality',
          title: 'Magic Numbers',
          description: `Found ${filtered.length} magic numbers. Use named constants.`,
          suggestion: 'Extract magic numbers to named constants with descriptive names.',
        });
      }
    }
    
    // 7. TODO/FIXME comments (technical debt) - Uses ORIGINAL content
    const todoPattern = /\b(?:TODO|FIXME|HACK|XXX|BUG)\b/gi;
    const todos = content.match(todoPattern);
    if (todos && todos.length > 0) {
      issues.push({
        file: filePath,
        severity: 'low',
        category: 'Technical Debt',
        title: 'Unresolved TODOs',
        description: `Found ${todos.length} TODO/FIXME comments indicating technical debt.`,
        suggestion: 'Address these items or create tracking tickets.',
      });
    }

    // 8. Duplicate code detection (simple: repeated lines)
    const nonEmptyLines = sanitizedLines.map(l => l.trim()).filter(l => l.length > 25);
    const lineCount: Record<string, number> = {};
    for (const line of nonEmptyLines) {
      lineCount[line] = (lineCount[line] || 0) + 1;
    }
    const duplicates = Object.entries(lineCount).filter(([_, count]) => count > 2);
    if (duplicates.length > 0) {
      issues.push({
        file: filePath,
        severity: 'medium',
        category: 'DRY Violation',
        title: 'Potential Duplicate Code',
        description: `Found ${duplicates.length} lines that appear multiple times.`,
        suggestion: 'Extract repeated code into reusable functions or methods.',
      });
    }
    
    // 9. Dead code indicators (unused variables/functions)
    if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx') {
      const unusedPattern = /\b(?:const|let|var)\s+(\w+)\s*[=;]/g;
      let match;
      while ((match = unusedPattern.exec(sanitizedContent)) !== null) {
        const varName = match[1];
        const usageRegex = new RegExp(`\\b${varName}\\b`, 'g');
        const usages = sanitizedContent.match(usageRegex);
        if (!usages || usages.length <= 1) {
          const lineNum = sanitizedContent.substring(0, match.index).split('\n').length;
          if (CodeSanitizer.isIgnored(lines[lineNum - 1])) continue;

          issues.push({
            file: filePath,
            line: lineNum,
            severity: 'medium',
            category: 'Dead Code',
            title: 'Potentially Unused Variable',
            description: `Variable '${varName}' appears to be declared but not used.`,
            suggestion: 'Remove unused variables to keep code clean.',
          });
        }
      }
    }
    
    return issues.slice(0, 15); // Limit per file
  }

}

// Main audit function
export async function performUniversalAudit(
  dirPath: string,
  includePath?: string[],
  excludePath?: string[]
): Promise<AuditReport> {
  const analyzer = new UniversalCodeAnalyzer();
  const ignorePatterns = await getIgnorePatterns(dirPath);
  
  // Step 1: Find all source files (language agnostic)
  const { FileScanner } = await import("./tools/base.js");
  const defaultPatterns = [
    '**/*.{js,ts,jsx,tsx,py,go,rs,rb,java,cpp,c,cs,php,swift,dart,ex,erl,elixir,clj,scala,kt,ts,sh,bash,yaml,yml,json,xml,html,css,scss}',
  ];
  
  const matches = await FileScanner.findFiles({ dirPath, includePath, excludePath }, defaultPatterns);
  const files: Array<{ path: string; content: string; ext: string }> = [];
    
    for (const match of matches.slice(0, 50)) { // Limit to 50 files for performance
      try {
        const fullPath = dirPath + '/' + match;
        const content = await (await import('node:fs/promises')).readFile(fullPath, 'utf-8');
        const ext = match.split('.').pop() || '';
        files.push({ path: fullPath, content, ext });
      } catch (e) {
        // Skip unreadable files
      }
    }
  
  // Step 2: Analyze project structure
  const structure = await analyzeProjectStructure(dirPath, excludePath);
  
  // Step 3: Detect conventions from sampled files
  const namingStyle = analyzer.detectNamingConventions(files);
  const sampleContent = files.map(f => f.content).join('\n');
  const indentation = analyzer.detectIndentation(sampleContent);
  const quoteStyle = analyzer.detectQuoteStyle(sampleContent);
  const avgLineLength = analyzer.calculateAvgLineLength(sampleContent);
  const commentInfo = analyzer.hasComments(sampleContent);
  
  // Step 4: Run universal code quality checks
  const allIssues: CodeIssue[] = [];
  for (const file of files) {
    const issues = analyzer.detectCodeSmells(file.content, file.path);
    allIssues.push(...issues);
  }
  
  // Step 5: Calculate scores
  const documentationScore = calculateDocumentationScore(structure);
  const codeQualityScore = calculateCodeQualityScore(allIssues, files.length);
  
  // Step 6: Identify strengths
  const strengths = identifyStrengths(structure, allIssues);
  
  // Step 7: Generate recommendations
  const recommendations = generateUniversalRecommendations(allIssues, structure, namingStyle);
  
  const summary = {
    filesScanned: files.length,
    totalIssues: allIssues.length,
    critical: allIssues.filter(i => i.severity === 'critical').length,
    high: allIssues.filter(i => i.severity === 'high').length,
    medium: allIssues.filter(i => i.severity === 'medium').length,
    low: allIssues.filter(i => i.severity === 'low').length,
    documentationScore,
    codeQualityScore,
  };
  
  return {
    summary,
    projectStructure: structure,
    detectedConventions: {
      namingStyle,
      indentation,
      quoteStyle,
      lineLengthAvg: avgLineLength,
      hasComments: commentInfo.has,
      commentStyle: commentInfo.style,
    },
    issues: allIssues.slice(0, 100), // Limit to 100 issues
    strengths,
    recommendations,
  };
}

async function analyzeProjectStructure(dirPath: string, excludePath?: string[]): Promise<AuditReport['projectStructure']> {

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { FileScanner } = await import('./tools/base.js');
  
  const hasDocumentation = await fileExists(dirPath, ['README*', 'docs/**/*.md', 'DOCUMENTATION*'], excludePath);
  const hasLinterConfig = await fileExists(dirPath, [
    '.eslintrc*', '.prettierrc*', 'tsconfig.json', '.editorconfig',
    '.rubocop.yml', '.flake8', 'phpcs.xml', 'rustfmt.toml', '.pylintrc',
  ], excludePath);
  const hasTests = await fileExists(dirPath, ['test/**', 'tests/**', 'spec/**', '__tests__/**'], excludePath);
  const hasCI = await fileExists(dirPath, ['.github/workflows/**', '.gitlab-ci.yml', 'Jenkinsfile', '.circleci/**'], excludePath);
  
  // Get top-level directories
  const directories = await FileScanner.findDirectories({ dirPath, excludePath });
  
  // Detect entry points
  const entryPoints = await findEntryPoints(dirPath, excludePath);
  
  return {
    hasDocumentation,
    hasLinterConfig,
    hasTests,
    hasCI,
    directories,
    entryPoints,
  };
}

async function fileExists(dirPath: string, patterns: string[], excludePath?: string[]): Promise<boolean> {
  const { FileScanner } = await import('./tools/base.js');
  const matches = await FileScanner.findFiles({ dirPath, excludePath, includePath: patterns }, patterns);
  return matches.length > 0;
}

async function findEntryPoints(dirPath: string, excludePath?: string[]): Promise<string[]> {
  const commonEntryPoints = [
    'index.{js,ts,py,go,rs,rb,java}',
    'main.{js,ts,py,go,rs,rb,java,c,cpp}',
    'app.{js,ts,py,go,rs}',
    'server.{js,ts,py,go}',
    'src/main/*',
    'src/index.*',
    'lib/*/index.*',
    'package.json', // Check "main" field
  ];
  
  const { FileScanner } = await import('./tools/base.js');
  const entryPoints = await FileScanner.findFiles({ dirPath, excludePath, includePath: commonEntryPoints }, commonEntryPoints);
  
  return [...new Set(entryPoints)].slice(0, 10);
}

function calculateDocumentationScore(structure: AuditReport['projectStructure']): number {
  let score = 0;
  if (structure.hasDocumentation) score += 40;
  if (structure.hasLinterConfig) score += 20;
  if (structure.hasTests) score += 20;
  if (structure.hasCI) score += 20;
  return score;
}

function calculateCodeQualityScore(issues: CodeIssue[], fileCount: number): number {
  if (fileCount === 0) return 0;
  const issuesPerFile = issues.length / fileCount;
  let score = 100;
  score -= Math.min(issuesPerFile * 10, 50); // Max 50 point reduction
  return Math.max(score, 0);
}

function identifyStrengths(structure: AuditReport['projectStructure'], issues: CodeIssue[]): string[] {
  const strengths: string[] = [];
  
  if (structure.hasDocumentation) {
    strengths.push('Project has documentation (README/docs) - great for maintainability!');
  }
  if (structure.hasLinterConfig) {
    strengths.push('Linter/formatter configuration detected - shows commitment to code quality.');
  }
  if (structure.hasTests) {
    strengths.push('Test suite detected - excellent for reliability and refactoring confidence.');
  }
  if (structure.hasCI) {
    strengths.push('CI/CD pipeline configured - automated quality checks in place.');
  }
  if (issues.filter(i => i.severity === 'critical').length === 0) {
    strengths.push('No critical issues found - good baseline quality.');
  }
  
  return strengths.length > 0 ? strengths : ['Codebase is being analyzed...'];
}

function generateUniversalRecommendations(
  issues: CodeIssue[],
  structure: AuditReport['projectStructure'],
  namingStyle: string
): string[] {
  const recommendations: string[] = [];
  
  // Documentation
  if (!structure.hasDocumentation) {
    recommendations.push('Create README.md with project overview, setup instructions, and usage examples. Consider adding docs/ folder for detailed documentation.');
  }
  
  // Linting
  if (!structure.hasLinterConfig) {
    recommendations.push('Add a linter and formatter (e.g., ESLint + Prettier for JS/TS, Black for Python, Clippy for Rust) to enforce consistent style automatically.');
  }
  
  // Testing
  if (!structure.hasTests) {
    recommendations.push('Add automated tests. Start with unit tests for core logic, then add integration tests.');
  }
  
  // CI/CD
  if (!structure.hasCI) {
    recommendations.push('Set up CI/CD pipeline (GitHub Actions, GitLab CI) to automate testing and quality checks on every commit.');
  }
  
  // Code quality issues
  const highIssues = issues.filter(i => i.severity === 'high' || i.severity === 'critical');
  if (highIssues.length > 0) {
    recommendations.push(`Address ${highIssues.length} high/critical severity issues first - they impact maintainability and may indicate bugs.`);
  }
  
  // Naming conventions
  recommendations.push(`Detected naming style: ${namingStyle}. Ensure consistency across the entire codebase.`);
  
  // Specific issue categories
  const categories = [...new Set(issues.map(i => i.category))];
  
  if (categories.includes('Dead Code')) {
    recommendations.push('Remove dead code (unused variables, functions, imports) to reduce clutter and improve clarity.');
  }
  
  if (categories.includes('Maintainability')) {
    recommendations.push('Refactor large files/functions into smaller, focused modules following Single Responsibility Principle.');
  }
  
  if (categories.includes('DRY Violation')) {
    recommendations.push('Eliminate duplicate code by extracting reusable functions or using inheritance/composition.');
  }
  
  if (categories.includes('Readability')) {
    recommendations.push('Improve code readability: reduce nesting, use descriptive names (avoid single-letter variables except for counters), and add comments for complex logic.');
  }
  
  if (categories.includes('Complexity')) {
    recommendations.push('Reduce cyclomatic complexity by breaking down complex conditional logic and simplifying nested loops.');
  }
  
  return recommendations.length > 0 ? recommendations : ['Code quality looks good! Keep following best practices.'];
}

// Helper to generate audit prompt (language agnostic)
export function generateUniversalAuditPrompt(dirPath: string, structure: AuditReport['projectStructure']): string {
  let prompt = `## 🔍 Universal Code Quality Audit\n\n`;
  prompt += `**Target Directory**: \`${dirPath}\`\n\n`;
  
  prompt += `### 📂 Project Structure Analysis\n`;
  prompt += `- Documentation: ${structure.hasDocumentation ? '✅ Present' : '❌ Missing'}\n`;
  prompt += `- Linter/Formatter: ${structure.hasLinterConfig ? '✅ Configured' : '❌ Not configured'}\n`;
  prompt += `- Tests: ${structure.hasTests ? '✅ Present' : '❌ Missing'}\n`;
  prompt += `- CI/CD: ${structure.hasCI ? '✅ Configured' : '❌ Not configured'}\n`;
  prompt += `- Directories: ${structure.directories.slice(0, 5).join(', ')}${structure.directories.length > 5 ? '...' : ''}\n\n`;
  
  prompt += `### 🎯 What would you like to audit?\n\n`;
  prompt += `1. **Full Universal Audit** - Scan all source files for language-agnostic quality issues\n`;
  prompt += `2. **Documentation Check** - Analyze documentation coverage and quality\n`;
  prompt += `3. **Structure Audit** - Check project organization and conventions\n`;
  prompt += `4. **Code Smells** - Detect universal issues (long functions, deep nesting, dead code)\n`;
  prompt += `5. **Custom Focus** - Specify file patterns or directories to focus on\n\n`;
  
  prompt += `The audit will:\n`;
  prompt += `- Detect naming conventions, indentation, and style automatically\n`;
  prompt += `- Identify code smells that apply across ALL programming languages\n`;
  prompt += `- Generate actionable recommendations for quality improvement\n`;
  prompt += `- Score your project on documentation and code quality (0-100)\n\n`;
  
  prompt += `Please specify your choice, and I'll generate a comprehensive, language-agnostic audit report.`;
  
  return prompt;
}
