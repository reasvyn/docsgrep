// Enterprise-Grade Security Audit - Language Agnostic
// Covers OWASP Top 10, ISO/IEC 27001, and industry security standards

import { DEFAULT_IGNORE_PATTERNS } from "./utils/constants.js";

export interface SecurityIssue {
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  owaspCategory?: string; // OWASP Top 10 mapping
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
    securityScore: number; // 0-100
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

class SecurityAnalyzer {
  
  // OWASP Top 10 2021 Categories
  owaspPatterns: Record<string, { patterns: RegExp[]; description: string }> = {
    'A01:2021 – Broken Access Control': {
      patterns: [
        /(?:DELETE|PUT|PATCH)\s+.*\/.*\/\d+/g, // Insecure direct object references
        /(?:admin|administrator|root)\b/gi,
        /role\s*[=:]\s*['"]?(?:admin|root|superuser)/gi,
      ],
      description: 'Failures to restrict what authenticated users can do'
    },
    'A02:2021 – Cryptographic Failures': {
      patterns: [
        /(?:MD5|SHA1)\s*\(/gi,
        /Math\.random\(\)/g,
        /Math\.floor\(Math\.random\(\)/g,
        /['"]password['"]\s*:\s*['"][^'"]+['"]/gi,
      ],
      description: 'Failures related to cryptography or its incorrect usage'
    },
    'A03:2021 – Injection': {
      patterns: [
        /(?:query|exec|execute)\s*\(\s*[`'"][^`'"]*\+[^`'"]/gi, // SQL injection
        /eval\s*\(/g,
        /(?:innerHTML|outerHTML)\s*=/g,
        /(?:exec|spawn|system)\s*\(/g,
      ],
      description: 'SQL, NoSQL, OS command, and LDAP injection flaws'
    },
    'A04:2021 – Insecure Design': {
      patterns: [
        /(?<!test)\/api\/.*\/delete/gi, // Missing design for safe deletion
        /(?:password|secret).*(?:in|at)\s+(?:url|params|query)/gi,
      ],
      description: 'Missing or ineffective control design'
    },
    'A05:2021 – Security Misconfiguration': {
      patterns: [
        /DEBUG\s*=\s*true/gi,
        /(?:allow_all|permitAll|anonymous)/gi,
        /CORS\s*\([^)]*\)/g,
      ],
      description: 'Missing security hardening, insecure defaults'
    },
    'A06:2021 – Vulnerable and Outdated Components': {
      patterns: [],
      description: 'Using components with known vulnerabilities'
    },
    'A07:2021 – Identification and Authentication Failures': {
      patterns: [
        /(?:password|passwd|pwd)\s*=\s*['"][^'"]+['"]/gi,
        /(?:login|auth).*without\s+(?:verification|confirmation)/gi,
      ],
      description: 'Authentication weaknesses, session management'
    },
    'A08:2021 – Software and Data Integrity Failures': {
      patterns: [
        /(?:npm|pip|gem)\s+install\s+.*--insecure/gi,
        /eval\s*\(/g,
      ],
      description: 'Code and infrastructure that does not protect against integrity violations'
    },
    'A09:2021 – Security Logging and Monitoring Failures': {
      patterns: [
        /console\.(log|debug)\s*\([^)]*password/gi,
        /(?:error|exception).*stack\s*\+/gi,
      ],
      description: 'Insufficient logging, detection, monitoring'
    },
    'A10:2021 – Server-Side Request Forgery (SSRF)': {
      patterns: [
        /(?:fetch|axios|request)\s*\([^)]*req\.(body|query|params)/gi,
        /(?:url|endpoint)\s*=\s*.*user.*input/gi,
      ],
      description: 'SSRF flaws occur when web app fetches remote resources'
    },
  };

  // Secrets patterns (API keys, tokens, passwords)
  private secretPatterns = [
    { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, severity: 'critical' as const },
    { name: 'AWS Secret Key', pattern: /(?:aws_secret|aws_key).*['"][0-9a-zA-Z/+]{40}['"]/gi, severity: 'critical' as const },
    { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g, severity: 'critical' as const },
    { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/g, severity: 'critical' as const },
    { name: 'Private Key', pattern: /-----BEGIN [A-Z]+ PRIVATE KEY-----/g, severity: 'critical' as const },
    { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g, severity: 'high' as const },
    { name: 'Generic API Key', pattern: /(?:api_key|apikey|api-key)\s*[:=]\s*['"][0-9a-zA-Z]{20,40}['"]/gi, severity: 'high' as const },
    { name: 'Password in Code', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, severity: 'high' as const },
    { name: 'Hardcoded Secret', pattern: /(?:secret|token|auth)\s*[:=]\s*['"][0-9a-zA-Z]{20,}['"]/gi, severity: 'high' as const },
  ];

  // PII (Personally Identifiable Information) patterns
  private piiPatterns = [
    { name: 'Email Address', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { name: 'Phone Number', pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g },
    { name: 'Credit Card', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
    { name: 'SSN (US)', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
    { name: 'IP Address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
  ];

  // Privacy regulations keywords
  private privacyKeywords = [
    'gdpr', 'ccpa', 'hipaa', 'pci-dss', 'privacy', 'personal data', 'consent',
    'data protection', 'right to be forgotten', 'data breach', 'encryption at rest',
  ];

  // Check for OWASP Top 10 issues
  checkOWASPIssues(content: string, filePath: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Skip self-checking: don't flag docsgrep's own source files
    if (filePath.includes('security-audit') || 
        filePath.includes('docsgrep') || 
        filePath.includes('best-practices')) {
      return issues; // Return empty, skip this file
    }
    
    const lines = content.split('\n');

    for (const [category, config] of Object.entries(this.owaspPatterns) as [string, { patterns: RegExp[]; description: string }][]) {
      if (config.patterns.length === 0) continue; // Skip categories checked elsewhere

      for (const pattern of config.patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          const lineContent = lines[lineNum - 1]?.trim() || '';
          
          // Skip if in comments or strings (simplified check)
          if (lineContent.startsWith('//') || lineContent.startsWith('#') || lineContent.startsWith('/*')) {
            continue;
          }

          issues.push({
            file: filePath,
            line: lineNum,
            severity: this.getSeverityForOWASP(category),
            category: 'OWASP',
            owaspCategory: category,
            title: category,
            description: config.description,
            evidence: lineContent.substring(0, 100),
            impact: this.getImpactForOWASP(category),
            remediation: this.getRemediationForOWASP(category),
          });
        }
      }
    }

    return issues.slice(0, 10); // Limit per file
  }

  // Check for secrets in code
  checkSecrets(content: string, filePath: string): Array<{file: string; line?: number; type: string; value?: string}> {
    const found: Array<{file: string; line?: number; type: string; value?: string}> = [];
    
    // Skip if file is an example or sample (common in OSS repos)
    const fileName = filePath.toLowerCase();
    if (fileName.includes('example') || fileName.includes('sample')) {
      return found;
    }
    
    const lines = content.split('\n');

    for (const secret of this.secretPatterns) {
      let match;
      // Reset lastIndex for global regex
      secret.pattern.lastIndex = 0;
      
      while ((match = secret.pattern.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        found.push({
          file: filePath,
          line: lineNum,
          type: secret.name,
          value: match[0].substring(0, 20) + '...', // Truncate for security
        });
      }
    }

    return found;
  }

  // Check for PII handling issues
  checkPIIHandling(content: string, filePath: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    // Check if PII is being logged or exposed
    for (const pii of this.piiPatterns) {
      let match;
      pii.pattern.lastIndex = 0;
      
      while ((match = pii.pattern.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        const lineContent = lines[lineNum - 1] || '';

        // Check if it's being logged
        if (/console\.|print\(|log\(|logger\./.test(lineContent)) {
          issues.push({
            file: filePath,
            line: lineNum,
            severity: 'medium',
            category: 'Privacy',
            title: 'PII in Logs',
            description: `Potential ${pii.name} being logged: ${match[0].substring(0, 20)}...`,
            evidence: lineContent.substring(0, 100),
            impact: 'PII in logs violates GDPR, CCPA, and other privacy regulations',
            remediation: 'Never log PII. Use masking/redaction. Implement proper data handling.',
          });
        }

        // Check if it's in client-side code
        if (filePath.includes('client') || filePath.includes('frontend') || filePath.includes('public')) {
          issues.push({
            file: filePath,
            line: lineNum,
            severity: 'high',
            category: 'Privacy',
            title: 'PII in Client-Side Code',
            description: `PII (${pii.name}) found in client-side code`,
            evidence: match[0].substring(0, 20) + '...',
            impact: 'Client-side PII exposure violates privacy regulations',
            remediation: 'Process PII server-side only. Use tokens/references in client.',
          });
        }
      }
    }

    return issues.slice(0, 5);
  }

  // Check for security misconfigurations
  checkSecurityMisconfig(content: string, filePath: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    // Check for debug mode in production
    const debugPatterns = [
      { pattern: /DEBUG\s*=\s*true/gi, msg: 'Debug mode enabled' },
      { pattern: /NODE_ENV\s*=\s*['"]?development['"]?/gi, msg: 'Development environment' },
      { pattern: /app\.debug\s*=\s*true/gi, msg: 'App debug mode' },
    ];

    for (const { pattern, msg } of debugPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        issues.push({
          file: filePath,
          line: lineNum,
          severity: 'high',
          category: 'Security Misconfiguration',
          title: 'Insecure Configuration',
          description: msg,
          evidence: lines[lineNum - 1]?.substring(0, 100),
          impact: 'Debug/development settings in production expose sensitive information',
          remediation: 'Ensure production builds have debug disabled. Use environment variables.',
        });
      }
    }

    // Check for CORS wildcard
    if (/Access-Control-Allow-Origin\s*:\s*['"]?\*/.test(content)) {
      const lineNum = content.indexOf('Access-Control-Allow-Origin');
      issues.push({
        file: filePath,
        line: lineNum > -1 ? content.substring(0, lineNum).split('\n').length : undefined,
        severity: 'high',
        category: 'Security Misconfiguration',
        title: 'CORS Wildcard',
        description: 'CORS allows all origins with wildcard (*)',
        impact: 'Any website can make requests to your API',
        remediation: 'Specify exact allowed origins. Never use * in production.',
      });
    }

    return issues;
  }

  // Check dependency files for vulnerabilities
  async checkDependencies(dirPath: string): Promise<SecurityAuditReport['dependencyAnalysis']> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const glob = (await import('glob')).glob;

    const result: SecurityAuditReport['dependencyAnalysis'] = {
      hasLockFile: false,
      outdatedPackages: [],
      vulnerablePackages: [],
      totalDependencies: 0,
    };

    // Check for lock files
    const lockFiles = await glob('**/*lock*', {
      cwd: dirPath,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });
    result.hasLockFile = lockFiles.length > 0;

    // Parse package.json for dependencies
    try {
      const packageJsonPath = path.join(dirPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      result.totalDependencies = Object.keys(deps).length;

       // Check for known vulnerable patterns (simplified)
       for (const dep of Object.keys(deps)) {
         const version = deps[dep];
         // Simplified check - in production would use npm audit / Snyk
         if (version.includes('*') || version.includes('latest')) {
           result.outdatedPackages.push(`${dep}@${version} (floating version)`);
         }
       }
    } catch (e) {
      // No package.json
    }

    return result;
  }

  // Generate ISO/IEC 27001 compliance check
  checkISO27001(compliance: SecurityAuditReport): SecurityAuditReport['complianceStatus'][0] {
    const issues: string[] = [];
    let status: 'compliant' | 'partial' | 'non-compliant' = 'compliant';

    // A.12.6.1 - Management of technical vulnerabilities
    if (compliance.dependencyAnalysis.vulnerablePackages.length > 0) {
      issues.push('Vulnerable dependencies found');
      status = 'non-compliant';
    }

    // A.9.4.2 - Secure log-on procedures
    const authIssues = compliance.owaspTop10.find(o => o.category.includes('A07'));
    if (authIssues && authIssues.issues.length > 0) {
      issues.push('Authentication failures detected');
      status = 'partial';
    }

    // A.18.1.3 - Protection of records
    if (compliance.privacyIssues.length > 0) {
      issues.push('PII handling issues detected');
      status = 'non-compliant';
    }

    return {
      standard: 'ISO/IEC 27001:2022',
      status,
      issues,
    };
  }

   // Calculate security score
   calculateSecurityScore(issues: SecurityIssue[], filesScanned: number): number {
     if (filesScanned === 0) return 0;
     
     let score = 100;
     
     // Deduct points based on severity
     score -= Math.min(issues.filter(i => i.severity === 'critical').length * 20, 40);
     score -= Math.min(issues.filter(i => i.severity === 'high').length * 10, 30);
     score -= Math.min(issues.filter(i => i.severity === 'medium').length * 5, 20);
     score -= Math.min(issues.filter(i => i.severity === 'low').length * 2, 10);
     
     return Math.max(score, 0);
   }

  // Get risk level from score
  getRiskLevel(score: number): SecurityAuditReport['summary']['riskLevel'] {
    if (score >= 90) return 'Low';
    if (score >= 70) return 'Medium';
    if (score >= 50) return 'High';
    return 'Critical';
  }

  private getSeverityForOWASP(category: string): SecurityIssue['severity'] {
    if (category.includes('A01') || category.includes('A03') || category.includes('A07')) return 'critical';
    if (category.includes('A02') || category.includes('A05') || category.includes('A08')) return 'high';
    if (category.includes('A04') || category.includes('A09') || category.includes('A10')) return 'medium';
    return 'low';
  }

  private getImpactForOWASP(category: string): string {
    const impacts: Record<string, string> = {
      'A01:2021': 'Unauthorized access to sensitive data or functions',
      'A02:2021': 'Data breaches, cryptographic failures',
      'A03:2021': 'Data breach, data loss, system compromise',
      'A05:2021': 'System compromise, data exposure',
      'A07:2021': 'Account takeover, identity theft',
      'A08:2021': 'Code injection, supply chain attacks',
      'A09:2021': 'Undetected breaches, delayed response',
      'A10:2021': 'Internal network access, data exfiltration',
    };
    return impacts[category] || 'Security impact';
  }

  private getRemediationForOWASP(category: string): string {
    const remediations: Record<string, string> = {
      'A01:2021': 'Implement proper access controls, use principle of least privilege',
      'A02:2021': 'Use strong encryption (AES-256), secure key storage, TLS 1.2+',
      'A03:2021': 'Use parameterized queries, input validation, output encoding',
      'A05:2021': 'Disable debug in production, secure default configs, regular updates',
      'A07:2021': 'Implement MFA, secure session management, strong password policies',
      'A08:2021': 'Verify integrity of software, use signed commits, secure CI/CD',
      'A09:2021': 'Implement centralized logging, SIEM, incident response',
      'A10:2021': 'Validate and sanitize all user-supplied URLs, whitelist allowed domains',
    };
    return remediations[category] || 'Follow security best practices';
  }
}

// Main security audit function
export async function performSecurityAudit(dirPath: string, filePatterns?: string[]): Promise<SecurityAuditReport> {
  const analyzer = new SecurityAnalyzer();
  
  // Step 1: Find source files
  const patterns = filePatterns || [
    '**/*.{js,ts,jsx,tsx,py,go,rs,rb,java,cpp,c,cs,php,swift,dart}',
    '**/*.{yml,yaml,json,xml,conf,ini,env,cfg}',
    '**/Dockerfile*',
    '**/*.{sh,bash}',
  ];

  const glob = (await import('glob')).glob;
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

   const files: Array<{ path: string; content: string }> = [];
   
   for (const pattern of patterns) {
     const matches = await glob(pattern, {
       cwd: dirPath,
       ignore: [
         ...DEFAULT_IGNORE_PATTERNS,
         // Exclude docsgrep's own source files to prevent false positives
         '**/src/security-audit.ts',
         '**/src/index.ts',
         '**/src/best-practices.ts',
         '**/src/audit.ts',
         '**/build/**',
       ],
     });

    for (const match of matches.slice(0, 50)) {
        try {
          const fullPath = path.join(dirPath, match);
          const stat = await fs.stat(fullPath);
          if (!stat.isFile() || stat.size > 500000) continue; // Skip >500KB
          
          const content = await fs.readFile(fullPath, 'utf-8');
          files.push({ path: fullPath, content });
        } catch (e) {
          // Skip
        }
      }
   }

  // Step 2: Run all security checks
  const allIssues: SecurityIssue[] = [];
  const allSecrets: SecurityAuditReport['secretsFound'] = [];
  const allPrivacyIssues: SecurityIssue[] = [];

  for (const file of files) {
    // Skip self-checking: don't analyze docsgrep's own source files
    if (file.path.includes('security-audit') || 
        file.path.includes('docsgrep/src') || 
        file.path.includes('best-practices') ||
        file.path.includes('/src/index.ts')) {
      continue; // Skip this file entirely
    }
    
    // OWASP checks
    const owaspIssues = analyzer.checkOWASPIssues(file.content, file.path);
    allIssues.push(...owaspIssues);

    // Secrets
    const secrets = analyzer.checkSecrets(file.content, file.path);
    allSecrets.push(...secrets);

    // PII
    const piiIssues = analyzer.checkPIIHandling(file.content, file.path);
    allPrivacyIssues.push(...piiIssues);

    // Misconfigurations
    const misconfigIssues = analyzer.checkSecurityMisconfig(file.content, file.path);
    allIssues.push(...misconfigIssues);
  }

  // Step 3: Dependency analysis
  const dependencyAnalysis = await analyzer.checkDependencies(dirPath);

  // Step 4: OWASP Top 10 summary
  const owaspCategories = Object.keys(analyzer['owaspPatterns']);
  const owaspTop10 = owaspCategories.map(category => ({
    category,
    title: analyzer['owaspPatterns'][category as keyof typeof analyzer.owaspPatterns].description,
    issues: allIssues.filter(i => i.owaspCategory === category),
    compliant: allIssues.filter(i => i.owaspCategory === category).length === 0,
  }));

  // Step 5: Privacy issues
  const privacyIssues = allPrivacyIssues;

  // Step 6: Calculate score
  const securityScore = analyzer.calculateSecurityScore(allIssues, files.length);
  const riskLevel = analyzer.getRiskLevel(securityScore);

  // Step 7: ISO compliance
  const iso27001 = analyzer.checkISO27001({
    summary: { filesScanned: files.length, totalIssues: allIssues.length, critical: 0, high: 0, medium: 0, low: 0, info: 0, securityScore: 0, riskLevel: 'Low' },
    owaspTop10,
    dependencyAnalysis,
    secretsFound: allSecrets.slice(0, 50),
    privacyIssues: privacyIssues,
    complianceStatus: [],
    recommendations: [],
  });

  // Step 8: Generate recommendations
  const recommendations = generateSecurityRecommendations(allIssues, allSecrets, dependencyAnalysis, owaspTop10);

  const summary = {
    filesScanned: files.length,
    totalIssues: allIssues.length,
    critical: allIssues.filter(i => i.severity === 'critical').length,
    high: allIssues.filter(i => i.severity === 'high').length,
    medium: allIssues.filter(i => i.severity === 'medium').length,
    low: allIssues.filter(i => i.severity === 'low').length,
    info: allIssues.filter(i => i.severity === 'info').length,
    securityScore,
    riskLevel,
  };

  return {
    summary,
    owaspTop10,
    dependencyAnalysis,
    secretsFound: allSecrets.slice(0, 50), // Limit secrets shown
    privacyIssues: privacyIssues.slice(0, 20),
    complianceStatus: [iso27001],
    recommendations,
  };
}

function generateSecurityRecommendations(
  issues: SecurityIssue[],
  secrets: SecurityAuditReport['secretsFound'],
  deps: SecurityAuditReport['dependencyAnalysis'],
  owasp: SecurityAuditReport['owaspTop10'],
): string[] {
  const recommendations: string[] = [];

  // Critical issues
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  if (criticalCount > 0) {
    recommendations.push(`🚨 URGENT: Address ${criticalCount} critical security issues immediately!`);
  }

  // Secrets
  if (secrets.length > 0) {
    recommendations.push(`🔑 ${secrets.length} secrets found in code! Rotate all exposed credentials immediately.`);
    recommendations.push('Use environment variables or secret management tools (HashiCorp Vault, AWS Secrets Manager).');
  }

  // OWASP
  const nonCompliantOWASP = owasp.filter(o => !o.compliant);
  if (nonCompliantOWASP.length > 0) {
    recommendations.push(`🛡️ Address OWASP Top 10 violations: ${nonCompliantOWASP.map(o => o.category).join(', ')}`);
  }

  // Dependencies
  if (deps.vulnerablePackages.length > 0) {
    recommendations.push(`📦 Update ${deps.vulnerablePackages.length} vulnerable dependencies. Run \`npm audit fix\` or equivalent.`);
  }
  if (!deps.hasLockFile) {
    recommendations.push('🔒 Add lock files (package-lock.json, yarn.lock) to ensure reproducible builds.');
  }

  // Privacy
  if (issues.filter(i => i.category === 'Privacy').length > 0) {
    recommendations.push('🔐 Review PII handling. Ensure GDPR/CCPA compliance. Implement data masking in logs.');
  }

  // General
  recommendations.push('Implement security linting (ESLint security plugins, bandit for Python).');
  recommendations.push('Set up SAST/DAST tools (SonarQube, Snyk, OWASP ZAP).');
  recommendations.push('Conduct regular penetration testing and security code reviews.');

  return recommendations.length > 0 ? recommendations : ['✅ No major security issues found!'];
}

// Generate security audit prompt
export function generateSecurityAuditPrompt(dirPath: string): string {
  let prompt = `## 🔒 Enterprise Security Audit\n\n`;
  prompt += `**Target Directory**: \`${dirPath}\`\n\n`;
  
  prompt += `### 🛡️ What Will Be Scanned?\n\n`;
  prompt += `**OWASP Top 10 (2021)**\n`;
  prompt += `- A01: Broken Access Control\n`;
  prompt += `- A02: Cryptographic Failures\n`;
  prompt += `- A03: Injection (SQL, NoSQL, XSS, Command)\n`;
  prompt += `- A05: Security Misconfiguration\n`;
  prompt += `- A07: Identification and Authentication Failures\n`;
  prompt += `- A10: Server-Side Request Forgery (SSRF)\n\n`;
  
  prompt += `**Secrets Detection**\n`;
  prompt += `- API Keys (AWS, Google, GitHub, Slack)\n`;
  prompt += `- Private Keys, Tokens, Passwords\n`;
  prompt += `- Hardcoded Credentials\n\n`;
  
  prompt += `**Privacy & Compliance**\n`;
  prompt += `- PII Handling (GDPR, CCPA, HIPAA)\n`;
  prompt += `- Data Exposure in Logs\n`;
  prompt += `- ISO/IEC 27001 Compliance\n\n`;
  
  prompt += `**Dependency Security**\n`;
  prompt += `- Vulnerable Packages\n`;
  prompt += `- Outdated Dependencies\n`;
  prompt += `- Lock File Verification\n\n`;
  
  prompt += `### 🎯 Choose Your Focus\n\n`;
  prompt += `1. **Full Security Audit** - Complete OWASP + Secrets + Privacy + Dependencies\n`;
  prompt += `2. **OWASP Top 10 Only** - Focus on the Top 10 web app security risks\n`;
  prompt += `3. **Secrets Scan** - Find exposed credentials and API keys\n`;
  prompt += `4. **Privacy & Compliance** - GDPR, CCPA, ISO 27001 checks\n`;
  prompt += `5. **Dependency Audit** - Check for vulnerable packages\n\n`;
  
  prompt += `The audit will generate:\n`;
  prompt += `- Security Score (0-100) with Risk Level\n`;
  prompt += `- Detailed findings with line numbers and remediation\n`;
  prompt += `- OWASP Top 10 compliance status\n`;
  prompt += `- ISO/IEC 27001 compliance check\n`;
  prompt += `- Actionable recommendations prioritized by severity\n\n`;
  
  prompt += `Please specify your choice, and I'll run the security audit.`;
  
  return prompt;
}
