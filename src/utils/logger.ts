// Enhanced logging system for Mikrod Util

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  SUCCESS = 2,
  WARNING = 3,
  ERROR = 4,
}

export interface LogEntry {
  id: string;
  timestamp: string; // ISO string for consistency
  level: LogLevel;
  levelName: string; // Human readable level name
  category: string; // Dynamic categories
  message: string;
  details?: any;
  sessionId: string;
  userId?: string;
  deviceInfo?: {
    platform: string;
    version: string;
    appVersion: string;
  };
  performance?: {
    duration?: number;
    memoryUsage?: number;
    operation?: string;
  };
  tags?: string[];
}

export interface LogConfig {
  maxLogs: number;
  persistToStorage: boolean;
  enableConsole: boolean;
  minLogLevel: LogLevel;
  enablePerformanceTracking: boolean;
  retentionDays: number;
}

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: any;
}

type LogListener = (log: LogEntry) => void;

class Logger {
  private logs: LogEntry[] = [];
  private listeners: LogListener[] = [];
  private config: LogConfig = {
    maxLogs: 5000,
    persistToStorage: true,
    enableConsole: true,
    minLogLevel: __DEV__ ? LogLevel.DEBUG : LogLevel.INFO,
    enablePerformanceTracking: true,
    retentionDays: 7,
  };
  private logCounter = 0;
  private sessionId: string;
  private performanceMetrics: Map<string, PerformanceMetric> = new Map();
  private storageKey = '@mikrod_util_logs';
  private configKey = '@mikrod_util_log_config';

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeLogger();
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }

  private async initializeLogger() {
    try {
      await this.loadConfig();
      if (this.config.persistToStorage) {
        await this.loadLogs();
      }
      this.cleanupOldLogs();
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  private async loadConfig() {
    try {
      const savedConfig = await AsyncStorage.getItem(this.configKey);
      if (savedConfig) {
        this.config = { ...this.config, ...JSON.parse(savedConfig) };
      }
    } catch (error) {
      console.warn('Failed to load log config:', error);
    }
  }

  private async saveConfig() {
    try {
      await AsyncStorage.setItem(this.configKey, JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save log config:', error);
    }
  }

  private async loadLogs() {
    try {
      const savedLogs = await AsyncStorage.getItem(this.storageKey);
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs) as LogEntry[];
        this.logs = parsedLogs.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        this.logCounter =
          Math.max(
            ...this.logs.map(log => parseInt(log.id.split('-')[1] || '0')),
          ) + 1;
      }
    } catch (error) {
      console.warn('Failed to load logs from storage:', error);
    }
  }

  private async persistLogs() {
    if (!this.config.persistToStorage) return;

    try {
      const logsToSave = this.logs.slice(0, this.config.maxLogs);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(logsToSave));
    } catch (error) {
      console.warn('Failed to persist logs:', error);
    }
  }

  private cleanupOldLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    this.logs = this.logs.filter(
      log => new Date(log.timestamp).getTime() > cutoffDate.getTime(),
    );
  }

  private getDeviceInfo() {
    return {
      platform: Platform.OS,
      version: Platform.Version.toString(),
      appVersion: '0.0.1', // Should come from package.json
    };
  }

  subscribe(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(log: LogEntry) {
    this.listeners.forEach(listener => listener(log));
  }

  private addLog(
    level: LogLevel,
    category: string,
    message: string,
    details?: any,
    tags?: string[],
    performance?: any,
  ) {
    if (level < this.config.minLogLevel) return;

    const log: LogEntry = {
      id: `log-${this.logCounter++}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level,
      levelName: LogLevel[level],
      category,
      message,
      details,
      sessionId: this.sessionId,
      deviceInfo: this.getDeviceInfo(),
      tags,
      performance,
    };

    this.logs.unshift(log); // Add to beginning for newest first

    // Keep only the last maxLogs entries
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(0, this.config.maxLogs);
    }

    this.notify(log);
    this.persistLogs();

    // Also log to console in debug mode
    if (this.config.enableConsole && __DEV__) {
      const prefix = `[${category}]`;
      const levelName = LogLevel[level];
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

  // Enhanced logging methods with dynamic categories
  debug(category: string, message: string, details?: any, tags?: string[]) {
    this.addLog(LogLevel.DEBUG, category, message, details, tags);
  }

  info(category: string, message: string, details?: any, tags?: string[]) {
    this.addLog(LogLevel.INFO, category, message, details, tags);
  }

  success(category: string, message: string, details?: any, tags?: string[]) {
    this.addLog(LogLevel.SUCCESS, category, message, details, tags);
  }

  warning(category: string, message: string, details?: any, tags?: string[]) {
    this.addLog(LogLevel.WARNING, category, message, details, tags);
  }

  error(category: string, message: string, details?: any, tags?: string[]) {
    this.addLog(LogLevel.ERROR, category, message, details, tags);
  }

  // Performance tracking methods
  startPerformanceTimer(operation: string, metadata?: any): string {
    if (!this.config.enablePerformanceTracking) return '';

    const timerId = `${operation}-${Date.now()}`;
    const metric: PerformanceMetric = {
      operation,
      startTime: Date.now(),
      metadata,
    };

    this.performanceMetrics.set(timerId, metric);
    return timerId;
  }

  endPerformanceTimer(timerId: string, details?: any) {
    if (!this.config.enablePerformanceTracking || !timerId) return;

    const metric = this.performanceMetrics.get(timerId);
    if (!metric) return;

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;

    this.addLog(
      LogLevel.INFO,
      'PERFORMANCE',
      `Operation completed: ${metric.operation}`,
      { ...details, duration: `${metric.duration}ms` },
      ['performance'],
      {
        operation: metric.operation,
        duration: metric.duration,
        metadata: metric.metadata,
      },
    );

    this.performanceMetrics.delete(timerId);
  }

  // Configuration methods
  updateConfig(newConfig: Partial<LogConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  getConfig(): LogConfig {
    return { ...this.config };
  }

  // Log management methods
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  getLogsByTags(tags: string[]): LogEntry[] {
    return this.logs.filter(
      log => log.tags && tags.some(tag => log.tags!.includes(tag)),
    );
  }

  searchLogs(query: string): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.logs.filter(
      log =>
        log.message.toLowerCase().includes(lowerQuery) ||
        log.category.toLowerCase().includes(lowerQuery) ||
        (log.details &&
          JSON.stringify(log.details).toLowerCase().includes(lowerQuery)),
    );
  }

  async clearLogs() {
    this.logs = [];
    await AsyncStorage.removeItem(this.storageKey);

    this.addLog(
      LogLevel.INFO,
      'SYSTEM',
      'Logs cleared',
      { clearedAt: new Date().toISOString() },
      ['system'],
    );
  }

  // Export methods
  exportLogs(format: 'json' | 'csv' | 'txt' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.logs, null, 2);

      case 'csv':
        const headers = [
          'timestamp',
          'level',
          'category',
          'message',
          'details',
          'tags',
          'sessionId',
        ].join(',');

        const rows = this.logs.map(log =>
          [
            log.timestamp,
            log.levelName,
            log.category,
            `"${log.message.replace(/"/g, '""')}"`, // Escape quotes
            log.details
              ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"`
              : '',
            log.tags ? `"${log.tags.join(';')}"` : '',
            log.sessionId,
          ].join(','),
        );

        return [headers, ...rows].join('\n');

      case 'txt':
      default:
        return this.logs
          .map(log => {
            const date = new Date(log.timestamp);
            const time = date.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const ms = date.getMilliseconds().toString().padStart(3, '0');
            const details = log.details
              ? ` | ${JSON.stringify(log.details)}`
              : '';
            const tags = log.tags ? ` [${log.tags.join(', ')}]` : '';
            return `${time}.${ms} [${log.levelName}] [${log.category}]${tags} ${log.message}${details}`;
          })
          .join('\n');
    }
  }

  // Remote logging methods
  async exportToRemote(endpoint: string, apiKey?: string): Promise<boolean> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify({
          logs: this.logs,
          sessionId: this.sessionId,
          deviceInfo: this.getDeviceInfo(),
          exportedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.addLog(
        LogLevel.INFO,
        'SYSTEM',
        `Logs exported to remote endpoint: ${endpoint}`,
        { status: response.status },
        ['export', 'remote'],
      );

      return true;
    } catch (error) {
      this.addLog(
        LogLevel.ERROR,
        'SYSTEM',
        `Failed to export logs to remote endpoint: ${endpoint}`,
        { error: error instanceof Error ? error.message : String(error) },
        ['export', 'remote', 'error'],
      );
      return false;
    }
  }

  // Analytics methods
  getLogStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      bySession: {} as Record<string, number>,
      averagePerformance: 0,
      errorRate: 0,
    };

    this.logs.forEach(log => {
      // Count by level
      stats.byLevel[log.levelName] = (stats.byLevel[log.levelName] || 0) + 1;

      // Count by category
      stats.byCategory[log.category] =
        (stats.byCategory[log.category] || 0) + 1;

      // Count by session
      stats.bySession[log.sessionId] =
        (stats.bySession[log.sessionId] || 0) + 1;

      // Performance metrics
      if (log.performance?.duration) {
        stats.averagePerformance += log.performance.duration;
      }
    });

    // Calculate averages and rates
    const performanceLogs = this.logs.filter(log => log.performance?.duration);
    if (performanceLogs.length > 0) {
      stats.averagePerformance =
        stats.averagePerformance / performanceLogs.length;
    }

    const errorLogs = this.logs.filter(log => log.level >= LogLevel.WARNING);
    stats.errorRate =
      this.logs.length > 0 ? (errorLogs.length / this.logs.length) * 100 : 0;

    return stats;
  }
}

export const logger = new Logger();
