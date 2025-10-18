// Centralized logging system for Mikrod Util

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: 'NFC' | 'BLE' | 'SYSTEM';
  message: string;
  details?: any;
}

type LogListener = (log: LogEntry) => void;

class Logger {
  private logs: LogEntry[] = [];
  private listeners: LogListener[] = [];
  private maxLogs = 1000;
  private logCounter = 0;

  subscribe(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(log: LogEntry) {
    this.listeners.forEach(listener => listener(log));
  }

  private addLog(level: LogLevel, category: 'NFC' | 'BLE' | 'SYSTEM', message: string, details?: any) {
    const log: LogEntry = {
      id: `log-${this.logCounter++}-${Date.now()}`,
      timestamp: new Date(),
      level,
      category,
      message,
      details,
    };

    this.logs.push(log);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.notify(log);

    // Also log to console in debug mode
    if (__DEV__) {
      const prefix = `[${category}]`;
      switch (level) {
        case LogLevel.DEBUG:
          console.log(prefix, message, details);
          break;
        case LogLevel.INFO:
          console.info(prefix, message, details);
          break;
        case LogLevel.SUCCESS:
          console.log(prefix, '✓', message, details);
          break;
        case LogLevel.WARNING:
          console.warn(prefix, message, details);
          break;
        case LogLevel.ERROR:
          console.error(prefix, message, details);
          break;
      }
    }
  }

  debug(category: 'NFC' | 'BLE' | 'SYSTEM', message: string, details?: any) {
    this.addLog(LogLevel.DEBUG, category, message, details);
  }

  info(category: 'NFC' | 'BLE' | 'SYSTEM', message: string, details?: any) {
    this.addLog(LogLevel.INFO, category, message, details);
  }

  success(category: 'NFC' | 'BLE' | 'SYSTEM', message: string, details?: any) {
    this.addLog(LogLevel.SUCCESS, category, message, details);
  }

  warning(category: 'NFC' | 'BLE' | 'SYSTEM', message: string, details?: any) {
    this.addLog(LogLevel.WARNING, category, message, details);
  }

  error(category: 'NFC' | 'BLE' | 'SYSTEM', message: string, details?: any) {
    this.addLog(LogLevel.ERROR, category, message, details);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.notify({
      id: `log-clear-${Date.now()}`,
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: 'SYSTEM',
      message: 'Logs cleared',
    });
  }

  exportLogs(): string {
    return this.logs.map(log => {
      const time = log.timestamp.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      });
      const details = log.details ? ` | ${JSON.stringify(log.details)}` : '';
      return `${time} [${log.level}] [${log.category}] ${log.message}${details}`;
    }).join('\n');
  }
}

export const logger = new Logger();
