// analyze_project_style - Combined Project Conventions & Codebase Patterns
// Provides comprehensive project style analysis

import * as path from 'node:path';
import { getIgnorePatterns } from './utils/file.js';
import { SupportedLanguage } from './utils/supported-language.js';

export interface ProjectStyleReport {
  conventions: {
    found: boolean;
    files: Record<string, string>;
    message: string;
  };
  patterns: {
    sampled: number;
    files: Record<string, string>;
    detected: {
      namingStyle: string;
      indentation: string;
      quoteStyle: string;
      lineLengthAvg: number;
      hasComments: boolean;
      commentStyle: string;
    };
    message: string;
  };
  recommendations: string[];
}

// Re-export functions from existing modules
export async function gatherProjectConventions(dirPath: string, excludePath?: string[]): Promise<Record<string, string>> {
  try {
    const { glob } = await import('glob');
    const fs = await import('node:fs/promises');
    const ignorePatterns = await getIgnorePatterns(dirPath);

    const conventionPatterns = [
      // Markdown rules (fuzzy)
      "**/*contribut*.{md,txt}", "**/*architectur*.{md,txt}", "**/*style*.{md,txt}", 
      "**/*convention*.{md,txt}", "**/*standard*.{md,txt}", "**/*guideline*.{md,txt}",
      // Generic linter/formatter configs (fuzzy)
      "**/*lint*rc*", "**/*.lint*", "**/*format*rc*", "**/*.format*", "**/*-cs-fixer*", "**/*rules*.{json,yaml,yml,xml,toml}",
      // Editor config
      "**/.editorconfig",
      // Known specific linters
      "**/.eslintrc*", "**/eslint.config.*", "**/.prettierrc*", "**/prettier.config.*", "**/biome.json",
      "**/phpcs.xml", "**/phpstan.neon", "**/golangci.y*ml", "**/tox.ini", "**/.flake8", "**/.rubocop.yml", "**/rustfmt.toml"
    ];

    const foundFiles = await glob(conventionPatterns, {
      cwd: dirPath,
      nocase: true,
      ignore: ignorePatterns,
    });

    const conventions: Record<string, string> = {};
    
    for (const file of foundFiles) {
      const fullPath = path.join(dirPath, file);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile() && stat.size < 100000) {
          const content = await fs.readFile(fullPath, "utf-8");
          conventions[file] = content;
        } else {
          conventions[file] = `[File too large to include context automatically: ${stat.size} bytes]`;
        }
      } catch (e: any) {
        conventions[file] = `[Error reading file: ${e.message}]`;
      }
    }

    return conventions;
  } catch (error: any) {
    throw new Error(`Failed to gather project conventions: ${error.message}`);
  }
}

export async function sampleCodebasePatterns(dirPath: string, excludePath?: string[]): Promise<Record<string, string>> {
  try {
    const { glob } = await import('glob');
    const fs = await import('node:fs/promises');
    const crypto = await import('node:crypto');
    const ignorePatterns = await getIgnorePatterns(dirPath);

    const allExt = SupportedLanguage.all().flatMap(l => l.extensions).join(",");
    const sourcePatterns = [
      `src/**/*.{${allExt}}`,
      `app/**/*.{${allExt}}`,
      `lib/**/*.{${allExt}}`,
      `internal/**/*.{${allExt}}`,
      `pkg/**/*.{${allExt}}`,
    ];

    const foundFiles = await glob(sourcePatterns, {
      cwd: dirPath,
      nocase: true,
      ignore: ignorePatterns,
    });

    // Limit to at most 3 random files
    const selectedFiles: string[] = [];
    const shuffled = [...foundFiles];
    for (let i = 0; i < 3 && shuffled.length > 0; i++) {
      const randomBytes = crypto.randomBytes(4);
      const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF;
      const idx = Math.floor(randomValue * shuffled.length);
      selectedFiles.push(shuffled[idx]);
      shuffled.splice(idx, 1);
    }
    
    const patterns: Record<string, string> = {};
    
    for (const file of selectedFiles) {
      const fullPath = path.join(dirPath, file);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile() && stat.size < 20000) {
          const content = await fs.readFile(fullPath, "utf-8");
          patterns[file] = content;
        }
      } catch (e: any) {
        patterns[file] = `[Error reading file: ${e.message}]`;
      }
    }

    return patterns;
  } catch (error: any) {
    throw new Error(`Failed to sample codebase patterns: ${error.message}`);
  }
}

export function detectStyleFromCode(files: Array<{ path: string; content: string }>): {
  namingStyle: string;
  indentation: string;
  quoteStyle: string;
  lineLengthAvg: number;
  hasComments: boolean;
  commentStyle: string;
} {
  const scores: Record<string, number> = {
    camelCase: 0,
    snake_case: 0,
    PascalCase: 0,
    UPPER_SNAKE: 0,
  };

  let spaceIndent = 0;
  let tabIndent = 0;
  let singleQuotes = 0;
  let doubleQuotes = 0;
  let backticks = 0;
  let singleLineComments = 0;
  let multiLineComments = 0;
  let totalLines = 0;
  let totalLength = 0; // docsgrep-ignore

  for (const file of files) {
    const lines = file.content.split('\n');
    totalLines += lines.length;
    
    for (const line of lines) {
      totalLength += line.length;
      
      // Detect indentation
      if (/^  /.test(line)) spaceIndent++;
      if (/^\t/.test(line)) tabIndent++;
      
      // Detect quote style
      if (/'/.test(line)) singleQuotes++;
      if (/"/.test(line) && !/'/.test(line)) doubleQuotes++;
      if (/`/.test(line)) backticks++;
      
      // Detect comments
      if (/\/\//.test(line)) singleLineComments++;
      if (/\/\*/.test(line)) multiLineComments++;
    }

    // Detect naming conventions
    const identifiers = file.content.match(/\b[a-zA-Z_]\w*\b/g) || [];
    for (const id of identifiers) {
      if (/^[a-z]+(?:[A-Z][a-z]*)*$/.test(id)) scores.camelCase++;
      else if (/^[a-z]+(?:_[a-z]+)*$/.test(id)) scores.snake_case++;
      else if (/^[A-Z][a-z]+(?:[A-Z][a-z]*)*$/.test(id)) scores.PascalCase++;
      else if (/^[A-Z]+(?:_[A-Z]+)*$/.test(id)) scores.UPPER_SNAKE++;
    }
  }

  // Determine dominant naming style
  let namingStyle = 'mixed';
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore > 0) {
    namingStyle = Object.keys(scores).find(k => scores[k] === maxScore) || 'mixed';
  }

  return {
    namingStyle,
    indentation: spaceIndent > tabIndent ? 'spaces' : 'tabs',
    quoteStyle: singleQuotes > doubleQuotes ? (backticks > singleQuotes ? 'backtick' : 'single') : (backticks > doubleQuotes ? 'backtick' : 'double'),
    lineLengthAvg: totalLines > 0 ? Math.round(totalLength / totalLines) : 0,
    hasComments: singleLineComments > 0 || multiLineComments > 0,
    commentStyle: singleLineComments >= multiLineComments ? 'single-line' : 'multi-line',
  };
}

export async function analyzeProjectStyle(dirPath: string, excludePath?: string[]): Promise<ProjectStyleReport> {
  const conventions = await gatherProjectConventions(dirPath, excludePath);
  const patterns = await sampleCodebasePatterns(dirPath, excludePath);

  const conventionsMessage = `Found ${Object.keys(conventions).length} convention/linter files in local directory.`;
  const patternsMessage = `Sampled ${Object.keys(patterns).length} source files to infer codebase patterns.`;

  // Detect style from sampled files
  const patternFiles = Object.entries(patterns).map(([path, content]) => ({ path, content }));
  const detected = detectStyleFromCode(patternFiles);

  const recommendations: string[] = [];
  
  if (Object.keys(conventions).length === 0) {
    recommendations.push('No explicit documentation or linter config found. Using implicit conventions from code.');
  } else {
    recommendations.push('Project has explicit conventions/linter config - good for maintainability!');
  }

  if (detected.namingStyle !== 'mixed') {
    recommendations.push(`Detected naming style: ${detected.namingStyle}. Ensure consistency across the codebase.`);
  }

  if (detected.lineLengthAvg > 100) {
    recommendations.push('Average line length is high. Consider shorter lines for readability.');
  }

  return {
    conventions: {
      found: Object.keys(conventions).length > 0,
      files: conventions,
      message: conventionsMessage,
    },
    patterns: {
      sampled: Object.keys(patterns).length,
      files: patterns,
      detected,
      message: patternsMessage,
    },
    recommendations,
  };
}
