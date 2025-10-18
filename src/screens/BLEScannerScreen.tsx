import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  PermissionsAndroid,
  Platform,
  Switch,
  RefreshControl,
} from 'react-native';
import KeepAwake from '@sayem314/react-native-keep-awake';
import BleManager, {
  Peripheral,
} from 'react-native-ble-manager';

interface ScannedDevice extends Peripheral {
  rssi: number;
  lastSeen: Date;
}

const BLEScannerScreen = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Map<string, ScannedDevice>>(new Map());
  const [nameFilter, setNameFilter] = useState('');
  const [rssiFilter, setRssiFilter] = useState('-100');
  const [addressFilter, setAddressFilter] = useState('');
  const [showOnlyNamed, setShowOnlyNamed] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState('http://192.168.1.100:8080/api/ble');
  const [gatewayInterval, setGatewayInterval] = useState('10');
  const [lastGatewayPost, setLastGatewayPost] = useState<Date | null>(null);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [nextPostIn, setNextPostIn] = useState<number | null>(null);
  const scanningRef = useRef(false);
  const autoRestartRef = useRef(false);
  const gatewayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleDiscoverPeripheral = useCallback((peripheral: Peripheral) => {
    setDevices(prevDevices => {
      const newDevices = new Map(prevDevices);
      const device: ScannedDevice = {
        ...peripheral,
        rssi: peripheral.rssi || -100,
        lastSeen: new Date(),
      };
      newDevices.set(peripheral.id, device);
      return newDevices;
    });
  }, []);

  useEffect(() => {
    const requestPermissions = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          const allGranted = Object.values(granted).every(
            status => status === PermissionsAndroid.RESULTS.GRANTED
          );

          if (!allGranted) {
            Alert.alert('Permissions Required', 'BLE permissions are needed to scan for devices');
            setPermissionsGranted(false);
            return;
          }
          setPermissionsGranted(true);
        } else {
          setPermissionsGranted(true);
        }

        await BleManager.start({ showAlert: false });
      } catch (error) {
        console.error('BLE init error:', error);
        Alert.alert('Error', 'Failed to initialize BLE');
      }
    };

    requestPermissions();

    const discoverListener = BleManager.onDiscoverPeripheral(handleDiscoverPeripheral);
    const stopScanListener = BleManager.onStopScan(() => {
      console.log('BLE scan stopped, autoRestart:', autoRestartRef.current);
      setIsScanning(false);
      scanningRef.current = false;

      // Auto-restart scan if it was user-initiated (not stopped manually)
      if (autoRestartRef.current) {
        console.log('Auto-restarting BLE scan...');
        setTimeout(() => {
          if (autoRestartRef.current) {
            BleManager.scan([], 30, true)
              .then(() => {
                setIsScanning(true);
                scanningRef.current = true;
                console.log('BLE scan auto-restarted');
              })
              .catch(error => {
                console.error('Auto-restart scan error:', error);
                autoRestartRef.current = false;
              });
          }
        }, 100);
      }
    });

    // Cleanup old devices every 30 seconds
    const cleanupInterval = setInterval(() => {
      const now = new Date();
      const maxAge = 5 * 60 * 1000; // 5 minutes

      setDevices(prevDevices => {
        const newDevices = new Map(prevDevices);
        for (const [id, device] of newDevices) {
          const age = now.getTime() - device.lastSeen.getTime();
          if (age > maxAge) {
            newDevices.delete(id);
          }
        }
        return newDevices;
      });
    }, 30000);

    return () => {
      discoverListener.remove();
      stopScanListener.remove();
      clearInterval(cleanupInterval);
      if (scanningRef.current) {
        BleManager.stopScan().catch(() => {});
      }
    };
  }, [handleDiscoverPeripheral]);

  const startScan = async () => {
    if (!permissionsGranted) {
      Alert.alert('Permissions Required', 'Please grant BLE permissions to scan');
      return;
    }

    try {
      setDevices(new Map());
      setIsScanning(true);
      scanningRef.current = true;
      autoRestartRef.current = true; // Enable auto-restart
      await BleManager.scan([], 30, true);
    } catch (error) {
      console.error('Scan error:', error);
      setIsScanning(false);
      scanningRef.current = false;
      autoRestartRef.current = false;
      Alert.alert('Error', 'Failed to start BLE scan');
    }
  };

  const stopScan = async () => {
    try {
      autoRestartRef.current = false; // Disable auto-restart
      await BleManager.stopScan();
      setIsScanning(false);
      scanningRef.current = false;
    } catch (error) {
      console.error('Stop scan error:', error);
      autoRestartRef.current = false;
      setIsScanning(false);
      scanningRef.current = false;
    }
  };

  const clearList = () => {
    setDevices(new Map());
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    clearList();
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  const trimTrailingZeros = (data: any): any => {
    if (!data) return data;

    // Handle arrays (byte arrays)
    if (Array.isArray(data)) {
      const arr = [...data];
      while (arr.length > 0 && arr[arr.length - 1] === 0) {
        arr.pop();
      }
      return arr;
    }

    // Handle objects with byte arrays
    if (typeof data === 'object') {
      if (data.bytes) {
        const bytes = Array.from(data.bytes as number[]);
        while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
          bytes.pop();
        }
        return bytes;
      }
      if (data.data) {
        const bytes = Array.from(data.data as number[]);
        while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
          bytes.pop();
        }
        return bytes;
      }
    }

    return data;
  };

  const cleanAdvertisingData = (advertising: any): any => {
    if (!advertising) return advertising;

    const cleaned: any = {};

    // Clean each field
    if (advertising.localName) cleaned.localName = advertising.localName;
    if (advertising.txPowerLevel !== undefined) cleaned.txPowerLevel = advertising.txPowerLevel;

    if (advertising.manufacturerData) {
      cleaned.manufacturerData = trimTrailingZeros(advertising.manufacturerData);
    }

    if (advertising.serviceUUIDs) {
      cleaned.serviceUUIDs = advertising.serviceUUIDs;
    }

    if (advertising.serviceData) {
      if (Array.isArray(advertising.serviceData)) {
        cleaned.serviceData = advertising.serviceData.map((item: any) => ({
          uuid: item.uuid,
          data: trimTrailingZeros(item)
        }));
      } else if (typeof advertising.serviceData === 'object') {
        cleaned.serviceData = {};
        for (const [uuid, data] of Object.entries(advertising.serviceData)) {
          cleaned.serviceData[uuid] = trimTrailingZeros(data);
        }
      }
    }

    if (advertising.rawData) {
      cleaned.rawData = trimTrailingZeros(advertising.rawData);
    }

    return cleaned;
  };

  const postToGateway = useCallback(async () => {
    if (!gatewayEnabled || !gatewayUrl) {
      return;
    }

    try {
      const devicesArray = Array.from(devices.values()).map(device => ({
        id: device.id,
        name: device.name,
        rssi: device.rssi,
        advertising: cleanAdvertisingData(device.advertising),
      }));

      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(devicesArray),
      });

      if (response.ok) {
        setLastGatewayPost(new Date());
        setGatewayError(null);
      } else {
        setGatewayError(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Gateway post error:', error);
      setGatewayError(error instanceof Error ? error.message : 'Network error');
    }
  }, [gatewayEnabled, gatewayUrl, devices]);

  useEffect(() => {
    if (gatewayEnabled) {
      // Post immediately when enabled
      postToGateway();

      const interval = parseInt(gatewayInterval) || 10;
      setNextPostIn(interval);

      // Countdown timer
      const countdownInterval = setInterval(() => {
        setNextPostIn(prev => {
          if (prev === null || prev <= 1) {
            return interval;
          }
          return prev - 1;
        });
      }, 1000);

      // Post interval
      gatewayIntervalRef.current = setInterval(() => {
        postToGateway();
      }, interval * 1000);

      return () => {
        if (gatewayIntervalRef.current) {
          clearInterval(gatewayIntervalRef.current);
        }
        clearInterval(countdownInterval);
        setNextPostIn(null);
      };
    }
  }, [gatewayEnabled, gatewayInterval, postToGateway]);

  const connectToDevice = async (deviceId: string) => {
    try {
      await BleManager.connect(deviceId);
      Alert.alert('Connected', `Connected to device ${deviceId}`);
      const peripheralInfo = await BleManager.retrieveServices(deviceId);
      console.log('Peripheral info:', peripheralInfo);
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Error', 'Failed to connect to device');
    }
  };

  const filterDevices = () => {
    const rssiThreshold = parseInt(rssiFilter) || -100;

    return Array.from(devices.values()).filter(device => {
      if (device.rssi < rssiThreshold) return false;

      if (nameFilter && device.name) {
        if (!device.name.toLowerCase().includes(nameFilter.toLowerCase())) {
          return false;
        }
      }

      if (addressFilter) {
        if (!device.id.toLowerCase().includes(addressFilter.toLowerCase())) {
          return false;
        }
      }

      if (showOnlyNamed && !device.name) {
        return false;
      }

      return true;
    });
  };

  const filteredDevices = filterDevices();

  const toggleFieldExpansion = (deviceId: string, fieldName: string) => {
    const key = `${deviceId}:${fieldName}`;
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isFieldExpanded = (deviceId: string, fieldName: string): boolean => {
    return expandedFields.has(`${deviceId}:${fieldName}`);
  };

  const bytesToHex = (data: any): string => {
    if (!data) return '';
    try {
      let bytes: number[] = [];
      if (data.bytes) bytes = Array.from(data.bytes as number[]);
      else if (Array.isArray(data)) bytes = Array.from(data);
      else if (data.data) bytes = Array.from(data.data as number[]);
      else if (typeof data === 'string') return data;

      // Trim trailing zeros
      while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
        bytes.pop();
      }

      return bytes.map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    } catch (e) {
      return '';
    }
  };

  const decodeManufacturerData = (hex: string): string[] => {
    const decoded: string[] = [];
    const bytes = hex.split(' ').map(b => parseInt(b, 16));

    if (bytes.length < 2) return decoded;

    const companyId = bytes[0] | (bytes[1] << 8);
    const data = bytes.slice(2);

    decoded.push(`Company ID: 0x${companyId.toString(16).padStart(4, '0').toUpperCase()}`);

    // Decode known company IDs
    const companies: {[key: number]: string} = {
      0x004C: 'Apple Inc.',
      0x0059: 'Nordic Semiconductor ASA',
      0x0075: 'Samsung Electronics Co. Ltd.',
      0x0006: 'Microsoft',
      0x00E0: 'Google',
      0x0087: 'Garmin International',
      0x0157: 'Huawei Technologies Co. Ltd.',
    };

    if (companies[companyId]) {
      decoded.push(`Manufacturer: ${companies[companyId]}`);
    }

    // Apple-specific decoding
    if (companyId === 0x004C && data.length > 0) {
      const appleType = data[0];
      if (appleType === 0x02 && data.length >= 21) {
        decoded.push(`Type: iBeacon`);
        const uuid = data.slice(1, 17).map(b => b.toString(16).padStart(2, '0')).join('');
        decoded.push(`UUID: ${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16, 20)}-${uuid.substring(20)}`);
        const major = (data[17] << 8) | data[18];
        const minor = (data[19] << 8) | data[20];
        decoded.push(`Major: ${major}`);
        decoded.push(`Minor: ${minor}`);
        if (data.length > 21) {
          decoded.push(`TX Power: ${data[21] - 256} dBm`);
        }
      } else if (appleType === 0x10) {
        decoded.push(`Type: Proximity (FindMy/AirTag)`);
      } else if (appleType === 0x12) {
        decoded.push(`Type: FindMy network`);
      } else if (appleType === 0x07) {
        decoded.push(`Type: AirPods`);
      } else if (appleType === 0x09) {
        decoded.push(`Type: AirPlay`);
      }
    }

    // Add raw data bytes
    if (data.length > 0) {
      decoded.push(`Data (${data.length} bytes): ${data.map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()}`);
    }

    return decoded;
  };

  const decodeServiceUUID = (uuid: string): string => {
    const standardServices: {[key: string]: string} = {
      '1800': 'Generic Access',
      '1801': 'Generic Attribute',
      '180A': 'Device Information',
      '180F': 'Battery Service',
      '1805': 'Current Time Service',
      '1818': 'Cycling Power',
      '1816': 'Cycling Speed and Cadence',
      '180D': 'Heart Rate',
      '1812': 'Human Interface Device',
      '1802': 'Immediate Alert',
      '1803': 'Link Loss',
      '1819': 'Location and Navigation',
      '1807': 'Next DST Change Service',
      '180E': 'Phone Alert Status Service',
      '1806': 'Reference Time Update Service',
      '1814': 'Running Speed and Cadence',
      '1813': 'Scan Parameters',
      '1804': 'Tx Power',
    };

    const shortUUID = uuid.replace(/-/g, '').substring(0, 4).toUpperCase();
    return standardServices[shortUUID] || uuid;
  };

  const renderAdvertisingField = (device: ScannedDevice, fieldName: string, fieldTitle: string, rawValue: string, decodeFunc?: () => string[]) => {
    if (!rawValue) return null;

    const expanded = isFieldExpanded(device.id, fieldName);

    return (
      <View key={fieldName} style={styles.adFieldContainer}>
        <TouchableOpacity
          style={styles.adFieldHeader}
          onPress={() => toggleFieldExpansion(device.id, fieldName)}>
          <Text style={styles.expandIconSmall}>{expanded ? '▼' : '▶'}</Text>
          <Text style={styles.adFieldTitle}>{fieldTitle}</Text>
        </TouchableOpacity>

        <View style={styles.adFieldContent}>
          <Text style={styles.adFieldValue}>{rawValue}</Text>

          {expanded && decodeFunc && (
            <View style={styles.decodedSection}>
              {decodeFunc().map((line, idx) => (
                <Text key={idx} style={styles.decodedText}>
                  {line}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderDeviceAdvertising = (device: ScannedDevice) => {
    if (!device.advertising) {
      return <Text style={styles.noDataText}>No advertising data</Text>;
    }

    const adv = device.advertising;
    const fields: JSX.Element[] = [];

    // Local Name
    if (adv.localName) {
      fields.push(renderAdvertisingField(
        device,
        'localName',
        'Local Name',
        adv.localName
      ));
    }

    // TX Power Level
    if (adv.txPowerLevel !== undefined && adv.txPowerLevel !== null) {
      // Convert to signed 8-bit value if needed
      let txPower = adv.txPowerLevel;

      // Log the original value for debugging
      console.log(`TX Power raw value for ${device.name || device.id}: ${adv.txPowerLevel}`);

      // If value is greater than 127, it's likely unsigned and needs conversion
      if (txPower > 127) {
        txPower = txPower - 256;
      }

      // Only show TX Power if it's in reasonable range (-30 to +20 dBm)
      // Values outside this range are likely corrupted or misinterpreted
      if (txPower >= -30 && txPower <= 20) {
        fields.push(renderAdvertisingField(
          device,
          'txPower',
          'TX Power Level',
          `${txPower} dBm`
        ));
      }
    }

    // Manufacturer Data
    if (adv.manufacturerData) {
      const hex = bytesToHex(adv.manufacturerData);
      if (hex) {
        fields.push(renderAdvertisingField(
          device,
          'mfgData',
          'Manufacturer Data',
          hex,
          () => decodeManufacturerData(hex)
        ));
      }
    }

    // Service UUIDs
    if (adv.serviceUUIDs && adv.serviceUUIDs.length > 0) {
      const uuids = adv.serviceUUIDs.join(', ');
      fields.push(renderAdvertisingField(
        device,
        'services',
        `Service UUIDs (${adv.serviceUUIDs.length})`,
        uuids,
        () => adv.serviceUUIDs!.map(uuid => `• ${decodeServiceUUID(uuid)} (${uuid})`)
      ));
    }

    // Service Data
    if (adv.serviceData) {
      let serviceEntries: {uuid: string, data: string}[] = [];

      if (Array.isArray(adv.serviceData)) {
        for (const item of adv.serviceData) {
          if (item && item.uuid) {
            const hex = bytesToHex(item);
            if (hex) serviceEntries.push({uuid: item.uuid, data: hex});
          }
        }
      } else if (typeof adv.serviceData === 'object') {
        for (const [uuid, data] of Object.entries(adv.serviceData)) {
          const hex = bytesToHex(data);
          if (hex) serviceEntries.push({uuid, data: hex});
        }
      }

      serviceEntries.forEach((entry, idx) => {
        fields.push(renderAdvertisingField(
          device,
          `serviceData${idx}`,
          `Service Data (${entry.uuid})`,
          entry.data,
          () => [
            `UUID: ${entry.uuid}`,
            `Service: ${decodeServiceUUID(entry.uuid)}`,
            `Data: ${entry.data}`
          ]
        ));
      });
    }

    // Raw Data
    if (adv.rawData) {
      const rawHex = bytesToHex(adv.rawData);
      if (rawHex) {
        fields.push(renderAdvertisingField(
          device,
          'rawData',
          'Raw Advertisement',
          `${rawHex.split(' ').length} bytes`,
          () => [`Full packet: ${rawHex}`]
        ));
      }
    }

    return fields.length > 0 ? fields : <Text style={styles.noDataText}>No advertising data</Text>;
  };

  return (
    <View style={styles.container}>
      {gatewayEnabled && <KeepAwake />}
      <View style={styles.header}>
        <Text style={styles.headerText}>BLE Scanner</Text>
        <Text style={styles.statusText}>
          {isScanning ? 'Scanning...' : `${filteredDevices.length} devices`}
        </Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, isScanning && styles.stopButton]}
            onPress={isScanning ? stopScan : startScan}
            disabled={!permissionsGranted}>
            <Text style={styles.buttonText}>
              {isScanning ? 'STOP SCAN' : 'START SCAN'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={clearList}>
            <Text style={styles.buttonText}>
              CLEAR LIST
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <TextInput
            style={styles.filterInput}
            value={nameFilter}
            onChangeText={setNameFilter}
            placeholder="Filter by name"
            placeholderTextColor="#999"
          />
          <TextInput
            style={[styles.filterInput, {marginLeft: 8}]}
            value={addressFilter}
            onChangeText={setAddressFilter}
            placeholder="Filter by address"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.filterRow}>
          <TextInput
            style={[styles.filterInput, {flex: 0.5}]}
            value={rssiFilter}
            onChangeText={setRssiFilter}
            keyboardType="numeric"
            placeholder="Min RSSI"
            placeholderTextColor="#999"
          />
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Named only</Text>
            <Switch
              value={showOnlyNamed}
              onValueChange={setShowOnlyNamed}
              trackColor={{false: '#767577', true: '#007AFF'}}
            />
          </View>
        </View>
      </View>

      <View style={styles.gatewaySection}>
        <View style={styles.gatewaySectionHeader}>
          <Text style={styles.gatewaySectionTitle}>BLE Gateway Mode</Text>
          <Switch
            value={gatewayEnabled}
            onValueChange={setGatewayEnabled}
            trackColor={{false: '#767577', true: '#34C759'}}
          />
        </View>

        {gatewayEnabled && (
          <>
            <View style={styles.gatewayStatusBar}>
              {lastGatewayPost ? (
                <View>
                  <Text style={styles.gatewayStatusText}>
                    ✓ Last posted: {lastGatewayPost.toLocaleTimeString()}
                  </Text>
                  {nextPostIn !== null && (
                    <Text style={styles.gatewayNextText}>
                      Next in {nextPostIn}s
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={styles.gatewayWaitingText}>
                  {nextPostIn !== null ? `Sending in ${nextPostIn}s...` : 'Initializing...'}
                </Text>
              )}
              {gatewayError && (
                <Text style={styles.gatewayErrorText}>
                  ✗ {gatewayError}
                </Text>
              )}
            </View>

            <TextInput
              style={styles.gatewayInput}
              value={gatewayUrl}
              onChangeText={setGatewayUrl}
              placeholder="REST Endpoint URL"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />

            <View style={styles.intervalRow}>
              <Text style={styles.intervalLabel}>Interval:</Text>
              <TextInput
                style={styles.intervalInput}
                value={gatewayInterval}
                onChangeText={setGatewayInterval}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor="#999"
              />
              <Text style={styles.intervalLabel}>seconds</Text>
            </View>
          </>
        )}
      </View>

      <ScrollView
        style={styles.deviceList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }>
        {filteredDevices.map(device => (
          <View key={device.id} style={styles.deviceCard}>
            <TouchableOpacity
              style={styles.deviceMainInfo}
              onPress={() => connectToDevice(device.id)}>
              <View style={styles.deviceRow}>
                <Text style={styles.deviceName}>
                  {device.name || 'Unknown Device'}
                </Text>
                <Text style={[
                  styles.rssi,
                  device.rssi > -70 ? styles.rssiGood :
                  device.rssi > -85 ? styles.rssiMedium : styles.rssiBad
                ]}>
                  {device.rssi}
                </Text>
              </View>
              <View style={styles.deviceInfoRow}>
                <Text style={styles.deviceInfoLabel}>Address: </Text>
                <Text style={styles.deviceAddress}>{device.id}</Text>
              </View>
              <View style={styles.deviceInfoRow}>
                <Text style={styles.deviceInfoLabel}>Last seen: </Text>
                <Text style={styles.timestamp}>
                  {device.lastSeen.toLocaleTimeString()}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.advertisingDataSection}>
              {renderDeviceAdvertising(device)}
            </View>
          </View>
        ))}
        {filteredDevices.length === 0 && (
          <Text style={styles.emptyText}>
            {!permissionsGranted ? 'Please grant BLE permissions' :
             isScanning ? 'Scanning for devices...' :
             'No devices found. Press START SCAN.'}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  statusText: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
  },
  controls: {
    padding: 12,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    flex: 2,
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: '#8E8E93',
    flex: 1,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  filters: {
    backgroundColor: 'white',
    padding: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    color: '#000',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  switchLabel: {
    fontSize: 14,
    color: '#000',
    marginRight: 8,
  },
  gatewaySection: {
    backgroundColor: 'white',
    padding: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  gatewaySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gatewaySectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  gatewayInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    color: '#000',
    marginBottom: 8,
  },
  gatewayStatusBar: {
    backgroundColor: '#F2F2F7',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  gatewayStatusText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
  },
  gatewayWaitingText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  gatewayNextText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  gatewayErrorText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
    marginTop: 4,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intervalLabel: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  intervalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    color: '#000',
    marginHorizontal: 8,
    width: 60,
    textAlign: 'center',
  },
  deviceList: {
    flex: 1,
    padding: 12,
  },
  deviceCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  deviceMainInfo: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  deviceInfoLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  rssi: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rssiGood: {
    backgroundColor: '#34C759',
    color: 'white',
  },
  rssiMedium: {
    backgroundColor: '#FF9500',
    color: 'white',
  },
  rssiBad: {
    backgroundColor: '#FF3B30',
    color: 'white',
  },
  deviceAddress: {
    fontSize: 11,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
  },
  timestamp: {
    fontSize: 11,
    color: '#8E8E93',
    flex: 1,
  },
  advertisingDataSection: {
    padding: 8,
  },
  adFieldContainer: {
    marginBottom: 4,
  },
  adFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  expandIconSmall: {
    fontSize: 12,
    color: '#007AFF',
    width: 16,
    marginRight: 6,
  },
  adFieldTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
    flex: 1,
  },
  adFieldContent: {
    paddingLeft: 30,
    paddingRight: 8,
    paddingBottom: 4,
  },
  adFieldValue: {
    fontSize: 12,
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  decodedSection: {
    backgroundColor: '#F2F2F7',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  decodedText: {
    fontSize: 11,
    color: '#3C3C43',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  noDataText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    padding: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 40,
  },
});

export default BLEScannerScreen;
