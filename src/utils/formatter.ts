/**
 * Utilities for formatting tool responses for human readability in CLI mode
 */

export class CliFormatter {
  /**
   * Formats a raw tool response content into a pretty-printed terminal output
   */
  static format(content: string, toolName: string): string {
    try {
      const data = JSON.parse(content);
      
      // Select formatter based on data structure or tool name
      if (data.summary && (data.issues || data.owaspTop10 || data.categories)) {
        return this.formatAuditReport(data, toolName);
      }

      if (data.zones && data.suggestions) {
        return this.formatArchetypeReport(data);
      }
      
      if (data.results && Array.isArray(data.results)) {
        return this.formatSearchResults(data, toolName);
      }

      if (data.files && Array.isArray(data.files)) {
        return this.formatFileList(data, toolName);
      }

      // Default pretty JSON for unknown structures
      return JSON.stringify(data, null, 2);
    } catch {
      // Not JSON, return as is
      return content;
    }
  }

  private static formatAuditReport(data: any, toolName: string): string {
    const summary = data.summary;
    let out = `\n${"=".repeat(60)}\n`;
    out += `📊 ${toolName.toUpperCase()} REPORT\n`;
    out += `${"=".repeat(60)}\n\n`;

    // Summary Section
    out += `📈 SUMMARY:\n`;
    out += `  - Files Scanned: ${summary.filesScanned}\n`;
    out += `  - Total Issues:  ${summary.totalIssues}\n`;
    if (summary.codeQualityScore !== undefined) out += `  - Quality Score: ${this.colorScore(summary.codeQualityScore)}/100\n`;
    if (summary.documentationScore !== undefined) out += `  - Docs Score:    ${this.colorScore(summary.documentationScore)}/100\n`;
    if (summary.securityScore !== undefined) out += `  - Security Score: ${this.colorScore(summary.securityScore)}/100\n`;
    if (summary.bugScore !== undefined) out += `  - Bug Score:      ${this.colorScore(summary.bugScore)}/100\n`;
    out += `  - Severity:      🔴 ${summary.critical || 0} Critical, 🟠 ${summary.high || 0} High, 🟡 ${summary.medium || 0} Medium, 🔵 ${summary.low || 0} Low\n\n`;

    // Project Readiness Section (new)
    if (data.projectReadiness) {
      const r = data.projectReadiness;
      out += `📋 PROJECT READINESS:\n`;
      out += `  ${r.hasLicense ? '✅' : '❌'} License file\n`;
      out += `  ${r.hasGitignore ? '✅' : '❌'} .gitignore\n`;
      out += `  ${r.gitignoreCoversBasics ? '✅' : '⚠️'} .gitignore covers deps/build/env\n`;
      out += `  ${r.hasEnvExample ? '✅' : '❌'} .env.example\n`;
      out += `  ${r.hasEditorconfig ? '✅' : '❌'} .editorconfig\n`;
      if (r.detectedType !== 'unknown') {
        out += `  Project type: ${r.detectedType}\n`;
      }
      out += `\n`;
    }

    // Issues Section
    const allIssues: any[] = [];
    if (data.issues) allIssues.push(...data.issues);
    if (data.owaspTop10) data.owaspTop10.forEach((cat: any) => allIssues.push(...cat.issues));
    if (data.categories) data.categories.forEach((cat: any) => allIssues.push(...cat.issues));

    if (allIssues.length > 0) {
      out += `⚠️ DETECTED ISSUES (${Math.min(allIssues.length, 50)} shown):\n`;
      allIssues.slice(0, 50).forEach((issue, i) => {
        const severityIcon = issue.severity === 'critical' || issue.severity === 'high' ? '🔴' : '🟡';
        out += `  ${i + 1}. ${severityIcon} [${issue.severity.toUpperCase()}] ${issue.title}\n`;
        out += `     File: ${issue.file}${issue.line ? `:${issue.line}` : ''}\n`;
        out += `     Desc: ${issue.description}\n`;
        if (issue.suggestion || issue.remediation) {
          out += `     💡 ${issue.suggestion || issue.remediation}\n`;
        }
        out += `\n`;
      });
    } else {
      out += `✅ No significant issues detected. Great job!\n\n`;
    }

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      out += `💡 RECOMMENDATIONS:\n`;
      data.recommendations.forEach((rec: string) => {
        out += `  • ${rec}\n`;
      });
      out += `\n`;
    }

    out += `${"=".repeat(60)}\n`;
    return out;
  }

  private static formatSearchResults(data: any, toolName: string): string {
    let out = `\n🔍 SEARCH RESULTS for "${data.query || data.pattern}"\n`;
    out += `${"-".repeat(60)}\n`;
    
    data.results.forEach((res: any, i: number) => {
      out += `[${i + 1}] ${res.file}${res.line ? `:${res.line}` : ''}\n`;
      if (res.content) out += `    "${res.content.trim()}"\n`;
      if (res.snippet) out += `    Snippet: ${res.snippet}...\n`;
      if (res.relevanceScore) out += `    Relevance: ${res.relevanceScore}\n`;
      out += `\n`;
    });

    if (data.results.length === 0) out += `No matches found.\n`;
    
    return out;
  }

  private static formatFileList(data: any, toolName: string): string {
    let out = `\n📂 ${data.message || 'Files Found:'}\n`;
    out += `${"-".repeat(60)}\n`;
    data.files.forEach((f: string) => out += `  • ${f}\n`);
    return out;
  }

  private static colorScore(score: number): string {
    if (score >= 90) return `🟢 ${score}`;
    if (score >= 70) return `🟡 ${score}`;
    return `🔴 ${score}`;
  }

  private static formatArchetypeReport(data: any): string {
    let out = `\n${"=".repeat(60)}\n`;
    out += `🏛️  ARCHITECTURAL PATTERN MAP\n`;
    out += `${"=".repeat(60)}\n\n`;

    // Zones Section
    out += `📍 ARCHITECTURE ZONES:\n`;
    for (const [name, zone] of Object.entries(data.zones) as any) {
      out += `  • ${name || './'}\n`;
      out += `    Pattern:  ${zone.primaryPattern}\n`;
      out += `    Elements: ${zone.components} files\n`;
      out += `\n`;
    }

    // Suggestions
    if (data.suggestions && data.suggestions.length > 0) {
      out += `🧬 REFACTORING OPPORTUNITIES:\n`;
      data.suggestions.forEach((adv: any, i: number) => {
        out += `  ${i + 1}. ✨ ${adv.title}\n`;
        out += `     Pattern: ${adv.pattern}\n`;
        out += `     Match:   ${Math.round(adv.similarity * 100)}%\n`;
        out += `     Files:   ${adv.components.join(', ')}\n`;
        out += `     👉 ${adv.recommendation}\n`;
        out += `     💡 ${adv.benefit}\n\n`;
      });
    } else {
      out += `✅ Your architecture looks lean and consistent!\n`;
    }

    out += `${"=".repeat(60)}\n`;
    return out;
  }
}
