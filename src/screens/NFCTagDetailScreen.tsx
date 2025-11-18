import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

interface NFCTagDetailScreenProps {
  route: {
    params: {
      tagId: string;
      tagType: string;
      techTypes: string[];
    };
  };
  navigation: any;
}

const NFCTagDetailScreen = ({ route, navigation }: NFCTagDetailScreenProps) => {
  const { tagId, tagType, techTypes = [] } = route.params;

  // Calculate optimal layout for hex editor
  // Use 8 bytes per row for mobile screens
  const screenWidth = Dimensions.get('window').width;
  const bytesPerRow = 8;

  // Use smaller font since modal makes editing easy
  const fontSize = 13;

  console.log(
    `📏 Screen: ${screenWidth.toFixed(
      0,
    )}px, Font: ${fontSize}pt, ${bytesPerRow} bytes/row`,
  );

  // Determine which NFC technology to use based on what the tag supports
  const getTechToUse = () => {
    if (!techTypes || techTypes.length === 0) return NfcTech.NfcV; // Default for ST25DV
    if (techTypes.includes('android.nfc.tech.NfcV')) return NfcTech.NfcV;
    if (techTypes.includes('android.nfc.tech.Ndef')) return NfcTech.Ndef;
    if (techTypes.includes('android.nfc.tech.NfcA')) return NfcTech.NfcA;
    return NfcTech.NfcV; // Default to NfcV for ST25DV
  };
  const [memoryData, setMemoryData] = useState<string>('');
  const [editedData, setEditedData] = useState<string>('');
  const [isReading, setIsReading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [showAscii, setShowAscii] = useState(true); // Default show ASCII
  const [startBlock, setStartBlock] = useState('0');
  const [numBlocks, setNumBlocks] = useState('16');
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [editingByteIndex, setEditingByteIndex] = useState<number | null>(null);
  const [editingByteValue, setEditingByteValue] = useState('');

  // Check if data has been modified
  const hasChanges = editedData !== memoryData && memoryData !== '';

  // Get bytes as array
  const getBytes = () => {
    return editedData.split(/\s+/).filter(h => h.length > 0);
  };

  // Update a specific byte
  const updateByte = (index: number, value: string) => {
    const bytes = getBytes();
    if (index >= 0 && index < bytes.length) {
      bytes[index] = value.toUpperCase().padStart(2, '0');
      setEditedData(bytes.join(' '));
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: `Tag: ${tagId.substring(0, 12)}...`,
    });

    // Try to detect if we already have an active NFC session from the scanner
    const detectExistingSession = async () => {
      try {
        // Try to get the tag without requesting technology
        const tag = await NfcManager.getTag();
        if (tag && tag.id) {
          // Session is active!
          console.log(
            '🟢 DETAIL SCREEN: Detected existing ACTIVE session from scanner!',
          );
          setHasActiveSession(true);
        } else {
          console.log('🔴 DETAIL SCREEN: No active session detected');
        }
      } catch (e) {
        console.log('🔴 DETAIL SCREEN: No active session (error checking):', e);
      }
    };

    detectExistingSession();

    // Cleanup NFC connection when leaving the screen
    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, [tagId, navigation]);

  const readMemory = async () => {
    try {
      setIsReading(true);
      console.log('=== READ MEMORY START ===');
      console.log(`Starting memory read, techTypes: ${techTypes.join(', ')}`);
      console.log(`Has active session: ${hasActiveSession}`);

      // Only request technology if we don't have an active session
      if (!hasActiveSession) {
        const techToUse = getTechToUse();
        console.log(
          '🔴 READ: No active session, requesting technology:',
          techToUse,
        );

        await NfcManager.requestTechnology(techToUse, {
          alertMessage: 'Ready to read - lift tag then bring near phone',
          timeout: 15000,
        });

        setHasActiveSession(true);
        console.log('🟢 READ: Session now ACTIVE');
      } else {
        console.log('🟢 READ: Using existing ACTIVE session - no lift needed!');
      }

      // Read memory using ISO15693 commands (ST25DV)
      let memoryHex = '';
      const startBlockNum = parseInt(startBlock) || 0;
      const numBlocksNum = parseInt(numBlocks) || 16;

      console.log(
        `Reading blocks ${startBlockNum} to ${
          startBlockNum + numBlocksNum - 1
        }`,
      );

      // ISO15693 Read Single Block command
      for (let i = startBlockNum; i < startBlockNum + numBlocksNum; i++) {
        try {
          let cmd;
          if (i <= 255) {
            // Standard Read Single Block (0x20) for blocks 0-255
            // Use flag 0x02 (high data rate, inventory mode - no UID needed)
            cmd = [0x02, 0x20, i];
          } else {
            // Extended Read Single Block (0x30) for blocks > 255
            const blockLSB = i & 0xff;
            const blockMSB = (i >> 8) & 0xff;
            cmd = [0x02, 0x30, blockLSB, blockMSB];
          }

          console.log(`Sending read command for block ${i}:`, cmd);
          const response = (await NfcManager.transceive(cmd)) as number[];
          console.log(`Response for block ${i}:`, response);

          if (response && response.length > 0) {
            // ST25DV blocks are 4 bytes each
            // Response format: [status_byte, data_bytes...]
            const dataBytes = response.slice(1); // Skip status byte
            if (dataBytes.length >= 4) {
              const bytes = dataBytes.slice(0, 4);
              memoryHex +=
                Array.from(bytes)
                  .map(b => b.toString(16).padStart(2, '0'))
                  .join(' ') + '\n';
              console.log(
                `Read block ${i}: ${bytes.length} bytes - ${bytes
                  .map(b => b.toString(16).padStart(2, '0'))
                  .join(' ')}`,
              );
            } else {
              console.log(`Block ${i} response too short:`, dataBytes.length);
            }
          }
        } catch (e: any) {
          console.log(`Failed to read block ${i}:`, e.message || e);
          // Continue trying next blocks
        }
      }

      // DON'T release session - keep it alive for subsequent writes!
      setIsReading(false);

      if (memoryHex) {
        setMemoryData(memoryHex.trim());
        setEditedData(memoryHex.trim());
        Alert.alert(
          'Success',
          `Read ${
            memoryHex.split('\n').length
          } blocks. Tag must stay near phone for writes.`,
        );
      } else {
        Alert.alert(
          'Read Failed',
          'Could not read any memory blocks. This tag may not support memory read commands, or you may need to adjust the start block and number of blocks.',
        );
      }
    } catch (error: any) {
      console.error('Read memory error:', error);
      console.error('Error details:', JSON.stringify(error));
      await NfcManager.cancelTechnologyRequest().catch(() => {});
      setHasActiveSession(false);
      setIsReading(false);
      Alert.alert(
        'Error',
        `Failed to read memory: ${
          error.message || error.toString() || 'Unknown error'
        }`,
      );
    }
  };

  const writeMemory = async () => {
    try {
      setIsWriting(true);

      // Parse edited hex data
      const hexBytes = editedData
        .replace(/\n/g, ' ')
        .split(/\s+/)
        .filter(h => h.length > 0)
        .map(h => parseInt(h, 16));

      if (hexBytes.some(b => isNaN(b) || b < 0 || b > 255)) {
        Alert.alert('Invalid Data', 'Please enter valid hex values (00-FF)');
        setIsWriting(false);
        return;
      }

      // Request technology if we don't have an active session
      if (!hasActiveSession) {
        const techToUse = getTechToUse();
        console.log(`Write: Requesting technology: ${techToUse}`);

        await NfcManager.requestTechnology(techToUse, {
          alertMessage: 'Ready to write - bring NFC tag near phone now',
          timeout: 15000,
        });

        setHasActiveSession(true);
        console.log('Write: Technology requested, session now active');
      } else {
        console.log('Write: Using existing active session');
      }

      const startBlockNum = parseInt(startBlock) || 0;

      // Write blocks using ISO15693 Write Single Block command
      // ST25DV blocks are 4 bytes each
      let blockIndex = startBlockNum;
      for (let i = 0; i < hexBytes.length; i += 4) {
        const blockData = hexBytes.slice(i, i + 4);

        // Pad block if needed (ST25DV blocks are 4 bytes)
        while (blockData.length < 4) {
          blockData.push(0);
        }

        try {
          let cmd;
          if (blockIndex <= 255) {
            // Standard Write Single Block (0x21) for blocks 0-255
            // Format: [flags, command, block_number, data_bytes...]
            // flags: 0x42 (high data rate + option flag for write)
            cmd = [0x42, 0x21, blockIndex, ...blockData];
          } else {
            // Extended Write Single Block (0x31) for blocks > 255
            const blockLSB = blockIndex & 0xff;
            const blockMSB = (blockIndex >> 8) & 0xff;
            cmd = [0x42, 0x31, blockLSB, blockMSB, ...blockData];
          }

          await NfcManager.transceive(cmd);
        } catch (e) {
          console.error(`Failed to write block ${blockIndex}:`, e);
          throw new Error(`Failed to write block ${blockIndex}`);
        }

        blockIndex++;
      }

      // Keep session alive for more operations
      setIsWriting(false);
      Alert.alert('Success', 'Written to tag!');
      setMemoryData(editedData);
    } catch (error: any) {
      console.error('Write memory error:', error);
      await NfcManager.cancelTechnologyRequest().catch(() => {});
      setHasActiveSession(false);
      setIsWriting(false);
      Alert.alert('Write Error', `Failed: ${error.message || 'Unknown error'}`);
    }
  };

  const formatHexWithLineNumbers = (hex: string) => {
    // Parse all hex bytes
    const allBytes = hex.split(/\s+/).filter(h => h.length > 0);
    const result: string[] = [];

    for (let i = 0; i < allBytes.length; i += bytesPerRow) {
      const lineBytes = allBytes.slice(i, i + bytesPerRow);
      const address = ((parseInt(startBlock) || 0) * 4 + i)
        .toString(16)
        .padStart(4, '0')
        .toUpperCase();
      const hexLine = lineBytes.map(b => b.toUpperCase()).join(' ');
      result.push(`${address}  ${hexLine}`);
    }

    return result.join('\n');
  };

  const hexToAscii = (hexString: string): string => {
    const lines = hexString.split('\n');
    return lines
      .map(line => {
        const bytes = line.split(/\s+/).filter(h => h.length > 0);
        return bytes
          .map(hex => {
            const byte = parseInt(hex, 16);
            // Display printable ASCII characters, otherwise show '.'
            return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
          })
          .join('');
      })
      .join('\n');
  };

  const formatHexWithAscii = (hex: string): string => {
    // Parse all hex bytes
    const allBytes = hex.split(/\s+/).filter(h => h.length > 0);
    const result: string[] = [];

    for (let i = 0; i < allBytes.length; i += bytesPerRow) {
      const lineBytes = allBytes.slice(i, i + bytesPerRow);
      const address = ((parseInt(startBlock) || 0) * 4 + i)
        .toString(16)
        .padStart(4, '0')
        .toUpperCase();
      // 16 bytes hex = "XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX" = 47 chars
      const hexLine = lineBytes
        .map(b => b.toUpperCase())
        .join(' ')
        .padEnd(bytesPerRow * 3 - 1, ' ');
      const ascii = lineBytes
        .map(h => {
          const byte = parseInt(h, 16);
          return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
        })
        .join('');
      result.push(`${address}  ${hexLine}  ${ascii}`);
    }

    return result.join('\n');
  };

  const copyToClipboard = () => {
    const dataWithLineNumbers = showAscii
      ? formatHexWithAscii(memoryData)
      : formatHexWithLineNumbers(memoryData);
    Clipboard.setString(dataWithLineNumbers);
    Alert.alert('Copied', 'Memory data copied to clipboard');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>NFC Tag Memory Editor</Text>
        <Text style={styles.subHeaderText}>Tag ID: {tagId}</Text>
        <Text style={styles.subHeaderText}>Type: {tagType}</Text>
        <Text
          style={[
            styles.subHeaderText,
            hasActiveSession ? styles.sessionActive : styles.sessionInactive,
          ]}
        >
          Session: {hasActiveSession ? '✓ ACTIVE' : '✗ INACTIVE'}
        </Text>
      </View>

      <View style={styles.configSection}>
        <Text style={styles.sectionTitle}>Read Configuration</Text>
        <View style={styles.configRow}>
          <Text style={styles.configLabel}>Start Block:</Text>
          <TextInput
            style={styles.configInput}
            value={startBlock}
            onChangeText={setStartBlock}
            keyboardType="numeric"
            placeholder="0"
          />
          <Text style={styles.configLabel}>Blocks:</Text>
          <TextInput
            style={styles.configInput}
            value={numBlocks}
            onChangeText={setNumBlocks}
            keyboardType="numeric"
            placeholder="16"
          />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.readButton]}
          onPress={readMemory}
          disabled={isReading || isWriting}
        >
          {isReading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>📖 Read</Text>
          )}
        </TouchableOpacity>

        {hasChanges && (
          <TouchableOpacity
            style={[styles.button, styles.writeButton]}
            onPress={writeMemory}
            disabled={isWriting}
          >
            {isWriting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>💾 Write Changes</Text>
            )}
          </TouchableOpacity>
        )}

        {memoryData && (
          <TouchableOpacity
            style={[styles.button, styles.toggleButton]}
            onPress={() => setShowAscii(!showAscii)}
          >
            <Text style={styles.buttonText}>
              {showAscii ? 'Hex' : 'Hex+ASCII'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {memoryData && (
        <View style={styles.editorSection}>
          <View style={styles.hexInfo}>
            <Text style={styles.hexInfoText}>
              {getBytes().length} bytes | {bytesPerRow} bytes/row | Offset: 0x
              {((parseInt(startBlock) || 0) * 4)
                .toString(16)
                .toUpperCase()}{' '}
              {hasChanges && '| ⚠️ Modified'}
            </Text>
          </View>

          <ScrollView style={styles.hexEditor}>
            {(() => {
              const bytes = getBytes();
              const rows: JSX.Element[] = [];

              for (let i = 0; i < bytes.length; i += bytesPerRow) {
                const rowBytes = bytes.slice(i, i + bytesPerRow);
                const address = ((parseInt(startBlock) || 0) * 4 + i)
                  .toString(16)
                  .padStart(4, '0')
                  .toUpperCase();

                rows.push(
                  <View key={i} style={styles.hexRow}>
                    <Text
                      style={[styles.hexAddress, { fontSize: fontSize * 0.9 }]}
                    >
                      {address}
                    </Text>

                    <View style={styles.hexBytesContainer}>
                      {rowBytes.map((byte, idx) => (
                        <TouchableOpacity
                          key={i + idx}
                          style={styles.hexByte}
                          onPress={() => {
                            setEditingByteIndex(i + idx);
                            setEditingByteValue(byte);
                          }}
                        >
                          <Text style={[styles.hexByteText, { fontSize }]}>
                            {byte.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {showAscii && (
                      <View style={styles.asciiContainer}>
                        <Text style={[styles.asciiText, { fontSize }]}>
                          {rowBytes
                            .map(h => {
                              const b = parseInt(h, 16);
                              return b >= 32 && b <= 126
                                ? String.fromCharCode(b)
                                : '.';
                            })
                            .join('')}
                        </Text>
                      </View>
                    )}
                  </View>,
                );
              }

              return rows;
            })()}
          </ScrollView>
        </View>
      )}

      {/* Edit Byte Modal */}
      {editingByteIndex !== null && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit Byte at 0x
              {((parseInt(startBlock) || 0) * 4 + editingByteIndex)
                .toString(16)
                .toUpperCase()}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editingByteValue}
              onChangeText={setEditingByteValue}
              maxLength={2}
              autoCapitalize="characters"
              autoFocus
              selectTextOnFocus
              keyboardType="ascii-capable"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setEditingByteIndex(null)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={() => {
                  if (/^[0-9A-Fa-f]{1,2}$/.test(editingByteValue)) {
                    updateByte(editingByteIndex, editingByteValue);
                  }
                  setEditingByteIndex(null);
                }}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {!memoryData && !isReading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            📱 Hold your phone near the NFC tag and tap "Read Memory" to view
            its contents
          </Text>
        </View>
      )}
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
    alignItems: 'center',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  subHeaderText: {
    fontSize: 12,
    color: 'white',
    marginTop: 5,
  },
  sessionActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  sessionInactive: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  configSection: {
    backgroundColor: 'white',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  configLabel: {
    fontSize: 14,
    color: '#333',
    marginRight: 10,
  },
  configInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 5,
    padding: 8,
    fontSize: 14,
    color: '#333',
    marginRight: 10,
  },
  controls: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-between',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  readButton: {
    backgroundColor: '#007AFF',
  },
  toggleButton: {
    backgroundColor: '#8E8E93',
  },
  writeButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  editorSection: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  toggleButton: {
    color: '#FF9500',
    fontSize: 14,
    marginRight: 12,
  },
  copyButton: {
    color: '#007AFF',
    fontSize: 14,
  },
  hexEditor: {
    flex: 1,
    backgroundColor: '#0D1117',
    padding: 8,
  },
  hexRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
  },
  hexAddress: {
    fontFamily: 'monospace',
    color: '#8B949E',
    marginRight: 12,
    width: 40,
  },
  hexBytesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  hexByte: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 2,
  },
  hexByteText: {
    fontFamily: 'monospace',
    color: '#58A6FF',
    fontWeight: '600',
  },
  asciiContainer: {
    marginLeft: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#30363D',
    backgroundColor: '#161B22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  asciiText: {
    fontFamily: 'monospace',
    color: '#C9D1D9',
    letterSpacing: 1,
  },
  hexInfo: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#161B22',
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  hexInfoText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#8B949E',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C9D1D9',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#0D1117',
    borderWidth: 2,
    borderColor: '#58A6FF',
    borderRadius: 8,
    padding: 16,
    fontSize: 32,
    fontFamily: 'monospace',
    color: '#58A6FF',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#8E8E93',
  },
  modalButtonSave: {
    backgroundColor: '#34C759',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default NFCTagDetailScreen;
