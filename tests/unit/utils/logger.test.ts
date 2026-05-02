import { describe, it, expect, vi } from 'vitest';
import { logger } from '../../../src/utils/logger.js';

describe('logger', () => {
  it('should log messages in JSON format to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    logger.info('test message', { foo: 'bar' });
    
    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[0][0];
    const parsed = JSON.parse(lastCall);
    
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('test message');
    expect(parsed.foo).toBe('bar');
    expect(parsed.timestamp).toBeDefined();
    
    spy.mockRestore();
  });

  it('should log errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    logger.error('error message');
    
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.level).toBe('error');
    
    spy.mockRestore();
  });
});
