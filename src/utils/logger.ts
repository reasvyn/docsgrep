/**
 * Structured logger for consistent logging across the application
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, meta?: Record<string, any>): void {
    console.error(
      JSON.stringify({
        level: 'info',
        context: this.context,
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    );
  }

  error(message: string, meta?: Record<string, any>): void {
    console.error(
      JSON.stringify({
        level: 'error',
        context: this.context,
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    );
  }

  warn(message: string, meta?: Record<string, any>): void {
    console.error(
      JSON.stringify({
        level: 'warn',
        context: this.context,
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    );
  }
}

export const logger = new Logger('docsgrep');
