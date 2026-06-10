import { SupportedLanguage } from "../supported-language.js";
import { loadConfig } from "../config.js";

const { safeBuiltins, safeBuiltinMethods: safeBuiltinMethodNames, bugPatterns } = loadConfig("patterns");

const SAFE_BUILTINS = safeBuiltins;
const SAFE_BUILTIN_METHODS = new Set(safeBuiltinMethodNames);

function isSafeCall(sanitized: string, matchIndex: number): boolean {
  const before = sanitized.substring(0, matchIndex);
  const fromMatch = sanitized.substring(matchIndex);
  
  for (const prefix of SAFE_BUILTINS) {
    if (before.endsWith(prefix)) return true;
    if (fromMatch.includes(prefix)) return true;
  }
  
  if (before.endsWith('.')) return true;
  
  const funcName = fromMatch.match(/^\w+/)?.[0];
  if (funcName && SAFE_BUILTIN_METHODS.has(funcName)) return true;
  
  return false;
}

function compile(name: string): RegExp[] {
  return (bugPatterns[name] || []).map((p: string) => new RegExp(p, 'g'));
}

const RUNTIME_PATTERNS = {
  'Unhandled Promise Rejection': {
    patterns: compile('unhandledPromise'),
    description: 'Promises or async operations without proper error handling',
  },
  'Null Dereference': {
    patterns: compile('nullDereference'),
    description: 'Potential null/undefined dereference on unchecked call result',
  },
};

const RACE_PATTERNS = {};

const MEMORY_PATTERNS = {
  'Event Listener Leaks': {
    patterns: compile('eventListenerLeaks'),
    description: 'Event listeners added without corresponding removal',
  },
  'Timer Leaks': {
    patterns: compile('timerLeaks'),
    description: 'Intervals or timers set without cleanup',
  },
};

const PERFORMANCE_PATTERNS = {
  'Inefficient Loops': {
    patterns: compile('inefficientLoops'),
    description: 'Loop conditions recalculating .length on each iteration',
  },
  'Sync File Ops': {
    patterns: compile('syncFileOps'),
    description: 'Synchronous operations blocking the event loop',
  },
  'Unbounded I/O': {
    patterns: compile('unboundedIO'),
    description: 'I/O operations inside unbounded loops',
  },
};

const UNRESOLVED_PATTERNS = {
  'TODO/FIXME': {
    patterns: compile('todo'),
    description: 'Unresolved technical debt',
  },
  'Debug Statements': {
    patterns: SupportedLanguage.all().flatMap(l =>
      l.debugPatterns.map(p => new RegExp(p, 'g'))
    ),
    description: 'Debug statements left in code',
  },
};

export {
  RUNTIME_PATTERNS,
  RACE_PATTERNS,
  MEMORY_PATTERNS,
  PERFORMANCE_PATTERNS,
  UNRESOLVED_PATTERNS,
  isSafeCall,
};
