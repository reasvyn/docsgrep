import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// package.json is located in the root directory (two levels up from src/utils/app-info.ts)
// In built version (build/utils/app-info.js), it is also two levels up from build/utils.
const pkgPath = resolve(__dirname, "../../package.json");

interface PackageJson {
  name: string;
  version: string;
  description: string;
  author: string | { name: string; email?: string; url?: string };
  license: string;
}

let pkg: PackageJson;

try {
  pkg = JSON.parse(readFileSync(pkgPath, "utf-8")); // docsgrep-ignore (startup only)
} catch (error) {
  // Fallback if package.json cannot be read (e.g. in some runtime environments)
  pkg = {
    name: "docsgrep",
    version: "unknown",
    description: "Documentation search, code quality auditing, security scanning, and bug detection — available as a CLI devtool and MCP server",
    author: "Reasvyn",
    license: "MIT"
  };
}

/**
 * Centralized Application Information
 * Single Source of Truth: package.json
 */
export const AppInfo = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  author: typeof pkg.author === "string" ? pkg.author : pkg.author?.name || "Anonymous",
  license: pkg.license,
  
  /**
   * Returns a standard identity string for logs and responses
   */
  getIdentity(): string {
    return `${this.name} v${this.version}`;
  }
};
