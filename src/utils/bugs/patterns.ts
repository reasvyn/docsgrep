/**
 * Bug detection patterns and configurations
 */

export const RUNTIME_PATTERNS = {
  'Unhandled Promise Rejection': {
    patterns: [
      /\.then\([^)]*\)(?!\s*\.catch)/g,
      /await\s+[^;]+(?!\s*catch)/g,
      /new\s+Promise\s*\([^)]*\)(?!\s*\.catch)/g,
    ],
    description: 'Promises or async operations without proper error handling',
  },
  'Null Dereference': {
    patterns: [
      /\w+\.\w+(?!\s*(?:&&|\?\.|\?\?:|\|\|))/g,
      /!\s*\w+\.\w+/g,
    ],
    description: 'Potential null/undefined dereference',
  },
  'Uninitialized Variables': {
    patterns: [
      /let\s+\w+\s*;(?!=)/g,
      /const\s+\w+\s*;(?!=)/g,
    ],
    description: 'Variables declared but not initialized',
  },
  'Type Coercion': {
    patterns: [
      /==\s*(?!==)/g,
      /!=\s*(?!==)/g,
    ],
    description: 'Loose equality/inequality issues',
  },
};

export const RACE_PATTERNS = {
  'Unsynchronized State': {
    patterns: [
      /(let|var|const)\s+(\w+)\s*=.*;(?=.*\2\s*\+\+)/gs,
      /(let|var|const)\s+(\w+)\s*=.*;(?=.*\2\s*--)/gs,
      /this\.\w+\s*=\s*.*;(?=.*this\.\w+)/gs,
    ],
    description: 'Shared state modifications without synchronization',
  },
  'Missing Async/Await': {
    patterns: [
      /async\s+function[^{]*\{[^}]*then\s*\(/g,
      /new\s+Promise[^}]*\}\s*(?!await)/g,
    ],
    description: 'Potential race condition from mixing async patterns',
  },
};

export const MEMORY_PATTERNS = {
  'Event Listener Leaks': {
    patterns: [
      /addEventListener\s*\([^)]*\)(?!\s*removeEventListener)/g,
      /\.on\s*\([^)]*\)(?!\s*\.off|\.removeListener)/g,
    ],
    description: 'Event listeners added without corresponding removal',
  },
  'Timer Leaks': {
    patterns: [
      /setInterval\s*\([^)]*\)(?!\s*clearInterval)/g,
      /setTimeout\s*\([^)]*\)(?!\s*clearTimeout)/g,
    ],
    description: 'Intervals or timers set without cleanup',
  },
};

export const PERFORMANCE_PATTERNS = {
  'Inefficient Loops': {
    patterns: [
      /for\s*\([^;]*;\s*[^;]*\.length\s*;/g,
      /while\s*\([^}]*\.length\s*>/g,
    ],
    description: 'Loop conditions recalculating .length on each iteration',
  },
  'Sync File Ops': {
    patterns: [
      /readFileSync\s*\(/g,
      /writeFileSync\s*\(/g,
    ],
    description: 'Synchronous operations may block event loop',
  },
};

export const UNRESOLVED_PATTERNS = {
  'TODO/FIXME': {
    patterns: [
      /\/\/\s*(TODO|FIXME|HACK|XXX)\b/gi,
      /\/\*\s*(TODO|FIXME|HACK|XXX)\b/gi,
    ],
    description: 'Unresolved technical debt',
  },
  'Debug Statements': {
    patterns: [
      /console\.(log|debug)\s*\(/g,
      /debugger\s*;/g,
    ],
    description: 'Debug statements left in code',
  },
};
