/**
 * ArchetypeEngine - The core of architectural pattern detection
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileScanner } from '../tools/base.js';
import { CodeSanitizer } from './code-analysis.js';
import { SupportedLanguage } from './supported-language.js';
import { 
  type ArchetypeComponent, 
  type ComponentRole, 
  type ArchetypeReport,
  type ArchetypeAdvice
} from '../types/tools.js';

export class ArchetypeEngine {
  /**
   * Primary method to analyze project archetypes and patterns
   */
  static async analyze(
    dirPath: string, 
    minSimilarity: number = 0.8, 
    includePath?: string[],
    excludePath?: string[]
  ): Promise<ArchetypeReport> {
    // 1. Scan and parse all components
    const allExt = `**/*.{${SupportedLanguage.all().flatMap(l => l.extensions).join(",")}}`;
    const defaultPatterns = [allExt];
    const files = await FileScanner.findFiles(
      { dirPath, includePath: includePath || defaultPatterns, excludePath }, 
      includePath ? [] : defaultPatterns
    );
    
    const components: ArchetypeComponent[] = [];
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const content = await fs.readFile(fullPath, 'utf-8');
      components.push(this.parseComponent(file, content));
    }

    // 2. Zone Analysis (Group by directory)
    const zones: ArchetypeReport['zones'] = {};
    for (const comp of components) {
      const zoneName = path.dirname(comp.file);
      if (!zones[zoneName]) {
        zones[zoneName] = { 
          primaryPattern: 'Unknown', 
          components: 0, 
          roles: { 
            ENTRY_POINT: 0, LOGIC_HOLDER: 0, DATA_ACCESS: 0, CONTRACT: 0, 
            DTO: 0, UTILITY: 0, DOMAIN_MODEL: 0, EVENT_HANDLER: 0, 
            FACTORY: 0, UNKNOWN: 0 
          } 
        };
      }
      zones[zoneName].components++;
      zones[zoneName].roles[comp.role]++;
    }

    // Infer pattern per zone
    for (const [name, zone] of Object.entries(zones)) {
      zone.primaryPattern = this.inferPattern(zone, name);
    }

    // 3. Similarity Matrix & Refactor Advice
    const suggestions = this.generateAdvice(components, minSimilarity);

    return {
      message: `Analyzed ${components.length} components across ${Object.keys(zones).length} zones.`,
      zones,
      suggestions
    };
  }

  private static parseComponent(file: string, content: string): ArchetypeComponent {
    const fileName = path.basename(file);
    const ext = file.split('.').pop()?.toLowerCase() || 'ts';
    const sanitized = CodeSanitizer.stripComments(content, ext);
    
    // Detect Suffix
    const suffixMatch = fileName.match(/([A-Z][a-z]+)\.(?:js|ts|php|py|go|rs)$/);
    const suffix = suffixMatch ? suffixMatch[1] : '';

    // Detect Role based on suffix and content
    let role: ComponentRole = 'UNKNOWN';
    if (/Controller|Handler|Action|Command/i.test(fileName)) role = 'ENTRY_POINT';
    else if (/Service|Manager|Processor|Provider/i.test(fileName)) role = 'LOGIC_HOLDER';
    else if (/Repository|DAO|Mapper|Store/i.test(fileName)) role = 'DATA_ACCESS';
    else if (/Interface|Contract|Abstract/i.test(fileName) || /interface\s+\w+/i.test(sanitized)) role = 'CONTRACT';
    else if (/DTO|Request|Response/i.test(fileName)) role = 'DTO';
    else if (/Entity|Aggregate|ValueObject|Model/i.test(fileName)) role = 'DOMAIN_MODEL';
    else if (/Listener|Subscriber|Observer|Event|Bus/i.test(fileName)) role = 'EVENT_HANDLER';
    else if (/Factory|Builder/i.test(fileName)) role = 'FACTORY';

    // Extract Methods (Supports Class Methods, Functions, etc.)
    const methodPattern = /\b(?:async\s+)?(?:public|private|protected|static\s+)?(\w+)\s*\(([^)]*)\)\s*(?::|{)/gi;
    const methods: ArchetypeComponent['methods'] = [];
    const controlKeywords = ['if', 'for', 'while', 'switch', 'catch', 'constructor', 'with'];
    let match;
    while ((match = methodPattern.exec(sanitized)) !== null) {
      if (controlKeywords.includes(match[1])) continue;
      methods.push({
        name: match[1],
        paramCount: (match[2] || '').split(',').filter(p => p.trim()).length
      });
    }

    // Calculate Complexity (simplified)
    const complexity = (sanitized.match(/\b(if|for|while|case|&&|\|\|)\b/g) || []).length;

    // Detect Dependencies
    const dependencies = (sanitized.match(/import\s+.*from\s+['"](.*)['"]/g) || [])
      .map(d => d.replace(/import\s+.*from\s+['"](.*)['"]/, '$1'));

    return { file, name: fileName, role, suffix, methods, complexity, dependencies };
  }

  private static inferPattern(zone: any, zoneName: string): string {
    const { roles } = zone;
    const isDomainFolder = /domain|model|entity/i.test(zoneName);

    if (roles.DOMAIN_MODEL > 0 && (roles.DATA_ACCESS > 0 || roles.LOGIC_HOLDER > 0 || isDomainFolder)) return 'Domain-Driven Design (DDD)';
    if (roles.EVENT_HANDLER > roles.ENTRY_POINT) return 'Event-Driven Architecture (EDA)';
    if (roles.ENTRY_POINT > 0 && roles.LOGIC_HOLDER > 0 && roles.DATA_ACCESS > 0) return 'Layered Architecture';
    if (roles.DATA_ACCESS > roles.LOGIC_HOLDER) return 'Data-Centric / Repository Pattern';
    if (roles.ENTRY_POINT > roles.LOGIC_HOLDER && roles.LOGIC_HOLDER === 0) return 'Basic MVC / Active Record';
    if (roles.LOGIC_HOLDER > roles.ENTRY_POINT) return 'Service-Oriented';
    return 'Generic / Hybrid';
  }

  private static generateAdvice(components: ArchetypeComponent[], minSimilarity: number): ArchetypeAdvice[] {
    const advice: ArchetypeAdvice[] = [];
    const groups = this.groupByRole(components);

    for (const [role, comps] of Object.entries(groups)) {
      if (comps.length < 2) continue;

      // Find clusters with similar methods
      for (let i = 0; i < comps.length; i++) {
        for (let j = i + 1; j < comps.length; j++) {
          const sim = this.calculateSimilarity(comps[i], comps[j]);
          if (sim >= minSimilarity) {
            advice.push(this.createAdvice(comps[i], comps[j], sim));
          }
        }
      }
    }

    return advice.slice(0, 10); // Limit results
  }

  private static groupByRole(components: ArchetypeComponent[]): Record<string, ArchetypeComponent[]> {
    return components.reduce((acc, c) => {
      if (!acc[c.role]) acc[c.role] = [];
      acc[c.role].push(c);
      return acc;
    }, {} as Record<string, ArchetypeComponent[]>);
  }

  private static calculateSimilarity(a: ArchetypeComponent, b: ArchetypeComponent): number {
    if (a.methods.length === 0 || b.methods.length === 0) return 0;

    const namesA = new Set(a.methods.map(m => m.name));
    const namesB = new Set(b.methods.map(m => m.name));
    
    let matches = 0;
    for (const name of namesA) {
      if (namesB.has(name)) matches++;
    }

    return matches / Math.max(namesA.size, namesB.size);
  }

  private static createAdvice(a: ArchetypeComponent, b: ArchetypeComponent, similarity: number): ArchetypeAdvice {
    const roleMap: Record<string, string> = {
      ENTRY_POINT: 'BaseController',
      LOGIC_HOLDER: 'BaseService',
      DATA_ACCESS: 'BaseRepository',
      CONTRACT: 'UnifiedInterface',
      DTO: 'BaseDTO',
      DOMAIN_MODEL: 'BaseEntity',
      EVENT_HANDLER: 'BaseListener'
    };

    const suggestedName = roleMap[a.role] || 'BaseComponent';
    
    return {
      title: `High Structural Similarity in ${a.role}`,
      pattern: a.role === 'DATA_ACCESS' ? 'Repository Pattern' : 'Service Layer',
      components: [a.file, b.file],
      similarity,
      recommendation: `Extract common method signatures to an Interface or common logic to a ${suggestedName} / Trait.`,
      benefit: `Reduces redundancy and ensures architectural consistency across ${a.role} components.`
    };
  }
}
