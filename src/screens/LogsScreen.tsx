import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Share,
  ScrollView,
} from 'react-native';
import { logger, LogEntry, LogLevel } from '../utils/logger';

export const LogsScreen = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<'ALL' | LogLevel | 'ERRORS_ONLY'>('ALL');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'NFC' | 'BLE' | 'SYSTEM'>('ALL');
  const [showDebug, setShowDebug] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Subscribe to new logs
    const unsubscribe = logger.subscribe((log) => {
      setLogs(prevLogs => [...prevLogs, log]);
      if (autoScroll) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    // Load existing logs
    setLogs(logger.getLogs());

    return unsubscribe;
  }, [autoScroll]);

  const getFilteredLogs = () => {
    let filtered = logs;

    // Filter by category
    if (filterCategory !== 'ALL') {
      filtered = filtered.filter(log => log.category === filterCategory);
    }

    // Filter by level
    if (filterLevel === 'ERRORS_ONLY') {
      filtered = filtered.filter(log => log.level === LogLevel.ERROR || log.level === LogLevel.WARNING);
    } else if (filterLevel !== 'ALL') {
      filtered = filtered.filter(log => log.level === filterLevel);
    }

    // Filter debug logs if disabled
    if (!showDebug) {
      filtered = filtered.filter(log => log.level !== LogLevel.DEBUG);
    }

    return filtered;
  };

  const handleClearLogs = () => {
    logger.clearLogs();
    setLogs([]);
  };

  const handleShareLogs = async () => {
    try {
      const logsText = logger.exportLogs();
      await Share.share({
        message: logsText,
        title: 'Mikrod Util Logs',
      });
    } catch (error) {
      console.error('Error sharing logs:', error);
    }
  };

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case LogLevel.DEBUG:
        return '#999';
      case LogLevel.INFO:
        return '#2196F3';
      case LogLevel.SUCCESS:
        return '#4CAF50';
      case LogLevel.WARNING:
        return '#FF9800';
      case LogLevel.ERROR:
        return '#F44336';
      default:
        return '#000';
    }
  };

  const getLevelIcon = (level: LogLevel): string => {
    switch (level) {
      case LogLevel.DEBUG:
        return '⚪';
      case LogLevel.INFO:
        return '🔵';
      case LogLevel.SUCCESS:
        return '🟢';
      case LogLevel.WARNING:
        return '🟡';
      case LogLevel.ERROR:
        return '🔴';
      default:
        return '⚫';
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const renderLogEntry = ({ item }: { item: LogEntry }) => (
    <View style={styles.logEntry}>
      <View style={styles.logHeader}>
        <Text style={styles.logTime}>{formatTime(item.timestamp)}</Text>
        <Text style={[styles.logLevel, { color: getLevelColor(item.level) }]}>
          {getLevelIcon(item.level)} {item.level}
        </Text>
        <Text style={styles.logCategory}>[{item.category}]</Text>
      </View>
      <Text style={styles.logMessage}>{item.message}</Text>
      {item.details && (
        <Text style={styles.logDetails}>{JSON.stringify(item.details, null, 2)}</Text>
      )}
    </View>
  );

  const filteredLogs = getFilteredLogs();

  return (
    <View style={styles.container}>
      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterButton, filterCategory === 'ALL' && styles.filterButtonActive]}
            onPress={() => setFilterCategory('ALL')}>
            <Text style={[styles.filterButtonText, filterCategory === 'ALL' && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filterCategory === 'NFC' && styles.filterButtonActive]}
            onPress={() => setFilterCategory('NFC')}>
            <Text style={[styles.filterButtonText, filterCategory === 'NFC' && styles.filterButtonTextActive]}>
              NFC
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filterCategory === 'BLE' && styles.filterButtonActive]}
            onPress={() => setFilterCategory('BLE')}>
            <Text style={[styles.filterButtonText, filterCategory === 'BLE' && styles.filterButtonTextActive]}>
              BLE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filterCategory === 'SYSTEM' && styles.filterButtonActive]}
            onPress={() => setFilterCategory('SYSTEM')}>
            <Text style={[styles.filterButtonText, filterCategory === 'SYSTEM' && styles.filterButtonTextActive]}>
              System
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filterLevel === 'ERRORS_ONLY' && styles.filterButtonActive]}
            onPress={() => setFilterLevel(filterLevel === 'ERRORS_ONLY' ? 'ALL' : 'ERRORS_ONLY')}>
            <Text style={[styles.filterButtonText, filterLevel === 'ERRORS_ONLY' && styles.filterButtonTextActive]}>
              🔴 Errors Only
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, showDebug && styles.filterButtonActive]}
            onPress={() => setShowDebug(!showDebug)}>
            <Text style={[styles.filterButtonText, showDebug && styles.filterButtonTextActive]}>
              ⚪ Debug
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionButton, autoScroll && styles.actionButtonActive]}
          onPress={() => setAutoScroll(!autoScroll)}>
          <Text style={styles.actionButtonText}>
            {autoScroll ? '📌' : '📌'} Auto-scroll
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShareLogs}>
          <Text style={styles.actionButtonText}>📤 Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleClearLogs}>
          <Text style={styles.actionButtonText}>🗑️ Clear</Text>
        </TouchableOpacity>

        <Text style={styles.logCount}>
          {filteredLogs.length} / {logs.length} logs
        </Text>
      </View>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No logs to display</Text>
          <Text style={styles.emptySubtext}>
            Logs will appear here as you use NFC and BLE features
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredLogs}
          renderItem={renderLogEntry}
          keyExtractor={item => item.id}
          style={styles.logsList}
          contentContainerStyle={styles.logsListContent}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterBar: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterScroll: {
    paddingHorizontal: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  actionButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  actionButtonText: {
    fontSize: 13,
    color: '#333',
  },
  logCount: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#999',
  },
  logsList: {
    flex: 1,
  },
  logsListContent: {
    padding: 12,
  },
  logEntry: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTime: {
    fontSize: 11,
    color: '#999',
    marginRight: 8,
    fontFamily: 'monospace',
  },
  logLevel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 8,
  },
  logCategory: {
    fontSize: 11,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logMessage: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  logDetails: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontFamily: 'monospace',
    backgroundColor: '#f9f9f9',
    padding: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#bbb',
    textAlign: 'center',
  },
});
