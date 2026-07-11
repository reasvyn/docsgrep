import { SupportedLanguage } from "./supported-language.js";

const EXT_TO_ALIAS: Record<string, string> = {
  js: "js", mjs: "js", cjs: "js", jsx: "js",
  ts: "js", mts: "js", cts: "js", tsx: "js",
  py: "py", pyw: "py",
  java: "java",
  go: "go",
  rs: "rs",
  cs: "cs", vb: "cs", fs: "cs",
  php: "php", phtml: "php",
  rb: "rb",
  c: "cpp", h: "cpp", cpp: "cpp", hpp: "cpp", cxx: "cpp", hxx: "cpp",
  swift: "swift",
};

export class CodeSanitizer {
  static stripComments(content: string, ext: string = "ts"): string {
    const alias = EXT_TO_ALIAS[ext.toLowerCase()] || "js";
    const lang = SupportedLanguage.fromExtension(alias);
    if (lang) return lang.stripCodeComments(content);

    let sanitized = content;
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
    sanitized = sanitized.replace(/(?:\/\/|#|--).*/g, (m) => " ".repeat(m.length));
    return sanitized;
  }

  static stripStrings(content: string): string {
    return content.replace(/(["'`])(?:(?=(\\?))\2[\s\S])*?\1/g, (match) => " ".repeat(match.length));
  }

  static isIgnored(line: string, allLines: string[] = [], lineIndex: number = 0): boolean {
    if (!line) return false;
    if (/docsgrep-ignore|nolint|noscan|ignore-issue/i.test(line)) return true;
    for (let j = 1; j < 30; j++) {
      const above = allLines[lineIndex - j];
      if (!above) break;
      if (/docsgrep-ignore|nolint|noscan|ignore-issue/i.test(above)) return true;
      if (!/^\s*(?:\/\/|#|--|%|;|\/\*|\}|\*)/.test(above)) break;
    }
    return false;
  }
}
