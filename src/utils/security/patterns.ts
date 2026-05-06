/**
 * Security patterns and regex for auditing
 */

export const OWASP_PATTERNS: Record<string, { patterns: RegExp[]; description: string }> = {
  'A01:2021 – Broken Access Control': {
    patterns: [
      /(?:DELETE|PUT|PATCH)\s+.*\/.*\/\d+/g,
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
      /(?:query|exec|execute)\s*\(\s*[`'"][^`'"]*\+[^`'"]/gi,
      /eval\s*\(/g,
      /(?:innerHTML|outerHTML)\s*=/g,
      /(?:exec|spawn|system)\s*\(/g,
    ],
    description: 'SQL, NoSQL, OS command, and LDAP injection flaws'
  },
  'A04:2021 – Insecure Design': {
    patterns: [
      /(?<!test)\/api\/.*\/delete/gi,
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

export const SECRET_PATTERNS = [
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

export const PII_PATTERNS = [
  { name: 'Email Address', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'Phone Number', pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g },
  { name: 'Credit Card', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  { name: 'SSN (US)', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'IP Address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
];
