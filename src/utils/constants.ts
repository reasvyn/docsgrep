import { loadConfig } from "./config.js";
import { SupportedLanguage } from "./supported-language.js";

const appConfig = loadConfig<any>("app");

export const MAX_RETRY_ATTEMPTS = appConfig.limits.maxRetryAttempts;
export const MAX_FILE_SIZE_READ = appConfig.limits.maxFileSizeRead;
export const GIT_TIMEOUT_MS = appConfig.limits.gitTimeoutMs;
export const MAX_CACHE_SIZE_MB = appConfig.limits.maxCacheSizeMb;
export const MAX_SCAN_FILES = appConfig.limits.maxScanFiles;
export const MAX_CONTEXT_LINES = appConfig.limits.maxContextLines;
export const SEARCH_TOP_K = appConfig.limits.searchTopK;
export const STALE_MAX_AGE_DAYS = appConfig.limits.staleMaxAgeDays;
export const CACHE_MAX_AGE_DAYS = appConfig.limits.cacheMaxAgeDays;
export const SIMILARITY_THRESHOLD = appConfig.limits.similarityThreshold;
export const MIN_SIMILARITY_ARCHETYPE = appConfig.limits.minSimilarityArchetype;
export const IGNORE_MARKERS = appConfig.ignoreMarkers;

export const DEFAULT_IGNORE_PATTERNS = [
  ...appConfig.globalIgnorePatterns,
  ...SupportedLanguage.all().flatMap(l => l.ignoreFiles.map(f => `**/${f}`)),
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/composer.lock",
  "**/Cargo.lock",
  "**/Gemfile.lock",
  "**/mix.lock",
];
