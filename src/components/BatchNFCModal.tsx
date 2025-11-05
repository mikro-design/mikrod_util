import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

interface BatchNFCModalProps {
  visible: boolean;
  onClose: () => void;
  templateType: 'url' | 'text';
  baseData: string;
}

const BatchNFCModal: React.FC<BatchNFCModalProps> = ({
  visible,
  onClose,
  templateType,
  baseData,
}) => {
  const { theme } = useTheme();
  const [batchCount, setBatchCount] = useState('5');
  const [currentCount, setCurrentCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isWriting, setIsWriting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [writtenTags, setWrittenTags] = useState<string[]>([]);
  const [useSequentialNumbers, setUseSequentialNumbers] = useState(true);
  const [startNumber, setStartNumber] = useState('1');
  const shouldContinue = useRef(true);

  const startBatchWrite = async () => {
    const count = parseInt(batchCount) || 5;
    setTotalCount(count);
    setCurrentCount(0);
    setWrittenTags([]);
    setIsWriting(true);
    setIsPaused(false);
    shouldContinue.current = true;

    for (let i = 0; i < count; i++) {
      if (!shouldContinue.current) {
        break;
      }

      // Wait if paused
      while (isPaused && shouldContinue.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!shouldContinue.current) {
        break;
      }

      try {
        let dataToWrite = baseData;

        // Add sequential number if enabled
        if (useSequentialNumbers) {
          const seqNum = (parseInt(startNumber) || 1) + i;
          if (templateType === 'url') {
            dataToWrite = `${baseData}?id=${seqNum}`;
          } else if (templateType === 'text') {
            dataToWrite = `${baseData} #${seqNum}`;
          }
        }

        // Prepare NDEF message
        let bytes: number[] = [];
        if (templateType === 'url') {
          bytes = Ndef.encodeMessage([Ndef.uriRecord(dataToWrite)]);
        } else if (templateType === 'text') {
          bytes = Ndef.encodeMessage([Ndef.textRecord(dataToWrite)]);
        }

        // Request NFC and write
        await NfcManager.requestTechnology(NfcTech.Ndef, {
          alertMessage: `Tag ${i + 1}/${count}: Bring NFC tag near phone`,
        });

        await NfcManager.ndefHandler.writeNdefMessage(bytes);

        // Success
        setWrittenTags(prev => [...prev, `Tag ${i + 1}: ${dataToWrite}`]);
        setCurrentCount(i + 1);

        // Cancel technology for next tag
        await NfcManager.cancelTechnologyRequest();

        // Short delay between tags
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`Error writing tag ${i + 1}:`, error);

        // Ask user if they want to retry or skip
        const userChoice = await new Promise<'retry' | 'skip' | 'cancel'>((resolve) => {
          Alert.alert(
            `Error Writing Tag ${i + 1}`,
            error.message || 'Failed to write tag',
            [
              {
                text: 'Retry',
                onPress: () => resolve('retry'),
              },
              {
                text: 'Skip',
                onPress: () => resolve('skip'),
                style: 'cancel',
              },
              {
                text: 'Cancel Batch',
                onPress: () => resolve('cancel'),
                style: 'destructive',
              },
            ]
          );
        });

        if (userChoice === 'retry') {
          i--; // Retry current tag
        } else if (userChoice === 'cancel') {
          shouldContinue.current = false;
          break;
        }
        // Skip continues to next iteration

        await NfcManager.cancelTechnologyRequest().catch(() => {});
      }
    }

    setIsWriting(false);
    setIsPaused(false);

    if (currentCount === totalCount && shouldContinue.current) {
      Alert.alert('Batch Complete!', `Successfully wrote ${currentCount} tags`);
    }
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleStop = () => {
    shouldContinue.current = false;
    setIsWriting(false);
    setIsPaused(false);
    NfcManager.cancelTechnologyRequest().catch(() => {});
    Alert.alert('Batch Stopped', `Wrote ${currentCount}/${totalCount} tags`);
  };

  const handleClose = () => {
    if (isWriting) {
      Alert.alert(
        'Batch in Progress',
        'Are you sure you want to stop the batch operation?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop',
            style: 'destructive',
            onPress: () => {
              handleStop();
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Batch NFC Write
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Icon name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Configuration */}
            {!isWriting && (
              <View>
                <View style={[styles.infoCard, { backgroundColor: theme.colors.background }]}>
                  <Icon name="information" size={20} color={theme.colors.info} style={{ marginRight: 8 }} />
                  <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                    Write the same data to multiple NFC tags sequentially
                  </Text>
                </View>

                <Text style={[styles.label, { color: theme.colors.text }]}>Base Data:</Text>
                <View style={[styles.dataPreview, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.dataText, { color: theme.colors.text }]}>
                    {baseData}
                  </Text>
                </View>

                <Text style={[styles.label, { color: theme.colors.text }]}>Number of Tags:</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                    }
                  ]}
                  value={batchCount}
                  onChangeText={setBatchCount}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor={theme.colors.textSecondary}
                />

                <View style={styles.switchRow}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Add Sequential Numbers
                  </Text>
                  <TouchableOpacity
                    onPress={() => setUseSequentialNumbers(!useSequentialNumbers)}>
                    <Icon
                      name={useSequentialNumbers ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={24}
                      color={theme.colors.primary}
                    />
                  </TouchableOpacity>
                </View>

                {useSequentialNumbers && (
                  <View>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Start Number:</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                        }
                      ]}
                      value={startNumber}
                      onChangeText={setStartNumber}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                    <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
                      {templateType === 'url'
                        ? `URLs will be: ${baseData}?id=1, ${baseData}?id=2, ...`
                        : `Text will be: ${baseData} #1, ${baseData} #2, ...`}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.startButton, { backgroundColor: theme.colors.success }]}
                  onPress={startBatchWrite}>
                  <Icon name="play" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.startButtonText}>Start Batch Write</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Progress */}
            {isWriting && (
              <View>
                <View style={[styles.progressCard, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.progressTitle, { color: theme.colors.text }]}>
                    Writing Tags...
                  </Text>
                  <View style={styles.progressRow}>
                    <Text style={[styles.progressText, { color: theme.colors.text }]}>
                      {currentCount} / {totalCount}
                    </Text>
                    <Text style={[styles.progressPercent, { color: theme.colors.primary }]}>
                      {Math.round((currentCount / totalCount) * 100)}%
                    </Text>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: isPaused ? theme.colors.warning : theme.colors.success,
                          width: `${(currentCount / totalCount) * 100}%`,
                        }
                      ]}
                    />
                  </View>
                  {isPaused && (
                    <Text style={[styles.pausedText, { color: theme.colors.warning }]}>
                      ⏸ Paused
                    </Text>
                  )}
                </View>

                <View style={styles.controlButtons}>
                  {!isPaused ? (
                    <TouchableOpacity
                      style={[styles.controlButton, { backgroundColor: theme.colors.warning }]}
                      onPress={handlePause}>
                      <Icon name="pause" size={20} color="white" style={{ marginRight: 8 }} />
                      <Text style={styles.controlButtonText}>Pause</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.controlButton, { backgroundColor: theme.colors.success }]}
                      onPress={handleResume}>
                      <Icon name="play" size={20} color="white" style={{ marginRight: 8 }} />
                      <Text style={styles.controlButtonText}>Resume</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.controlButton, { backgroundColor: theme.colors.error }]}
                    onPress={handleStop}>
                    <Icon name="stop" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.controlButtonText}>Stop</Text>
                  </TouchableOpacity>
                </View>

                {/* Written Tags List */}
                <View style={styles.tagsList}>
                  <Text style={[styles.tagsListTitle, { color: theme.colors.text }]}>
                    Written Tags:
                  </Text>
                  {writtenTags.map((tag, index) => (
                    <View
                      key={index}
                      style={[styles.tagItem, { backgroundColor: theme.colors.background }]}>
                      <Icon name="check-circle" size={16} color={theme.colors.success} style={{ marginRight: 8 }} />
                      <Text style={[styles.tagText, { color: theme.colors.text }]}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 12,
  },
  dataPreview: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  dataText: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  progressCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  pausedText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tagsList: {
    marginTop: 8,
  },
  tagsListTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 12,
    flex: 1,
  },
});

export default BatchNFCModal;
