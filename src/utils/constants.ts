/**
 * Constants used throughout the application
 */
export const MAX_RETRY_ATTEMPTS = 3;
export const MAX_FILE_SIZE_TECH = 50000;
export const MAX_FILE_SIZE_CONVENTIONS = 100000;
export const MAX_FILE_SIZE_SAMPLE = 20000;
export const MAX_FILE_SIZE_READ = 500000; // 500KB for read_doc_file
export const GIT_TIMEOUT_MS = 60000;
export const MAX_CACHE_SIZE_MB = 1000; // 1GB max cache size

/**
 * Standard ignore patterns for documentation and code analysis
 * Filters out common OSS noise: build artifacts, lockfiles, and machine-generated files.
 */
export const DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/vendor/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/target/**", // Rust/Java
  "**/bin/**",
  "**/obj/**",
  "**/coverage/**",
  "**/.nyc_output/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.cache/**",
  "**/.temp/**",
  "**/tmp/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/composer.lock",
  "**/Cargo.lock",
  "**/Gemfile.lock",
  "**/mix.lock",
  "**/*.map",
  "**/*.log",
  "**/*.sqlite",
  "**/*.pyc",
  "**/__pycache__/**",
];

/**
 * Patterns for sensitive files that should be scanned carefully
 */
export const SENSITIVE_FILES_PATTERNS = [
  "**/*.{env,example,sample,conf,ini,cfg,yaml,yml,json,xml}",
  "**/Dockerfile*",
  "**/*.{sh,bash}",
];
