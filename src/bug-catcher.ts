// catch_bugs - Professional Bug Detection Tool
// Focuses on: runtime errors, potential bugs, race conditions, memory leaks, 
// dependency coupling, and performance issues with large data handling

export class BugDetector {
  
  // 1. Runtime Error Patterns
  private runtimeErrorPatterns = {
    'Unhandled Promise Rejection': {
      patterns: [
        /\.then\([^)]*\)(?!\s*\.catch)/g, // Promise without catch
        /await\s+[^;]+(?!\s*catch)/g, // await without try-catch
        /new\s+Promise\s*\([^)]*\)(?!\s*\.catch)/g, // Promise without catch
      ],
      description: 'Promises or async operations without proper error handling',
    },
    'Null/Undefined Dereference': {
      patterns: [
        /\w+\.\w+(?!\s*(?:&&|\?\.|\?\?:|\|\|))/g, // Property access without null check
        /!\s*\w+\.\w+/g, // Non-null assertion without check
      ],
      description: 'Potential null/undefined dereference without safety checks',
    },
    'Uninitialized Variables': {
      patterns: [
        /let\s+\w+\s*;(?!=)/g, // Variable declared but not initialized
        /const\s+\w+\s*;(?!=)/g, // Const without initialization
      ],
      description: 'Variables declared but not initialized',
    },
    'Type Coercion Issues': {
      patterns: [
        /==\s*(?!==)/g, // Loose equality
        /!=\s*(?!==)/g, // Loose inequality
      ],
      description: 'Loose equality/inequality may cause unexpected type coercion',
    },
  };

  // 2. Race Condition Patterns
  private raceConditionPatterns = {
    'Unsynchronized Shared State': {
      patterns: [
        /(let|var|const)\s+(\w+)\s*=.*;(?=.*\2\s*\+\+)/gs, // Shared variable increment
        /(let|var|const)\s+(\w+)\s*=.*;(?=.*\2\s*--)/gs, // Shared variable decrement
        /this\.\w+\s*=\s*.*;(?=.*this\.\w+)/gs, // Multiple assignments to shared state
      ],
      description: 'Shared state modifications without synchronization',
    },
    'Missing Async/Await': {
      patterns: [
        /async\s+function[^{]*\{[^}]*then\s*\(/g, // async function mixing then()
        /new\s+Promise[^}]*\}\s*(?!await)/g, // Promise without await
      ],
      description: 'Potential race condition from mixing async patterns',
    },
    'Concurrent Modification': {
      patterns: [
        /for\s*\([^)]*\)\s*\{[^}]*push\s*\(/g, // Array modification during iteration
        /for\s*\([^)]*\)\s*\{[^}]*splice\s*\(/g, // Array modification during iteration
      ],
      description: 'Array/object modification during iteration may cause issues',
    },
  };

  // 3. Memory Leak Patterns
  private memoryLeakPatterns = {
    'Event Listener Leaks': {
      patterns: [
        /addEventListener\s*\([^)]*\)(?!\s*removeEventListener)/g, // Listener added without removal
        /\.on\s*\([^)]*\)(?!\s*\.off|\.removeListener)/g, // Event emitter without cleanup
      ],
      description: 'Event listeners added without corresponding removal',
    },
    'Uncleared Intervals/Timers': {
      patterns: [
        /setInterval\s*\([^)]*\)(?!\s*clearInterval)/g, // Interval without clear
        /setTimeout\s*\([^)]*\)(?!\s*clearTimeout)/g, // Timeout without clear (less critical)
      ],
      description: 'Intervals or timers set without cleanup',
    },
    'Large Object References': {
      patterns: [
        /cache\s*[=:]\s*\{/g, // Cache objects
        /Map\s*\(\s*\)/g, // Map without size limits
        /WeakMap|WeakSet/g, // Good patterns (mentioned for awareness)
      ],
      description: 'Potential memory accumulation in caches or collections',
    },
    'Closure Memory Leaks': {
      patterns: [
        /function\s*\([^)]*\)\s*\{[^}]*function\s*\([^)]*\)/g, // Nested functions (closures)
      ],
      description: 'Deep closures may retain references to large scopes',
    },
  };

  // 4. Dependency Coupling Patterns
  private couplingPatterns = {
    'Circular Dependencies': {
      patterns: [
        /require\s*\([^)]*\)/g, // CommonJS imports (check via analysis)
        /from\s+['"][^'"]+['"]/g, // ES6 imports
      ],
      description: 'Potential circular dependencies (requires cross-file analysis)',
    },
    'Tight Coupling': {
      patterns: [
        /new\s+[A-Z]\w*\s*\(/g, // Direct instantiation (vs dependency injection)
        /require\s*\(['"]\.\.[^'"]+['"]\)/g, // Relative imports (many indicates coupling)
      ],
      description: 'High coupling through direct instantiation and many imports',
    },
    'God Object/Module': {
      patterns: [
        /export\s+(function|class|const)\s+\w+/g, // Count exports (many = god object)
      ],
      description: 'Module with too many exports may indicate god object',
    },
  };

  // 5. Performance Issues with Large Data
  private performancePatterns = {
    'Inefficient Loops': {
      patterns: [
        /for\s*\([^;]*;\s*[^;]*\.length\s*;/g, // Loop with .length in condition
        /while\s*\([^}]*\.length\s*>/g, // While with .length check
      ],
      description: 'Loop conditions recalculating .length on each iteration',
    },
    'Synchronous Large File Operations': {
      patterns: [
        /readFileSync\s*\(/g, // Sync file read
        /writeFileSync\s*\(/g, // Sync file write
        /readFile\s*\([^)]*\)(?!\s*\.then|\s*then)/g, // Async read without proper handling
      ],
      description: 'Synchronous operations may block event loop with large data',
    },
    'Memory-Heavy Operations': {
      patterns: [
        /JSON\.parse\s*\(/g, // JSON parsing (can be heavy)
        /\.map\s*\([^)]*\)\.map\s*\(/g, // Chained array operations
        /Buffer\.alloc\s*\(\s*\d{6,}/g, // Large buffer allocation (>100KB)
      ],
      description: 'Operations that may consume significant memory with large data',
    },
    'Unbounded Recursion': {
      patterns: [
        /function\s+\w+\s*\([^)]*\)\s*\{[^}]*\w+\s*\(/g, // Function calling itself or others recursively
      ],
      description: 'Potential unbounded recursion without depth limits',
    },
  };

  // 6. Unresolved Errors/Warnings
  private unresolvedPatterns = {
    'TODO/FIXME/HACK': {
      patterns: [
        /\/\/\s*(TODO|FIXME|HACK|XXX|BUG)\b/gi,
        /\/\*\s*(TODO|FIXME|HACK|XXX|BUG)\b/gi,
      ],
      description: 'Unresolved TODO/FIXME comments indicating known issues',
    },
    'Console/Debug Statements': {
      patterns: [
        /console\.(log|debug|info)\s*\(/g,
        /debugger\s*;/g,
      ],
      description: 'Debug statements left in code (should be removed for production)',
    },
    'Deprecated API Usage': {
      patterns: [
        /new\s+Date\s*\(\s*\)\.getYear\s*\(/g, // Deprecated Date.getYear()
        /escape\s*\(/g, // Deprecated escape()
        /unescape\s*\(/g, // Deprecated unescape()
      ],
      description: 'Usage of deprecated APIs that may be removed',
    },
  };

  // Main detection method
  detectBugs(content: string, filePath: string): BugIssue[] {
    const issues: BugIssue[] = [];
    const lines = content.split('\n');

    // 1. Runtime Errors
    for (const [category, config] of Object.entries(this.runtimeErrorPatterns)) {
      for (const pattern of config.patterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            file: filePath,
            line: lineNum,
            severity: this.getSeverityForCategory('runtime'),
            category: 'Runtime Error',
            title: category,
            description: config.description,
            evidence: lines[lineNum - 1]?.substring(0, 100),
            impact: 'May cause runtime exceptions or unexpected behavior',
            remediation: this.getRemediationForRuntime(category),
          });
        }
      }
    }

    // 2. Race Conditions
    for (const [category, config] of Object.entries(this.raceConditionPatterns)) {
      for (const pattern of config.patterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            file: filePath,
            line: lineNum,
            severity: this.getSeverityForCategory('race'),
            category: 'Race Condition',
            title: category,
            description: config.description,
            evidence: lines[lineNum - 1]?.substring(0, 100),
            impact: 'May cause data races, inconsistent state, or flaky tests',
            remediation: this.getRemediationForRace(category),
          });
        }
      }
    }

    // 3. Memory Leaks
    for (const [category, config] of Object.entries(this.memoryLeakPatterns)) {
      for (const pattern of config.patterns) {
        let match;
        pattern.lastIndex = 0;
        // Skip positive patterns (like WeakMap which is good)
        if (category.includes('WeakMap') || category.includes('WeakSet')) continue;
        
        while ((match = pattern.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            file: filePath,
            line: lineNum,
            severity: this.getSeverityForCategory('memory'),
            category: 'Memory Leak',
            title: category,
            description: config.description,
            evidence: lines[lineNum - 1]?.substring(0, 100),
            impact: 'May cause memory growth over time, leading to crashes',
            remediation: this.getRemediationForMemory(category),
          });
        }
      }
    }

    // 4. Dependency Coupling
    for (const [category, config] of Object.entries(this.couplingPatterns)) {
      for (const pattern of config.patterns) {
        let match;
        pattern.lastIndex = 0;
        const matches = content.match(pattern) || [];
        if (matches.length > 10) { // Only flag if many imports/instantiations
          issues.push({
            file: filePath,
            severity: this.getSeverityForCategory('coupling'),
            category: 'Dependency Coupling',
            title: category,
            description: `${config.description} (found ${matches.length} instances)`,
            evidence: `Found ${matches.length} patterns`,
            impact: 'High coupling makes code hard to test, maintain, and refactor',
            remediation: this.getRemediationForCoupling(category),
          });
          break; // Only report once per category per file
        }
      }
    }

    // 5. Performance Issues
    for (const [category, config] of Object.entries(this.performancePatterns)) {
      for (const pattern of config.patterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            file: filePath,
            line: lineNum,
            severity: this.getSeverityForCategory('performance'),
            category: 'Performance',
            title: category,
            description: config.description,
            evidence: lines[lineNum - 1]?.substring(0, 100),
            impact: 'May cause performance degradation with large data or high load',
            remediation: this.getRemediationForPerformance(category),
          });
        }
      }
    }

    // 6. Unresolved Issues
    for (const [category, config] of Object.entries(this.unresolvedPatterns)) {
      for (const pattern of config.patterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            file: filePath,
            line: lineNum,
            severity: 'medium',
            category: 'Unresolved',
            title: category,
            description: config.description,
            evidence: lines[lineNum - 1]?.substring(0, 100),
            impact: 'Indicates known issues that should be addressed',
            remediation: 'Address the underlying issue or create tracking tickets',
          });
        }
      }
    }

    return issues.slice(0, 20); // Limit per file
  }

  private getSeverityForCategory(type: string): BugIssue['severity'] {
    const severityMap: Record<string, BugIssue['severity']> = {
      'runtime': 'critical',
      'race': 'critical',
      'memory': 'high',
      'coupling': 'medium',
      'performance': 'high',
    };
    return severityMap[type] || 'medium';
  }

  private getRemediationForRuntime(category: string): string {
    const remediations: Record<string, string> = {
      'Unhandled Promise Rejection': 'Always add .catch() or wrap in try-catch with await',
      'Null/Undefined Dereference': 'Add null checks: if (x && x.prop) or use optional chaining x?.prop',
      'Uninitialized Variables': 'Initialize variables when declaring or add proper checks',
      'Type Coercion Issues': 'Use strict equality (=== and !==) instead of loose equality',
    };
    return remediations[category] || 'Follow best practices for error handling';
  }

  private getRemediationForRace(category: string): string {
    const remediations: Record<string, string> = {
      'Unsynchronized Shared State': 'Use mutex, locks, or atomic operations for shared state',
      'Missing Async/Await': 'Stick to one pattern: either async/await OR Promises, not both',
      'Concurrent Modification': 'Avoid modifying collections during iteration, use copy or iterate backwards',
    };
    return remediations[category] || 'Use proper synchronization mechanisms';
  }

  private getRemediationForMemory(category: string): string {
    const remediations: Record<string, string> = {
      'Event Listener Leaks': 'Always remove event listeners in cleanup functions or useEffect return',
      'Uncleared Intervals/Timers': 'Store interval ID and clear on cleanup/component unmount',
      'Large Object References': 'Implement cache size limits, use WeakMap for object-keyed caches',
      'Closure Memory Leaks': 'Avoid deep closures capturing large scopes, use named functions',
    };
    return remediations[category] || 'Implement proper cleanup and avoid unnecessary references';
  }

  private getRemediationForCoupling(category: string): string {
    const remediations: Record<string, string> = {
      'Circular Dependencies': 'Refactor to break cycles, use dependency injection or interfaces',
      'Tight Coupling': 'Use dependency injection, reduce direct instantiation, apply SOLID principles',
      'God Object/Module': 'Split into smaller modules, each with single responsibility',
    };
    return remediations[category] || 'Reduce coupling through better architecture';
  }

  private getRemediationForPerformance(category: string): string {
    const remediations: Record<string, string> = {
      'Inefficient Loops': 'Cache .length in variable before loop, or use for-of with entries',
      'Synchronous Large File Operations': 'Use async file operations, stream large files, avoid blocking event loop',
      'Memory-Heavy Operations': 'Stream JSON parsing, avoid chaining array ops, process in chunks',
      'Unbounded Recursion': 'Add recursion depth limits, use iteration for large datasets',
    };
    return remediations[category] || 'Optimize for performance with large data';
  }

  calculateBugScore(issues: BugIssue[], filesScanned: number): number {
    if (filesScanned === 0) return 0;
    
    let score = 100;
    const issuesPerFile = issues.length / filesScanned;
    
    // Deduct based on severity and density
    score -= Math.min(issues.filter(i => i.severity === 'critical').length * 15, 40);
    score -= Math.min(issues.filter(i => i.severity === 'high').length * 8, 25);
    score -= Math.min(issues.filter(i => i.severity === 'medium').length * 4, 20);
    score -= Math.min(issues.filter(i => i.severity === 'low').length * 2, 10);
    score -= Math.min(Math.floor(issuesPerFile) * 5, 15); // Penalty for bug density
    
    return Math.max(score, 0);
  }

  getRiskLevel(score: number): BugReport['summary']['riskLevel'] {
    if (score >= 90) return 'Low';
    if (score >= 70) return 'Medium';
    if (score >= 50) return 'High';
    return 'Critical';
  }
}

// Main bug catching function
export async function catchBugs(dirPath: string, filePatterns?: string[]): Promise<BugReport> {
  const detector = new BugDetector();
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  const { glob } = await import('glob');

  const report: BugReport = {
    summary: {
      filesScanned: 0,
      totalIssues: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      bugScore: 0,
      riskLevel: 'Critical',
    },
    categories: [],
    recommendations: [],
  };

  // Find source files
  const patterns = filePatterns?.length
    ? filePatterns
    : ['**/*.{js,ts,jsx,tsx,py,go,rs,php,java,rb,cs,cpp,c,swift,dart}'];

  const files = await glob(patterns, {
    cwd: dirPath,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/vendor/**',
      '**/*.test.*',
      '**/*.spec.*',
      // Exclude self to avoid false positives
      '**/src/bug-catcher.ts',
      '**/src/security-audit.ts',
      '**/src/best-practices.ts',
      '**/src/index.ts',
      '**/build/**',
    ],
  });

  const allIssues: BugIssue[] = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isFile() || stat.size > 500000) continue; // Skip >500KB

      const content = await fs.readFile(fullPath, 'utf-8');
      const issues = detector.detectBugs(content, file);
      allIssues.push(...issues);
    } catch (e) {
      // Skip unreadable files
    }
  }

  // Build report
  report.summary.filesScanned = files.length;
  report.summary.totalIssues = allIssues.length;
  report.summary.critical = allIssues.filter(i => i.severity === 'critical').length;
  report.summary.high = allIssues.filter(i => i.severity === 'high').length;
  report.summary.medium = allIssues.filter(i => i.severity === 'medium').length;
  report.summary.low = allIssues.filter(i => i.severity === 'low').length;
  report.summary.bugScore = detector.calculateBugScore(allIssues, files.length);
  report.summary.riskLevel = detector.getRiskLevel(report.summary.bugScore);

  // Group by category
  const categoryNames = ['Runtime Error', 'Race Condition', 'Memory Leak', 'Dependency Coupling', 'Performance', 'Unresolved'];
  for (const cat of categoryNames) {
    const catIssues = allIssues.filter(i => i.category === cat);
    report.categories.push({
      category: cat.toLowerCase().replace(' ', '_'),
      title: cat,
      issues: catIssues,
      status: catIssues.length === 0 ? 'pass' : (catIssues.some(i => i.severity === 'critical') ? 'fail' : 'warning'),
    });
  }

  // Recommendations
  if (report.summary.critical > 0) {
    report.recommendations.push(`🚨 URGENT: Fix ${report.summary.critical} critical bugs immediately - they may cause runtime crashes!`);
  }
  if (report.summary.high > 0) {
    report.recommendations.push(`⚠️ Address ${report.summary.high} high severity issues to prevent potential bugs.`);
  }
  if (allIssues.some(i => i.category === 'Race Condition')) {
    report.recommendations.push('Use proper synchronization (mutex, atomics) for shared state in concurrent code.');
  }
  if (allIssues.some(i => i.category === 'Memory Leak')) {
    report.recommendations.push('Implement proper cleanup: remove listeners, clear intervals, nullify references.');
  }
  if (allIssues.some(i => i.category === 'Performance')) {
    report.recommendations.push('Optimize for large data: use streaming, async operations, process in chunks.');
  }
  if (allIssues.some(i => i.category === 'Dependency Coupling')) {
    report.recommendations.push('Reduce coupling: apply dependency injection, SOLID principles, break god objects.');
  }
  if (report.summary.bugScore < 70) {
    report.recommendations.push('Consider using static analysis tools: ESLint, SonarQube, or language-specific linters.');
  }

  return report;
}
