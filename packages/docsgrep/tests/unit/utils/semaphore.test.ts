import { describe, it, expect, vi } from 'vitest';
import { Semaphore } from '../../../src/utils/semaphore.js';

describe('Semaphore', () => {
  it('should allow acquiring multiple permits', async () => {
    const sem = new Semaphore(2);
    const release1 = await sem.acquire();
    const release2 = await sem.acquire();
    
    expect(release1).toBeDefined();
    expect(release2).toBeDefined();
    
    let acquired3 = false;
    sem.acquire().then(() => { acquired3 = true; });
    
    // Wait a bit to ensure it doesn't resolve
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(acquired3).toBe(false);
    
    release1();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(acquired3).toBe(true);
  });

  it('should handle queueing multiple requests', async () => {
    const sem = new Semaphore(1);
    const release1 = await sem.acquire();
    
    let acquired2 = false;
    let acquired3 = false;
    
    sem.acquire().then(() => { acquired2 = true; });
    sem.acquire().then(() => { acquired3 = true; });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(acquired2).toBe(false);
    expect(acquired3).toBe(false);
    
    release1();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(acquired2).toBe(true);
    expect(acquired3).toBe(false);
  });
});
