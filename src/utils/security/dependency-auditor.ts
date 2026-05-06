/**
 * Dependency Security Auditor
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileScanner } from "../../tools/base.js";
import { type SecurityAuditReport } from "./types.js";

export class DependencyAuditor {
  static async audit(dirPath: string, excludePath?: string[]): Promise<SecurityAuditReport['dependencyAnalysis']> {
    const result: SecurityAuditReport['dependencyAnalysis'] = {
      hasLockFile: false,
      outdatedPackages: [],
      vulnerablePackages: [],
      totalDependencies: 0,
    };

    // 1. Check for lock files
    const lockFiles = await FileScanner.findFiles({ dirPath, excludePath, includePath: ['**/*lock*'] }, ['**/*lock*']);
    result.hasLockFile = lockFiles.length > 0;

    // 2. Parse package.json
    try {
      const packageJsonPath = path.join(dirPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      
      result.totalDependencies = Object.keys(deps).length;

      for (const [dep, version] of Object.entries(deps) as [string, string][]) {
        if (version.includes('*') || version.includes('latest')) {
          result.outdatedPackages.push(`${dep}@${version} (floating version)`);
        }
      }
    } catch (e) {
      // package.json might not exist or be invalid
    }

    return result;
  }
}
