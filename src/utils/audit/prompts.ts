/**
 * Prompt generation for audit tools
 */

export function generateUniversalAuditPrompt(dirPath: string, structure: any): string {
  let prompt = `## 📊 Universal Code Quality Audit for \`${dirPath}\`\n\n`;
  prompt += `**Detected Project State:**\n`;
  prompt += `- Documentation: ${structure.hasDocumentation ? '✅ Found' : '❌ Missing'}\n`;
  prompt += `- Linter Config: ${structure.hasLinterConfig ? '✅ Found' : '❌ Missing'}\n`;
  prompt += `- Tests: ${structure.hasTests ? '✅ Found' : '❌ Missing'}\n`;
  prompt += `- CI/CD: ${structure.hasCI ? '✅ Found' : '❌ Missing'}\n\n`;
  
  prompt += `The audit will analyze naming conventions, indentation, code smells, complexity, and technical debt across all files.\n\n`;
  prompt += `Choose focus: 1. Full Audit 2. Readability Only 3. Complexity Only.`;
  
  return prompt;
}
