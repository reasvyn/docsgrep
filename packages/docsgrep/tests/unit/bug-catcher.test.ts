import { describe, it, expect, beforeEach } from 'vitest';
import { BugDetector } from '../../src/bug-catcher.js';
import { catchBugs } from '../../src/bug-catcher.js';

describe('BugDetector', () => {
  let detector: BugDetector;

  beforeEach(() => {
    detector = new BugDetector();
  });

  describe('Runtime Error Detection', () => {
    it('should detect unhandled promise rejections', () => {
      const code = `
        async function fetchData() {
          const result = await someAPICall();
          return result.then(data => process(data));
        }
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const runtimeIssues = issues.filter(i => i.category === 'Runtime Error');
      expect(runtimeIssues.length).toBeGreaterThan(0);
    });

    it('should detect null/undefined dereference without checks', () => {
      const code = `
        const user = getUSer();
        console.log(user.name);
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const nullRefs = issues.filter(i => i.title.includes('Null/Undefined'));
      expect(nullRefs.length).toBeGreaterThan(0);
    });

    it('should NOT flag await if inside try-catch block (Smart Filter)', () => {
      const code = `
        async function safeFetch() {
          try {
            const result = await someAPICall();
            return result;
          } catch (e) {
            console.error(e);
          }
        }
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const unhandledPromises = issues.filter(i => i.title === 'Unhandled Promise Rejection');
      expect(unhandledPromises.length).toBe(0);
    });

    it('should lower severity for issues in test files', () => {
      const code = `
        const user = getUSer();
        console.log(user.name);
      `;
      const issues = detector.detectBugs(code, 'test.test.ts');
      const nullRefs = issues.filter(i => i.title.includes('Null/Undefined'));
      expect(nullRefs.length).toBeGreaterThan(0);
      expect(nullRefs[0].severity).toBe('low');
    });
  });

  describe('Race Condition Detection', () => {
    it('should detect unsynchronized shared state modifications', () => {
      const code = `
        let counter = 0;
        function increment() {
          counter++;
        }
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const raceIssues = issues.filter(i => i.category === 'Race Condition');
      expect(raceIssues.length).toBeGreaterThan(0);
    });

    it('should detect array modification during iteration', () => {
      const code = `
        const arr = [1, 2, 3];
        for (let i = 0; i < arr.length; i++) {
          arr.push(arr[i] * 2);
        }
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const concurrentIssues = issues.filter(i => i.title.includes('Concurrent'));
      expect(concurrentIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect event listeners without removal', () => {
      const code = `
        element.addEventListener('click', handler);
        // Missing: element.removeEventListener('click', handler);
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const memoryIssues = issues.filter(i => i.category === 'Memory Leak');
      expect(memoryIssues.length).toBeGreaterThan(0);
    });

    it('should detect setInterval without clearInterval', () => {
      const code = `
        setInterval(() => {
          console.log('tick');
        }, 1000);
        // Missing: clearInterval(intervalId);
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const intervalIssues = issues.filter(i => i.title.includes('Uncleared'));
      expect(intervalIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Dependency Coupling Detection', () => {
    it('should detect high coupling through many imports', () => {
      const code = `
        import { a } from './module1';
        import { b } from './module2';
        import { c } from './module3';
        import { d } from './module4';
        import { e } from './module5';
        import { f } from './module6';
        import { g } from './module7';
        import { h } from './module8';
        import { i } from './module9';
        import { j } from './module10';
        import { k } from './module11';
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const couplingIssues = issues.filter(i => i.category === 'Dependency Coupling');
      expect(couplingIssues.length).toBeGreaterThan(0);
    });

    it('should detect direct instantiation (tight coupling)', () => {
      // Need >10 instantiations to trigger the threshold
      let code = 'class ServiceA {\ndoSomething() {\n';
      for (let i = 0; i < 15; i++) {
        code += `    const svc${i} = new Service${i}();\n`;
      }
      code += '  }\n}';
      
      const issues = detector.detectBugs(code, 'test.ts');
      const couplingIssues = issues.filter(i => i.title.includes('Tight Coupling'));
      expect(couplingIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Issues Detection', () => {
    it('should detect synchronous file operations', () => {
      const code = `
        const data = fs.readFileSync('/path/to/large/file.txt');
        console.log(data);
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const perfIssues = issues.filter(i => i.category === 'Performance');
      expect(perfIssues.length).toBeGreaterThan(0);
    });

    it('should detect unbounded recursion', () => {
      const code = `
        function traverse(node) {
          if (node.children) {
            node.children.forEach(child => traverse(child));
          }
        }
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const recursionIssues = issues.filter(i => i.title.includes('Unbounded'));
      expect(recursionIssues.length).toBeGreaterThan(0);
    });

    it('should detect chained array operations (memory heavy)', () => {
      const code = `
        const result = data.map(x => x * 2).map(x => x + 1).map(x => x.toString());
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const heavyIssues = issues.filter(i => i.title.includes('Memory-Heavy'));
      expect(heavyIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Unresolved Issues Detection', () => {
    it('should detect TODO comments', () => {
      const code = `
        // TODO: Fix this bug later
        function buggyFunction() {
          return undefined;
        }
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const unresolvedIssues = issues.filter(i => i.category === 'Unresolved');
      expect(unresolvedIssues.length).toBeGreaterThan(0);
    });

    it('should detect FIXME comments', () => {
      const code = `
        // FIXME: This causes memory leak
        function leakyFunction() {
          // ...
        }
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const fixmeIssues = issues.filter(i => i.title.includes('TODO/FIXME'));
      expect(fixmeIssues.length).toBeGreaterThan(0);
    });

    it('should detect console.log statements', () => {
      const code = `
        function test() {
          console.log('Debug info');
          return true;
        }
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const debugIssues = issues.filter(i => i.title.includes('Console'));
      expect(debugIssues.length).toBeGreaterThan(0);
    });

    it('should detect deprecated API usage', () => {
      const code = `
        const year = new Date().getYear();
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      const deprecatedIssues = issues.filter(i => i.title.includes('Deprecated'));
      expect(deprecatedIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Bug Score Calculation', () => {
    it('should calculate bug score correctly', () => {
      const detector = new BugDetector();
      const issues = [
        { severity: 'critical' as const, category: 'test' },
        { severity: 'high' as const, category: 'test' },
        { severity: 'medium' as const, category: 'test' },
      ].map(i => ({ ...i, file: 'test.ts', title: 'test', description: '', impact: '', remediation: '' }));

      const score = detector.calculateBugScore(issues, 1);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 for no files scanned', () => {
      const score = detector.calculateBugScore([], 0);
      expect(score).toBe(0);
    });
  });

  describe('Risk Level Assessment', () => {
    it('should return Low for score >= 90', () => {
      expect(detector.getRiskLevel(95)).toBe('Low');
    });

    it('should return Medium for score >= 70', () => {
      expect(detector.getRiskLevel(75)).toBe('Medium');
    });

    it('should return High for score >= 50', () => {
      expect(detector.getRiskLevel(60)).toBe('High');
    });

    it('should return Critical for score < 50', () => {
      expect(detector.getRiskLevel(30)).toBe('Critical');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty code', () => {
      const issues = detector.detectBugs('', 'test.ts');
      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle code without any issues', () => {
      const code = `
        function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;
      const issues = detector.detectBugs(code, 'test.ts');
      expect(issues).toBeDefined();
    });

    it('should limit issues per file', () => {
      // Create code with many issues
      let code = '';
      for (let i = 0; i < 50; i++) {
        code += `console.log('Debug \${i}');\n`;
      }
      const issues = detector.detectBugs(code, 'test.ts');
      expect(issues.length).toBeLessThanOrEqual(20); // Slice limit
    });
  });
});

describe('catchBugs Integration', () => {
  it('should be defined as a function', () => {
    expect(catchBugs).toBeDefined();
    expect(typeof catchBugs).toBe('function');
  });

  // Note: Full integration tests would require actual file system operations
  // These are better suited for E2E tests with a test directory
});
