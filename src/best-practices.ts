// Best practices database for various tech stacks
// This provides industry-standard guidelines for code quality audits

export interface BestPractice {
  category: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  check: (code: string, filePath: string) => AuditFinding[];
}

export interface AuditFinding {
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  suggestion?: string;
}

// Generic best practices for all codebases
const GENERIC_PRACTICES: BestPractice[] = [
  {
    category: 'Code Structure',
    title: 'Avoid God Classes/Functions',
    description: 'Classes or functions should have a single responsibility and not exceed reasonable size limits.',
    severity: 'high',
    check: (code, filePath) => {
      const findings: AuditFinding[] = [];
      const lines = code.split('\n');
      
      // Check function length (>100 lines)
      const funcMatches = code.matchAll(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:function|\([^)]*\)\s*=>))/g);
      let funcStart = 0;
      for (const match of funcMatches) {
        funcStart = code.substring(0, match.index).split('\n').length;
      }
      
      // Simple heuristic: file over 500 lines might have god objects
      if (lines.length > 500) {
        findings.push({
          file: filePath,
          severity: 'medium',
          category: 'Code Structure',
          title: 'Potential God File',
          description: `File has ${lines.length} lines, which may indicate it's doing too much.`,
          suggestion: 'Consider splitting into smaller, focused modules.'
        });
      }
      
      return findings;
    }
  },
  {
    category: 'Dead Code',
    title: 'Detect Unused Imports',
    description: 'Imports that are declared but never used should be removed.',
    severity: 'medium',
    check: (code, filePath) => {
      const findings: AuditFinding[] = [];
      const lines = code.split('\n');
      
      // Simple unused import detection for JS/TS
      const importMatches = code.matchAll(/import\s+(?:{[^}]+}\s+from\s+)?['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importPath = match[1];
        const importName = match[0].match(/{\s*([^}]+)\s*}/)?.[1] || match[0].match(/import\s+(\w+)/)?.[1];
        
        if (importName && importName !== '*') {
          const usageRegex = new RegExp(`\\b${importName.replace(/[{}*,\s]/g, '')}\\b`, 'g');
          const usages = code.match(usageRegex);
          if (!usages || usages.length <= 1) {
            const lineNum = code.substring(0, match.index).split('\n').length;
            findings.push({
              file: filePath,
              line: lineNum,
              severity: 'medium',
              category: 'Dead Code',
              title: 'Potentially Unused Import',
              description: `Import '${importName}' appears to be unused.`,
              suggestion: 'Remove unused imports to keep code clean.'
            });
          }
        }
      }
      
      return findings;
    }
  },
  {
    category: 'Code Quality',
    title: 'Magic Numbers',
    description: 'Avoid using magic numbers; use named constants instead.',
    severity: 'low',
    check: (code, filePath) => {
      const findings: AuditFinding[] = [];
      
      // Detect magic numbers (excluding common ones like 0, 1, -1, 2 in loops)
      const magicNumberRegex = /(?<!=)\s*(-?\d{2,}(?:\.\d+)?)\b/g;
      let match;
      
      while ((match = magicNumberRegex.exec(code)) !== null) {
        const lineNum = code.substring(0, match.index).split('\n').length;
        findings.push({
          file: filePath,
          line: lineNum,
          severity: 'low',
          category: 'Code Quality',
          title: 'Magic Number',
          description: `Found magic number ${match[1]}. Consider using a named constant.`,
          suggestion: 'Define constants for meaningful numbers.'
        });
      }
      
      return findings.slice(0, 5); // Limit to 5 to avoid noise
    }
  }
];

// Next.js specific best practices
const NEXTJS_PRACTICES: BestPractice[] = [
  {
    category: 'Next.js App Router',
    title: 'Use Server Components by Default',
    description: 'Components should be Server Components by default unless they need client interactivity.',
    severity: 'high',
    check: (code, filePath) => {
      const findings: AuditFinding[] = [];
      
      if (filePath.includes('/app/') && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'))) {
        if (!code.includes("'use client'") && !code.includes('"use client"')) {
          // This is fine - it's a server component by default
        } else if (code.includes("'use client'") || code.includes('"use client"')) {
          // Check if client directive is necessary
          const hasInteractiveElements = /\bonClick|\bonChange|useState|useEffect|useRef/.test(code);
          if (!hasInteractiveElements) {
            const lineNum = code.match(/'use client'|"use client"/)?.index;
            const line = lineNum ? code.substring(0, lineNum).split('\n').length : undefined;
            findings.push({
              file: filePath,
              line,
              severity: 'medium',
              category: 'Next.js App Router',
              title: 'Unnecessary Client Directive',
              description: 'File uses "use client" directive but has no interactive elements.',
              suggestion: 'Remove "use client" to make it a Server Component for better performance.'
            });
          }
        }
      }
      
      return findings;
    }
  },
  {
    category: 'Next.js Data Fetching',
    title: 'Proper Data Fetching Patterns',
    description: 'Use appropriate data fetching methods: Server Components fetch directly, Client Components use SWR/React Query.',
    severity: 'high',
    check: (code, filePath) => {
      const findings: AuditFinding[] = [];
      
      if (code.includes('useEffect') && code.includes('fetch(')) {
        const lineNum = code.indexOf('useEffect');
        findings.push({
          file: filePath,
          line: lineNum ? code.substring(0, lineNum).split('\n').length : undefined,
          severity: 'high',
          category: 'Next.js Data Fetching',
          title: 'Fetch in useEffect Anti-pattern',
          description: 'Fetching data in useEffect is not recommended in Next.js.',
          suggestion: 'Use Server Components for data fetching, or SWR/React Query for client-side.'
        });
      }
      
      return findings;
    }
  }
];

// React specific practices
const REACT_PRACTICES: BestPractice[] = [
  {
    category: 'React Performance',
    title: 'Avoid Anonymous Functions in JSX',
    description: 'Creating functions in JSX props causes unnecessary re-renders.',
    severity: 'medium',
    check: (code, filePath) => {
      const findings: AuditFinding[] = [];
      
      const anonymousFuncRegex = /<[^>]+\s(?:onClick|onChange|onSubmit)={\s*\(\)\s*=>/g;
      let match;
      
      while ((match = anonymousFuncRegex.exec(code)) !== null) {
        const lineNum = code.substring(0, match.index).split('\n').length;
        findings.push({
          file: filePath,
          line: lineNum,
          severity: 'medium',
          category: 'React Performance',
          title: 'Anonymous Function in JSX',
          description: 'Anonymous arrow function in JSX prop creates new function on each render.',
          suggestion: 'Extract the handler or use useCallback.'
        });
      }
      
      return findings.slice(0, 3);
    }
  },
  {
    category: 'React Structure',
    title: 'Component Naming',
    description: 'Components should be in PascalCase and files should match component name.',
    severity: 'low',
    check: (code, filePath) => {
      const findings: AuditFinding[] = [];
      
      const componentMatch = code.match(/export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w+)/);
      if (componentMatch) {
        const componentName = componentMatch[1];
        const fileName = filePath.split('/').pop()?.replace(/\.(tsx|jsx|ts|js)$/, '');
        
        if (fileName && componentName && !fileName.includes(componentName) && fileName !== 'index') {
          findings.push({
            file: filePath,
            severity: 'low',
            category: 'React Structure',
            title: 'Component/File Name Mismatch',
            description: `Component '${componentName}' is in file '${fileName}'.`,
            suggestion: 'Rename file to match component name or vice versa.'
          });
        }
      }
      
      return findings;
    }
  }
];

// Python specific practices
const PYTHON_PRACTICES: BestPractice[] = [
  {
    category: 'Python Style',
    title: 'Follow PEP 8 Naming Conventions',
    description: 'Use snake_case for functions and variables, PascalCase for classes.',
    severity: 'medium',
    check: (code, filePath) => {
      const findings: AuditFinding[] = [];
      const lines = code.split('\n');
      
      lines.forEach((line, idx) => {
        // Check function naming (should be snake_case)
        const funcMatch = line.match(/^def\s+([^(]+)/);
        if (funcMatch && !/^[a-z_][a-z0-9_]*$/.test(funcMatch[1].trim())) {
          findings.push({
            file: filePath,
            line: idx + 1,
            severity: 'medium',
            category: 'Python Style',
            title: 'Function Naming Convention',
            description: `Function '${funcMatch[1].trim()}' should use snake_case.`,
            suggestion: 'Rename to follow PEP 8 snake_case convention.'
          });
        }
        
        // Check class naming (should be PascalCase)
        const classMatch = line.match(/^class\s+(\w+)/);
        if (classMatch && /[a-z]/.test(classMatch[1]) && !/^[A-Z]/.test(classMatch[1])) {
          findings.push({
            file: filePath,
            line: idx + 1,
            severity: 'medium',
            category: 'Python Style',
            title: 'Class Naming Convention',
            description: `Class '${classMatch[1]}' should use PascalCase.`,
            suggestion: 'Rename to follow PEP 8 PascalCase convention.'
          });
        }
      });
      
      return findings.slice(0, 5);
    }
  }
];

// Get best practices based on tech stack
export function getBestPracticesForTechStack(techStack: Record<string, string>): BestPractice[] {
  const practices: BestPractice[] = [...GENERIC_PRACTICES];
  
  const fileContents = JSON.stringify(techStack).toLowerCase();
  
  if (fileContents.includes('next') || fileContents.includes('next.js')) {
    practices.push(...NEXTJS_PRACTICES);
  }
  
  if (fileContents.includes('react')) {
    practices.push(...REACT_PRACTICES);
  }
  
  if (fileContents.includes('python') || fileContents.includes('requirements.txt') || fileContents.includes('pyproject')) {
    practices.push(...PYTHON_PRACTICES);
  }
  
  return practices;
}

// Run all applicable best practices checks
export function runAudit(code: string, filePath: string, practices: BestPractice[]): AuditFinding[] {
  const allFindings: AuditFinding[] = [];
  
  for (const practice of practices) {
    try {
      const findings = practice.check(code, filePath);
      allFindings.push(...findings);
    } catch (e) {
      // Skip practices that fail to check
    }
  }
  
  return allFindings;
}

// Export practices database for external use
export const PRACTICES_DB = {
  generic: GENERIC_PRACTICES,
  nextjs: NEXTJS_PRACTICES,
  react: REACT_PRACTICES,
  python: PYTHON_PRACTICES,
};
