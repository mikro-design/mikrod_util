import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcEvents } from 'react-native-nfc-manager';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface NFCData {
  id: string;
  type: string;
  techTypes: string[];
  ndefMessage?: any;
  timestamp: string;
}

const NFCReaderScreen = ({ navigation }: any) => {
  const [isNFCEnabled, setIsNFCEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [nfcData, setNfcData] = useState<NFCData[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for scanning state
  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isScanning, pulseAnim]);

  useEffect(() => {
    const initNFC = async () => {
      try {
        const supported = await NfcManager.isSupported();
        if (supported) {
          await NfcManager.start();
          setIsNFCEnabled(await NfcManager.isEnabled());
        } else {
          Alert.alert('NFC Not Supported', 'This device does not support NFC');
        }
      } catch (error) {
        console.error('NFC init error:', error);
        Alert.alert('NFC Error', 'Failed to initialize NFC');
      }
    };

    initNFC();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  const startNFCScan = async () => {
    if (isScanning) return;

    try {
      setIsScanning(true);

      // Clear existing scan results
      setNfcData([]);

      // Request NFC technology to enable foreground dispatch
      // Use NfcV (ISO15693) so the session works with transceive commands later
      await NfcManager.requestTechnology(NfcTech.NfcV, {
        alertMessage: 'Ready to scan - bring NFC tag near phone now',
        timeout: 15000,
      });

      // Get the tag that was just detected
      const tag = await NfcManager.getTag();

      console.log('Tag detected:', tag);

      if (tag) {
        const newTag: NFCData = {
          id: tag.id || 'Unknown',
          type: tag.type || 'Unknown',
          techTypes: tag.techTypes || [],
          ndefMessage: tag.ndefMessage,
          timestamp: new Date().toLocaleString(),
        };

        setNfcData(prev => {
          const isDuplicate = prev.some(t => t.id === newTag.id);
          if (isDuplicate) {
            return prev.map(t => t.id === newTag.id ? {...newTag} : t);
          }
          return [newTag, ...prev];
        });

        Alert.alert('NFC Tag Read', `Tag ID: ${newTag.id}\nTech: ${newTag.techTypes.join(', ')}`);
      }

      setIsScanning(false);
      // DON'T release session - keep it alive so detail screen can use it!
      console.log('🟢 SCAN: Session kept ACTIVE - navigate to detail screen to use it');

    } catch (error: any) {
      console.warn('NFC scan error:', error);
      Alert.alert('Scan Error', error.message || 'Failed to read NFC tag. Please tap "Scan" first, then bring tag near phone.');
      setIsScanning(false);
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  };

  const clearHistory = () => {
    setNfcData([]);
  };

  const parseNdefMessage = (message: any) => {
    if (!message || !Array.isArray(message)) return 'No NDEF data';

    return message.map((record: any, index: number) => {
      try {
        const payload = record.payload;
        if (payload) {
          // Try to decode as text
          const text = Ndef.text.decodePayload(new Uint8Array(payload));
          return `Record ${index + 1}: ${text}`;
        }
      } catch (e) {
        return `Record ${index + 1}: [Binary data]`;
      }
      return `Record ${index + 1}: [Empty]`;
    }).join('\n');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          <Icon name="nfc" size={28} color="white" />
          <Text style={styles.headerText}>NFC Tag Reader</Text>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
          <Icon
            name={isNFCEnabled ? "check-circle" : "close-circle"}
            size={16}
            color={isNFCEnabled ? "#34C759" : "#FF3B30"}
          />
          <Text style={styles.statusText}>
            {isNFCEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isScanning && styles.buttonDisabled]}
          onPress={startNFCScan}
          disabled={isScanning || !isNFCEnabled}>
          {isScanning ? (
            <Animated.View style={{
              marginRight: 8,
              transform: [{ scale: pulseAnim }],
            }}>
              <Icon name="nfc-search-variant" size={20} color="#FFFFFF" />
            </Animated.View>
          ) : (
            <Icon name="nfc-tap" size={20} color="#FFFFFF" style={{marginRight: 8}} />
          )}
          <Text style={styles.buttonText}>
            {isScanning ? 'Scanning...' : 'Scan NFC Tag'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearHistory}
          disabled={nfcData.length === 0}>
          <Icon name="delete-sweep" size={20} color="#FFFFFF" style={{marginRight: 8}} />
          <Text style={styles.buttonText}>Clear History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Icon
            name={isScanning ? "cellphone-nfc" : "hand-pointing-up"}
            size={20}
            color="#007AFF"
            style={{marginRight: 8}}
          />
          <Text style={styles.infoText}>
            {isScanning
              ? 'Bring NFC tag near phone now...'
              : 'Tap "Scan NFC Tag" then bring tag near phone (remove first if already near)'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.history}>
        <Text style={styles.historyTitle}>
          History ({nfcData.length} tags read)
        </Text>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
          <Icon name="lightbulb-on-outline" size={16} color="#FF9500" style={{marginRight: 4}} />
          <Text style={styles.infoHint}>
            Tap any tag to view/edit memory
          </Text>
        </View>
        {nfcData.map((tag, index) => (
          <TouchableOpacity
            key={`${tag.id}-${index}`}
            style={styles.tagCard}
            onPress={() => navigation.navigate('NFCTagDetail', {
              tagId: tag.id,
              tagType: tag.type,
              techTypes: tag.techTypes,
            })}>
            <Text style={styles.tagId}>ID: {tag.id}</Text>
            <Text style={styles.tagDetail}>Type: {tag.type}</Text>
            <Text style={styles.tagDetail}>
              Technologies: {tag.techTypes.join(', ')}
            </Text>
            {tag.ndefMessage && (
              <Text style={styles.tagDetail}>
                NDEF: {parseNdefMessage(tag.ndefMessage)}
              </Text>
            )}
            <Text style={styles.tagTimestamp}>{tag.timestamp}</Text>
            <Text style={styles.tapHint}>👆 Tap to view/edit memory</Text>
          </TouchableOpacity>
        ))}
        {nfcData.length === 0 && (
          <Text style={styles.emptyText}>No tags scanned yet</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  statusText: {
    fontSize: 14,
    color: 'white',
  },
  controls: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#8E8E93',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E8F4FF',
    padding: 15,
    marginHorizontal: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  history: {
    flex: 1,
    padding: 15,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  tagCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tagId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  tagDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  tagTimestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  tapHint: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 8,
    fontWeight: '600',
  },
  infoHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 20,
  },
});

export default NFCReaderScreen;
