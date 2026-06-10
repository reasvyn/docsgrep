/**
 * Concurrency limiter for controlling parallel operations
 */
export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        // permits is already 0 here, it will be decremented 
        // by the logic that called release() or when we are called
        // actually we should decrement it when we are about to resolve
        this.permits--;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.permits++;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}

export const operationLimiter = new Semaphore(5); // Max 5 concurrent operations
