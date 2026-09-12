import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const MAX_LOG_BYTES = 5 * 1024 * 1024;

export class Logger {
  private readonly logDir: string;
  private readonly logFile: string;

  constructor(logDir: string) {
    this.logDir = logDir;
    this.logFile = path.join(logDir, 'app.log');
    fs.mkdirSync(logDir, { recursive: true });
    this.rotateIfNeeded();
  }

  private rotateIfNeeded(): void {
    try {
      const stats = fs.statSync(this.logFile);
      if (stats.size > MAX_LOG_BYTES) {
        const rotated = path.join(this.logDir, `app.${Date.now()}.log`);
        fs.renameSync(this.logFile, rotated);
      }
    } catch {
      // no existing log file yet — nothing to rotate
    }
  }

  private write(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      ...(meta ? { meta } : {}),
    };
    const line = `${JSON.stringify(entry)}\n`;
    fs.appendFile(this.logFile, line, () => {
      /* best-effort logging; a failed write must not crash the app */
    });
    if (level === 'error' || level === 'warn') {
      // eslint-disable-next-line no-console
      console[level](`[${scope}] ${message}`, meta ?? '');
    }
  }

  debug(scope: string, message: string, meta?: Record<string, unknown>): void {
    this.write('debug', scope, message, meta);
  }

  info(scope: string, message: string, meta?: Record<string, unknown>): void {
    this.write('info', scope, message, meta);
  }

  warn(scope: string, message: string, meta?: Record<string, unknown>): void {
    this.write('warn', scope, message, meta);
  }

  error(scope: string, message: string, meta?: Record<string, unknown>): void {
    this.write('error', scope, message, meta);
  }
}

let instance: Logger | undefined;

export function initLogger(logDir: string): Logger {
  instance = new Logger(logDir);
  return instance;
}

export function getLogger(): Logger {
  if (!instance) {
    throw new Error('Logger not initialized — call initLogger() first');
  }
  return instance;
}
