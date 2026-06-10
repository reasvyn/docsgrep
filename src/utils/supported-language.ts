import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "src", "config"
);

export interface LanguageConfig {
  name: string;
  alias: string;
  extensions: string[];
  configFiles: string[];
  commentStyle: {
    single: string | null;
    multiStart: string | null;
    multiEnd: string | null;
    hashBang: boolean;
  };
  docStyle: {
    single: string | null;
    multiStart: string | null;
    multiEnd: string | null;
  };
  packageManager: string;
  ecosystem: string;
  ignoreFiles: string[];
  debugPatterns: string[];
}

const cache = new Map<string, LanguageConfig>();

function loadConfig(alias: string): LanguageConfig {
  if (cache.has(alias)) return cache.get(alias)!;
  const filePath = path.join(CONFIG_DIR, `${alias}.json`);
  if (!existsSync(filePath)) throw new Error(`Language config not found: ${alias}`);
  const raw = readFileSync(filePath, "utf-8");
  const config: LanguageConfig = JSON.parse(raw);
  cache.set(alias, config);
  return config;
}

export class SupportedLanguage {
  private constructor(private config: LanguageConfig) {}

  static js(): SupportedLanguage { return new SupportedLanguage(loadConfig("js")); }
  static py(): SupportedLanguage { return new SupportedLanguage(loadConfig("py")); }
  static java(): SupportedLanguage { return new SupportedLanguage(loadConfig("java")); }
  static go(): SupportedLanguage { return new SupportedLanguage(loadConfig("go")); }
  static rs(): SupportedLanguage { return new SupportedLanguage(loadConfig("rs")); }
  static cs(): SupportedLanguage { return new SupportedLanguage(loadConfig("cs")); }
  static php(): SupportedLanguage { return new SupportedLanguage(loadConfig("php")); }
  static rb(): SupportedLanguage { return new SupportedLanguage(loadConfig("rb")); }
  static cpp(): SupportedLanguage { return new SupportedLanguage(loadConfig("cpp")); }
  static swift(): SupportedLanguage { return new SupportedLanguage(loadConfig("swift")); }

  static all(): SupportedLanguage[] {
    return [
      this.js(), this.py(), this.java(), this.go(), this.rs(),
      this.cs(), this.php(), this.rb(), this.cpp(), this.swift(),
    ];
  }

  static fromExtension(ext: string): SupportedLanguage | null {
    for (const lang of this.all()) {
      if (lang.config.extensions.includes(ext)) return lang;
    }
    return null;
  }

  static fromConfigFile(fileName: string): SupportedLanguage | null {
    for (const lang of this.all()) {
      for (const pattern of lang.config.configFiles) {
        if (pattern === fileName || fileName.endsWith(pattern.replace("*", ""))) return lang;
        if (pattern.startsWith("*.") && fileName.endsWith(pattern.slice(1))) return lang;
      }
    }
    return null;
  }

  get name(): string { return this.config.name; }
  get alias(): string { return this.config.alias; }
  get extensions(): string[] { return this.config.extensions; }
  get configFiles(): string[] { return this.config.configFiles; }
  get commentStyle() { return this.config.commentStyle; }
  get docStyle() { return this.config.docStyle; }
  get packageManager(): string { return this.config.packageManager; }
  get ecosystem(): string { return this.config.ecosystem; }
  get ignoreFiles(): string[] { return this.config.ignoreFiles; }
  get debugPatterns(): string[] { return this.config.debugPatterns; }

  getGlobPattern(): string {
    return `**/*.{${this.config.extensions.join(",")}}`;
  }

  getAllExtensionsGlob(): string {
    return `**/*.{${SupportedLanguage.all().flatMap(l => l.extensions).join(",")}}`;
  }

  stripCodeComments(content: string): string {
    let sanitized = content;
    const { single, multiStart, multiEnd } = this.config.commentStyle;

    if (multiStart && multiEnd) {
      const escapedStart = this.escapeRegex(multiStart);
      const escapedEnd = this.escapeRegex(multiEnd);
      sanitized = sanitized.replace(new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, "g"), (m) => " ".repeat(m.length));
    }

    if (single) {
      const escapedSingle = this.escapeRegex(single);
      sanitized = sanitized.replace(new RegExp(`${escapedSingle}.*`, "g"), (m) => " ".repeat(m.length));
    }

    return sanitized;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  toJSON(): LanguageConfig {
    return { ...this.config };
  }
}
