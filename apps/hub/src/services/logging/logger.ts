export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

const BUFFER_LIMIT = 200;
const logBuffer: LogEntry[] = [];

const pushEntry = (entry: LogEntry) => {
  logBuffer.push(entry);
  if (logBuffer.length > BUFFER_LIMIT) {
    logBuffer.splice(0, logBuffer.length - BUFFER_LIMIT);
  }
};

const write = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta,
  };

  pushEntry(entry);

  const output = `[hub:${level}] ${message}`;
  if (level === 'error') {
    console.error(output, meta ?? '');
    return;
  }
  if (level === 'warn') {
    console.warn(output, meta ?? '');
    return;
  }
  console.info(output, meta ?? '');
};

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
  getBuffer: (): LogEntry[] => [...logBuffer],
  clearBuffer: () => {
    logBuffer.splice(0, logBuffer.length);
  },
};
