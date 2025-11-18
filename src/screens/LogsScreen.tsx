import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Share,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { logger, LogEntry, LogLevel } from '../utils/logger';

export const LogsScreen = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<
    'ALL' | LogLevel | 'ERRORS_ONLY'
  >('ALL');
  const [filterCategory, setFilterCategory] = useState<
    'ALL' | 'NFC' | 'BLE' | 'SYSTEM'
  >('ALL');
  const [showDebug, setShowDebug] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [phoneIp, setPhoneIp] = useState<string>('...');
  const [showStats, setShowStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Subscribe to new logs
    const unsubscribe = logger.subscribe(log => {
      setLogs(prevLogs => [...prevLogs, log]);
      if (autoScroll) {
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      }
    });

    // Load existing logs
    setLogs(logger.getLogs());

    return unsubscribe;
  }, [autoScroll]);

  useEffect(() => {
    // Fetch phone IP
    NetInfo.fetch().then(state => {
      const ip = (state.details as any)?.ipAddress || 'Unknown';
      setPhoneIp(ip);
    });
  }, []);

  const getFilteredLogs = () => {
    let filtered = logs;

    // Search filter
    if (searchQuery) {
      filtered = logger.searchLogs(searchQuery);
    }

    // Filter by category
    if (filterCategory !== 'ALL') {
      filtered = filtered.filter(log => log.category === filterCategory);
    }

    // Filter by level
    if (filterLevel === 'ERRORS_ONLY') {
      filtered = filtered.filter(
        log => log.level === LogLevel.ERROR || log.level === LogLevel.WARNING,
      );
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

  const handleShareLogs = async (format: 'json' | 'csv' | 'txt' = 'txt') => {
    try {
      const logsText = logger.exportLogs(format);
      await Share.share({
        message: logsText,
        title: `Mikrod Util Logs (${format.toUpperCase()})`,
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

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  };

  const renderLogEntry = ({ item }: { item: LogEntry }) => (
    <View style={styles.logEntry}>
      <View style={styles.logHeader}>
        <Text style={styles.logTime}>{formatTime(item.timestamp)}</Text>
        <Text style={[styles.logLevel, { color: getLevelColor(item.level) }]}>
          {getLevelIcon(item.level)} {item.levelName}
        </Text>
        <Text style={styles.logCategory}>[{item.category}]</Text>
      </View>
      <Text style={styles.logMessage}>{item.message}</Text>
      {item.details && (
        <Text style={styles.logDetails}>
          {JSON.stringify(item.details, null, 2)}
        </Text>
      )}
    </View>
  );

  const filteredLogs = getFilteredLogs();

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search logs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[styles.actionButton, showStats && styles.actionButtonActive]}
          onPress={() => setShowStats(!showStats)}
        >
          <Text style={styles.actionButtonText}>📊</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterCategory === 'ALL' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterCategory('ALL')}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterCategory === 'ALL' && styles.filterButtonTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterCategory === 'NFC' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterCategory('NFC')}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterCategory === 'NFC' && styles.filterButtonTextActive,
              ]}
            >
              NFC
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterCategory === 'BLE' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterCategory('BLE')}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterCategory === 'BLE' && styles.filterButtonTextActive,
              ]}
            >
              BLE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterCategory === 'SYSTEM' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterCategory('SYSTEM')}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterCategory === 'SYSTEM' && styles.filterButtonTextActive,
              ]}
            >
              System
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterLevel === 'ERRORS_ONLY' && styles.filterButtonActive,
            ]}
            onPress={() =>
              setFilterLevel(
                filterLevel === 'ERRORS_ONLY' ? 'ALL' : 'ERRORS_ONLY',
              )
            }
          >
            <Text
              style={[
                styles.filterButtonText,
                filterLevel === 'ERRORS_ONLY' && styles.filterButtonTextActive,
              ]}
            >
              🔴 Errors Only
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              showDebug && styles.filterButtonActive,
            ]}
            onPress={() => setShowDebug(!showDebug)}
          >
            <Text
              style={[
                styles.filterButtonText,
                showDebug && styles.filterButtonTextActive,
              ]}
            >
              ⚪ Debug
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <Text style={styles.phoneIpText}>IP: {phoneIp}</Text>

        <TouchableOpacity
          style={[styles.actionButton, autoScroll && styles.actionButtonActive]}
          onPress={() => setAutoScroll(!autoScroll)}
        >
          <Text style={styles.actionButtonText}>
            {autoScroll ? '📌' : '📌'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShareLogs('txt')}
        >
          <Text style={styles.actionButtonText}>📤</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleClearLogs}>
          <Text style={styles.actionButtonText}>🗑️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // Test enhanced logging features
            logger.info(
              'TEST',
              'Enhanced logging test started',
              { timestamp: Date.now() },
              ['test', 'demo'],
            );

            const timerId = logger.startPerformanceTimer('test-operation', {
              type: 'demo',
            });
            setTimeout(() => {
              logger.endPerformanceTimer(timerId, { result: 'success' });
              logger.success(
                'TEST',
                'Enhanced logging test completed',
                { features: ['persistence', 'search', 'stats', 'performance'] },
                ['demo'],
              );
            }, 1000);
          }}
        >
          <Text style={styles.actionButtonText}>🧪</Text>
        </TouchableOpacity>

        <Text style={styles.logCount}>
          {filteredLogs.length} / {logs.length}
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

      {/* Stats Modal */}
      <Modal
        visible={showStats}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStats(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Statistics</Text>
            <TouchableOpacity onPress={() => setShowStats(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {(() => {
              const stats = logger.getLogStats();
              return (
                <>
                  <View style={styles.statSection}>
                    <Text style={styles.statTitle}>Overview</Text>
                    <Text style={styles.statItem}>
                      Total Logs: {stats.total}
                    </Text>
                    <Text style={styles.statItem}>
                      Error Rate: {stats.errorRate.toFixed(1)}%
                    </Text>
                    <Text style={styles.statItem}>
                      Avg Performance: {stats.averagePerformance.toFixed(0)}ms
                    </Text>
                  </View>

                  <View style={styles.statSection}>
                    <Text style={styles.statTitle}>By Level</Text>
                    {Object.entries(stats.byLevel).map(([level, count]) => (
                      <Text key={level} style={styles.statItem}>
                        {level}: {count}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.statSection}>
                    <Text style={styles.statTitle}>By Category</Text>
                    {Object.entries(stats.byCategory).map(
                      ([category, count]) => (
                        <Text key={category} style={styles.statItem}>
                          {category}: {count}
                        </Text>
                      ),
                    )}
                  </View>
                </>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 14,
    marginRight: 8,
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
  phoneIpText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
    marginRight: 'auto',
  },
  logCount: {
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  statSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  statItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});
