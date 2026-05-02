import { describe, it, expect } from 'vitest';
import { validateStringParam, validateDirPath } from '../build/index.js';

describe('validateStringParam', () => {
  it('should accept valid strings', () => {
    expect(validateStringParam('hello', 'test')).toBe('hello');
    expect(validateStringParam('  world  ', 'test')).toBe('world');
  });

  it('should reject non-strings', () => {
    expect(() => validateStringParam(123, 'test')).toThrow('Invalid test: must be a non-empty string');
    expect(() => validateStringParam(null, 'test')).toThrow('Invalid test: must be a non-empty string');
    expect(() => validateStringParam(undefined, 'test')).toThrow('Invalid test: must be a non-empty string');
  });

  it('should reject empty strings', () => {
    expect(() => validateStringParam('', 'test')).toThrow('Invalid test: must be a non-empty string');
    expect(() => validateStringParam('   ', 'test')).toThrow('Invalid test: must be a non-empty string');
  });
});

describe('validateDirPath', () => {
  it('should accept valid paths', () => {
    const result1 = validateDirPath('/home/user/project');
    expect(result1).toBe('/home/user/project');
    
    const result2 = validateDirPath('./relative/path');
    expect(result2).toMatch(/\/.*\/relative\/path/);
  });

  it('should handle paths with .. segments', () => {
    // These paths resolve to valid locations, so they should not throw
    // The validator ensures the resolved path is valid
    expect(() => validateDirPath('/home/../etc/passwd')).not.toThrow();
    expect(() => validateDirPath('../../etc/passwd')).not.toThrow();
  });
});
