import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';

interface Service {
  uuid: string;
  characteristics: Characteristic[];
}

interface Characteristic {
  characteristic: string;
  properties: {
    Read?: string;
    Write?: string;
    WriteWithoutResponse?: string;
    Notify?: string;
    Indicate?: string;
  };
  descriptors?: any[];
  service: string;
}

interface GATTBrowserScreenProps {
  route: {
    params: {
      deviceId: string;
      deviceName: string;
    };
  };
  navigation: any;
}

const GATTBrowserScreen = ({ route, navigation }: GATTBrowserScreenProps) => {
  const { deviceId, deviceName } = route.params;
  const { theme } = useTheme();

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [expandedCharacteristics, setExpandedCharacteristics] = useState<Set<string>>(new Set());

  // Read/Write modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'read' | 'write'>('read');
  const [selectedCharacteristic, setSelectedCharacteristic] = useState<Characteristic | null>(null);
  const [characteristicValue, setCharacteristicValue] = useState('');
  const [writeValue, setWriteValue] = useState('');

  useEffect(() => {
    connectAndDiscover();

    return () => {
      if (isConnected) {
        BleManager.disconnect(deviceId).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const connectAndDiscover = async () => {
    setIsLoading(true);
    try {
      // Check if already connected
      const connectedDevices = await BleManager.getConnectedPeripherals([]);
      const alreadyConnected = connectedDevices.some(d => d.id === deviceId);

      if (!alreadyConnected) {
        await BleManager.connect(deviceId);
      }

      setIsConnected(true);

      // Retrieve services
      const peripheralInfo = await BleManager.retrieveServices(deviceId);

      if (peripheralInfo.characteristics) {
        // Group characteristics by service
        const serviceMap = new Map<string, Characteristic[]>();

        peripheralInfo.characteristics.forEach((char: Characteristic) => {
          if (!serviceMap.has(char.service)) {
            serviceMap.set(char.service, []);
          }
          serviceMap.get(char.service)?.push(char);
        });

        const servicesArray: Service[] = Array.from(serviceMap.entries()).map(([uuid, chars]) => ({
          uuid,
          characteristics: chars,
        }));

        setServices(servicesArray);
      }
    } catch (error: any) {
      console.error('GATT discovery error:', error);
      Alert.alert('Connection Error', error.message || 'Failed to connect to device');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const toggleService = (uuid: string) => {
    setExpandedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uuid)) {
        newSet.delete(uuid);
      } else {
        newSet.add(uuid);
      }
      return newSet;
    });
  };

  const toggleCharacteristic = (uuid: string) => {
    setExpandedCharacteristics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uuid)) {
        newSet.delete(uuid);
      } else {
        newSet.add(uuid);
      }
      return newSet;
    });
  };

  const readCharacteristic = async (char: Characteristic) => {
    try {
      setIsLoading(true);
      const data = await BleManager.read(deviceId, char.service, char.characteristic);

      // Convert byte array to hex string
      const hexString = data.map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();

      setCharacteristicValue(hexString);
      setSelectedCharacteristic(char);
      setModalMode('read');
      setShowModal(true);
    } catch (error: any) {
      Alert.alert('Read Error', error.message || 'Failed to read characteristic');
    } finally {
      setIsLoading(false);
    }
  };

  const writeCharacteristic = async () => {
    if (!selectedCharacteristic) return;

    try {
      setIsLoading(true);

      // Convert hex string to byte array
      const hexBytes = writeValue.split(' ').filter(b => b.length > 0);
      const bytes = hexBytes.map(hex => parseInt(hex, 16));

      await BleManager.write(
        deviceId,
        selectedCharacteristic.service,
        selectedCharacteristic.characteristic,
        bytes
      );

      Alert.alert('Success', 'Characteristic written successfully');
      setShowModal(false);
      setWriteValue('');
    } catch (error: any) {
      Alert.alert('Write Error', error.message || 'Failed to write characteristic');
    } finally {
      setIsLoading(false);
    }
  };

  const openWriteModal = (char: Characteristic) => {
    setSelectedCharacteristic(char);
    setModalMode('write');
    setWriteValue('');
    setShowModal(true);
  };

  const getServiceName = (uuid: string): string => {
    const knownServices: { [key: string]: string } = {
      '1800': 'Generic Access',
      '1801': 'Generic Attribute',
      '180a': 'Device Information',
      '180f': 'Battery Service',
      '1805': 'Current Time Service',
      '1818': 'Cycling Power',
      '1816': 'Cycling Speed and Cadence',
      '180d': 'Heart Rate',
      '1812': 'Human Interface Device',
      '1802': 'Immediate Alert',
      '1803': 'Link Loss',
      '1819': 'Location and Navigation',
      '1807': 'Next DST Change Service',
      '180e': 'Phone Alert Status Service',
      '1806': 'Reference Time Update Service',
      '1814': 'Running Speed and Cadence',
      '1813': 'Scan Parameters',
      '1804': 'Tx Power',
    };

    const shortUuid = uuid.toLowerCase().substring(4, 8);
    return knownServices[shortUuid] || `Unknown Service`;
  };

  const getCharacteristicName = (uuid: string): string => {
    const knownCharacteristics: { [key: string]: string } = {
      '2a00': 'Device Name',
      '2a01': 'Appearance',
      '2a04': 'Peripheral Preferred Connection Parameters',
      '2a05': 'Service Changed',
      '2a19': 'Battery Level',
      '2a29': 'Manufacturer Name String',
      '2a24': 'Model Number String',
      '2a25': 'Serial Number String',
      '2a27': 'Hardware Revision String',
      '2a26': 'Firmware Revision String',
      '2a28': 'Software Revision String',
      '2a37': 'Heart Rate Measurement',
      '2a38': 'Body Sensor Location',
      '2a39': 'Heart Rate Control Point',
    };

    const shortUuid = uuid.toLowerCase().substring(4, 8);
    return knownCharacteristics[shortUuid] || 'Unknown Characteristic';
  };

  const formatUuid = (uuid: string): string => {
    if (uuid.length <= 8) return uuid.toUpperCase();
    return `${uuid.substring(0, 8)}-...-${uuid.substring(uuid.length - 12)}`.toUpperCase();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="bluetooth-connect" size={24} color="white" style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.headerTitle}>{deviceName || 'Unknown Device'}</Text>
            <Text style={styles.headerSubtitle}>{deviceId}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon
            name={isConnected ? 'lan-connect' : 'lan-disconnect'}
            size={20}
            color={isConnected ? '#30D158' : '#FF453A'}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      {isLoading && !services.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Discovering services...
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={[styles.servicesCount, { color: theme.colors.textSecondary }]}>
            {services.length} Services Found
          </Text>

          {services.map((service) => (
            <View key={service.uuid} style={[styles.serviceCard, { backgroundColor: theme.colors.card }]}>
              <TouchableOpacity
                style={styles.serviceHeader}
                onPress={() => toggleService(service.uuid)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceName, { color: theme.colors.text }]}>
                    {getServiceName(service.uuid)}
                  </Text>
                  <Text style={[styles.serviceUuid, { color: theme.colors.textSecondary }]}>
                    {formatUuid(service.uuid)}
                  </Text>
                  <Text style={[styles.characteristicsCount, { color: theme.colors.textSecondary }]}>
                    {service.characteristics.length} characteristics
                  </Text>
                </View>
                <Icon
                  name={expandedServices.has(service.uuid) ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedServices.has(service.uuid) && (
                <View style={[styles.characteristicsContainer, { borderTopColor: theme.colors.border }]}>
                  {service.characteristics.map((char) => (
                    <View
                      key={char.characteristic}
                      style={[styles.characteristicCard, { backgroundColor: theme.colors.background }]}>
                      <TouchableOpacity
                        style={styles.characteristicHeader}
                        onPress={() => toggleCharacteristic(char.characteristic)}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.characteristicName, { color: theme.colors.text }]}>
                            {getCharacteristicName(char.characteristic)}
                          </Text>
                          <Text style={[styles.characteristicUuid, { color: theme.colors.textSecondary }]}>
                            {formatUuid(char.characteristic)}
                          </Text>
                        </View>
                        <Icon
                          name={expandedCharacteristics.has(char.characteristic) ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </TouchableOpacity>

                      {expandedCharacteristics.has(char.characteristic) && (
                        <View style={styles.characteristicDetails}>
                          {/* Properties */}
                          <View style={styles.propertiesRow}>
                            {Object.keys(char.properties).map((prop) => (
                              <View
                                key={prop}
                                style={[styles.propertyBadge, { backgroundColor: theme.colors.primary }]}>
                                <Text style={styles.propertyText}>{prop}</Text>
                              </View>
                            ))}
                          </View>

                          {/* Actions */}
                          <View style={styles.actionsRow}>
                            {char.properties.Read && (
                              <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: theme.colors.info }]}
                                onPress={() => readCharacteristic(char)}>
                                <Icon name="eye" size={16} color="white" style={{ marginRight: 4 }} />
                                <Text style={styles.actionButtonText}>Read</Text>
                              </TouchableOpacity>
                            )}
                            {(char.properties.Write || char.properties.WriteWithoutResponse) && (
                              <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
                                onPress={() => openWriteModal(char)}>
                                <Icon name="pencil" size={16} color="white" style={{ marginRight: 4 }} />
                                <Text style={styles.actionButtonText}>Write</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Read/Write Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {modalMode === 'read' ? 'Read Value' : 'Write Value'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedCharacteristic && (
              <View style={styles.modalBody}>
                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>
                  {getCharacteristicName(selectedCharacteristic.characteristic)}
                </Text>
                <Text style={[styles.modalUuid, { color: theme.colors.textSecondary }]}>
                  {selectedCharacteristic.characteristic}
                </Text>

                {modalMode === 'read' ? (
                  <View style={[styles.valueContainer, { backgroundColor: theme.colors.background }]}>
                    <Text style={[styles.valueText, { color: theme.colors.text }]}>
                      {characteristicValue || 'No data'}
                    </Text>
                  </View>
                ) : (
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                      Hex bytes (space-separated):
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                        }
                      ]}
                      value={writeValue}
                      onChangeText={setWriteValue}
                      placeholder="e.g., 01 02 03 FF"
                      placeholderTextColor={theme.colors.textSecondary}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={[styles.writeButton, { backgroundColor: theme.colors.success }]}
                      onPress={writeCharacteristic}
                      disabled={!writeValue.trim()}>
                      <Icon name="send" size={18} color="white" style={{ marginRight: 8 }} />
                      <Text style={styles.writeButtonText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  servicesCount: {
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 4,
  },
  serviceCard: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  serviceHeader: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  serviceUuid: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  characteristicsCount: {
    fontSize: 11,
  },
  characteristicsContainer: {
    borderTopWidth: 1,
    paddingTop: 8,
  },
  characteristicCard: {
    margin: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  characteristicHeader: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  characteristicName: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  characteristicUuid: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  characteristicDetails: {
    padding: 10,
    paddingTop: 0,
  },
  propertiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  propertyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  propertyText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    marginTop: 8,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  modalUuid: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  valueContainer: {
    padding: 12,
    borderRadius: 8,
    minHeight: 60,
  },
  valueText: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  inputLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
  },
  writeButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default GATTBrowserScreen;
