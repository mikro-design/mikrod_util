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
import Slider from '@react-native-community/slider';
import KeepAwake from '@sayem314/react-native-keep-awake';
import BleManager, {
  Peripheral,
} from 'react-native-ble-manager';
import NetInfo from '@react-native-community/netinfo';
import { logger } from '../utils/logger';
import init from 'react_native_mqtt';
import { IMqttClient } from 'react_native_mqtt';
import { Camera } from 'react-native-camera-kit';

// Declare Paho global from react_native_mqtt
declare const Paho: any;

interface MQTTConfig {
  broker: string;
  port: number;
  topic: string;
  username?: string;
  password?: string;
  tls?: boolean;
  connection_id?: string;
}

interface ScannedDevice extends Peripheral {
  rssi: number;
  lastSeen: Date;
  firstSeen?: Date;
}

type SortOption = 'rssi' | 'name' | 'firstSeen' | 'lastSeen' | 'insertion';

interface ByteFilter {
  id: string;
  position: string;
  value: string;
  enabled: boolean;
}

interface FilterPreset {
  name: string;
  icon: string;
  description: string;
  companyId?: string;
  serviceUuid?: string;
  bytePattern?: string; // Hex pattern with xx for wildcards (e.g., "aabbxxcc")
  byteFilters?: Array<{position: string; value: string}>; // Legacy, kept for reference
}

const FILTER_PRESETS: FilterPreset[] = [
  {
    name: 'iBeacon',
    icon: '📍',
    description: 'Apple iBeacon standard',
    companyId: '0x004C',
    byteFilters: [{position: '7', value: '0x02'}, {position: '8', value: '0x15'}],
  },
  {
    name: 'Sterisol',
    icon: '🏥',
    description: 'Sterisol iBeacon',
    companyId: '0x004F',
    byteFilters: [{position: '7', value: '0x02'}, {position: '8', value: '0x15'}],
  },
  {
    name: 'Eddystone',
    icon: '🔵',
    description: 'Google Eddystone beacon',
    serviceUuid: 'FEAA',
  },
  {
    name: 'AirTag',
    icon: '🔖',
    description: 'Apple AirTag / FindMy',
    companyId: '0x004C',
    byteFilters: [{position: '7', value: '0x12'}],
  },
  {
    name: 'FindMy',
    icon: '📡',
    description: 'Apple FindMy network',
    companyId: '0x004C',
    byteFilters: [{position: '7', value: '0x10'}],
  },
  {
    name: 'AirPods',
    icon: '🎧',
    description: 'Apple AirPods',
    companyId: '0x004C',
    byteFilters: [{position: '7', value: '0x07'}],
  },
  {
    name: 'Fast Pair',
    icon: '⚡',
    description: 'Android Fast Pair',
    serviceUuid: 'FE2C',
  },
  {
    name: 'Exposure',
    icon: '🦠',
    description: 'COVID Exposure Notification',
    serviceUuid: 'FD6F',
  },
];

const BLEScannerScreen = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Map<string, ScannedDevice>>(new Map());
  const [nameFilter, setNameFilter] = useState('');
  const [rssiFilter, setRssiFilter] = useState(-100);
  const [addressFilter, setAddressFilter] = useState('');
  const [showOnlyNamed, setShowOnlyNamed] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('insertion');
  const [showFilters, setShowFilters] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Advanced filters
  const [serviceUuidFilter, setServiceUuidFilter] = useState('');
  const [companyIdFilter, setCompanyIdFilter] = useState('');
  const [rawBytePattern, setRawBytePattern] = useState('');

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [favoriteDevices, setFavoriteDevices] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [mqttTopic, setMqttTopic] = useState('');
  const [mqttBroker, setMqttBroker] = useState('');
  const [mqttPort, setMqttPort] = useState(1883);
  const [mqttUsername, setMqttUsername] = useState('');
  const [mqttPassword, setMqttPassword] = useState('');
  const [mqttTls, setMqttTls] = useState(false);
  const [mqttConfig, setMqttConfig] = useState<MQTTConfig | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [gatewayInterval, setGatewayInterval] = useState('10');
  const [lastGatewayPost, setLastGatewayPost] = useState<Date | null>(null);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [nextPostIn, setNextPostIn] = useState<number | null>(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const scanningRef = useRef(false);
  const autoRestartRef = useRef(false);
  const gatewayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mqttClientRef = useRef<IMqttClient | null>(null);

  const handleDiscoverPeripheral = useCallback((peripheral: Peripheral) => {
    setDevices(prevDevices => {
      const newDevices = new Map(prevDevices);
      const existingDevice = prevDevices.get(peripheral.id);
      const device: ScannedDevice = {
        ...peripheral,
        rssi: peripheral.rssi || -100,
        lastSeen: new Date(),
        firstSeen: existingDevice?.firstSeen || new Date(),
      };
      newDevices.set(peripheral.id, device);
      return newDevices;
    });
  }, []);


  // Handle QR code scan
  const handleQRCodeScan = useCallback((event: any) => {
    try {
      // react-native-camera-kit provides the code in event.nativeEvent.codeStringValue
      const qrData = event?.nativeEvent?.codeStringValue || event;
      const config: MQTTConfig = JSON.parse(qrData);

      // Validate required fields
      if (!config.broker || !config.port || !config.topic) {
        Alert.alert('Invalid QR Code', 'QR code missing required fields: broker, port, topic');
        logger.error('QR', 'Invalid QR code - missing required fields');
        return;
      }

      // Apply configuration
      setMqttConfig(config);
      setMqttBroker(config.broker);
      setMqttPort(config.port);
      setMqttTopic(config.topic);
      setMqttUsername(config.username || '');
      setMqttPassword(config.password || '');
      setMqttTls(config.tls || false);

      setShowQRScanner(false);

      logger.success('QR', `Configuration loaded: ${config.broker}:${config.port}/${config.topic}`);
      Alert.alert(
        'Configuration Loaded',
        `Broker: ${config.broker}\nPort: ${config.port}\nTopic: ${config.topic}${config.connection_id ? `\nID: ${config.connection_id}` : ''}`
      );
    } catch (error) {
      Alert.alert('Invalid QR Code', 'QR code does not contain valid JSON configuration');
      logger.error('QR', `Invalid QR code JSON: ${error}`);
    }
  }, []);

  // Request camera permission
  const requestCameraPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs camera access to scan QR codes',
            buttonPositive: 'OK',
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setShowQRScanner(true);
          logger.info('QR', 'Camera permission granted');
        } else {
          Alert.alert('Permission Denied', 'Camera permission is required to scan QR codes');
          logger.error('QR', 'Camera permission denied');
        }
      } else {
        setShowQRScanner(true);
      }
    } catch (error) {
      logger.error('QR', `Camera permission error: ${error}`);
      Alert.alert('Error', 'Failed to request camera permission');
    }
  };

  // MQTT connection management - only connect after QR code scan
  useEffect(() => {
    // Only connect if gateway is enabled AND we have a valid config from QR scan
    if (gatewayEnabled && mqttConfig && mqttBroker && mqttTopic) {
      // Initialize MQTT
      init({
        size: 10000,
        storageBackend: undefined,
        defaultExpires: 1000 * 3600 * 24,
        enableCache: true,
        sync: {},
      });

      logger.info('MQTT', `Connecting to ${mqttBroker}:${mqttPort}`);

      const clientId = `ble_scanner_${Date.now()}`;
      const client = new Paho.MQTT.Client(mqttBroker, mqttPort, clientId) as unknown as IMqttClient;

      client.onConnectionLost = (responseObject: any) => {
        setMqttConnected(false);
        setGatewayError('MQTT disconnected');
        logger.error('MQTT', `Connection lost: ${responseObject.errorMessage}`);
      };

      client.onMessageArrived = (message: any) => {
        // We're only publishing, not subscribing
        logger.debug('MQTT', `Unexpected message: ${message.payloadString}`);
      };

      const connectOptions: any = {
        onSuccess: () => {
          setMqttConnected(true);
          setGatewayError(null);
          mqttClientRef.current = client;
          logger.success('MQTT', `Connected to ${mqttBroker}:${mqttPort}`);
        },
        onFailure: (error: any) => {
          setMqttConnected(false);
          setGatewayError(`MQTT failed: ${error.errorMessage || 'Unknown error'}`);
          logger.error('MQTT', `Connection failed: ${error.errorMessage || 'Unknown'}`);
        },
        timeout: 10,
        keepAliveInterval: 60,
        useSSL: mqttTls,
        cleanSession: true,
      };

      // Add authentication if provided
      if (mqttUsername) {
        connectOptions.userName = mqttUsername;
        if (mqttPassword) {
          connectOptions.password = mqttPassword;
        }
        logger.info('MQTT', `Using authentication for user: ${mqttUsername}`);
      }

      client.connect(connectOptions);

      return () => {
        if (mqttClientRef.current?.isConnected()) {
          mqttClientRef.current.disconnect();
          logger.info('MQTT', 'Disconnected');
        }
        mqttClientRef.current = null;
        setMqttConnected(false);
      };
    } else if (gatewayEnabled && !mqttConfig) {
      // Gateway enabled but no QR code scanned yet
      logger.info('MQTT', 'Gateway enabled - waiting for QR code scan');
      setGatewayError('Scan QR code to configure');
      setMqttConnected(false);
    }
  }, [gatewayEnabled, mqttConfig, mqttBroker, mqttPort, mqttTopic, mqttUsername, mqttPassword, mqttTls]);

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
        logger.success('BLE', 'BLE initialized successfully');
      } catch (error) {
        logger.error('BLE', 'BLE initialization failed', { error });
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
          // Don't remove favorited devices
          if (favoriteDevices.has(id)) {
            continue;
          }

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
  }, [handleDiscoverPeripheral, favoriteDevices]);

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
      logger.info('BLE', 'BLE scan started');
    } catch (error) {
      logger.error('BLE', 'Failed to start BLE scan', { error });
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
      logger.info('BLE', 'BLE scan stopped');
    } catch (error) {
      logger.error('BLE', 'Error stopping BLE scan', { error });
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
    if (!gatewayEnabled) {
      return;
    }

    try {
      const devicesArray = Array.from(devices.values()).map(device => ({
        id: device.id,
        name: device.name,
        rssi: device.rssi,
        advertising: cleanAdvertisingData(device.advertising),
      }));

      logger.debug('BLE', `Sending ${devicesArray.length} devices`);

      if (!mqttClientRef.current || !mqttClientRef.current.isConnected()) {
        setGatewayError('MQTT not connected');
        logger.error('MQTT', 'Cannot publish - not connected');
        return;
      }

      const payload = JSON.stringify(devicesArray);
      const message = new Paho.MQTT.Message(payload);
      message.destinationName = mqttTopic;
      message.qos = 1; // QoS 1: at least once delivery
      message.retained = false; // Don't retain messages

      logger.info('MQTT', `Publishing ${devicesArray.length} devices to topic: ${mqttTopic}`);
      mqttClientRef.current.send(message);

      setLastGatewayPost(new Date());
      setGatewayError(null);
      logger.success('MQTT', `Published ${devicesArray.length} devices to ${mqttTopic}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('GATEWAY', `Error: ${errorMsg}`);
      setGatewayError(errorMsg);
    }
  }, [gatewayEnabled, mqttTopic, devices]);

  useEffect(() => {
    // Only start posting if gateway is enabled AND we have a valid MQTT connection
    if (gatewayEnabled && mqttConnected && mqttConfig) {
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
  }, [gatewayEnabled, mqttConnected, mqttConfig, gatewayInterval, postToGateway]);

  const connectToDevice = async (deviceId: string) => {
    try {
      await BleManager.connect(deviceId);
      Alert.alert('Connected', `Connected to device ${deviceId}`);
      const peripheralInfo = await BleManager.retrieveServices(deviceId);
      logger.success('BLE', `Connected to device`, { deviceId });
      console.log('Peripheral info:', peripheralInfo);
    } catch (error) {
      logger.error('BLE', 'Failed to connect to device', { deviceId, error });
      Alert.alert('Error', 'Failed to connect to device');
    }
  };

  // Match raw byte pattern (e.g., "aabbxxcc" where xx = don't care)
  const matchesBytePattern = (bytes: number[], pattern: string): boolean => {
    if (!pattern) return true;

    // Remove spaces and convert to lowercase
    const cleanPattern = pattern.replace(/\s/g, '').toLowerCase();

    // Pattern must be pairs of hex digits or 'xx'
    if (cleanPattern.length % 2 !== 0) return false;

    const patternBytes: Array<number | null> = [];
    for (let i = 0; i < cleanPattern.length; i += 2) {
      const pair = cleanPattern.substring(i, i + 2);
      if (pair === 'xx') {
        patternBytes.push(null); // wildcard
      } else {
        const value = parseInt(pair, 16);
        if (isNaN(value)) return false;
        patternBytes.push(value);
      }
    }

    // Check if pattern matches anywhere in the byte array
    for (let offset = 0; offset <= bytes.length - patternBytes.length; offset++) {
      let match = true;
      for (let i = 0; i < patternBytes.length; i++) {
        const patternByte = patternBytes[i];
        if (patternByte !== null && bytes[offset + i] !== patternByte) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }

    return false;
  };

  const getRawAdvertisingBytes = (device: ScannedDevice): number[] => {
    // ALWAYS use raw advertising data, no fallback
    if (device.advertising?.rawData) {
      const rawData = device.advertising.rawData;
      let bytes: number[] = [];

      if (Array.isArray(rawData)) {
        bytes = rawData;
      } else if (rawData.bytes) {
        bytes = Array.from(rawData.bytes as number[]);
      } else if (rawData.data) {
        bytes = Array.from(rawData.data as number[]);
      }

      if (bytes.length > 0) {
        logger.debug('BLE', `Device ${device.name || device.id} using rawData, length: ${bytes.length}, first 10: ${bytes.slice(0, 10).map((b, i) => `[${i}]=0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
        return bytes;
      }
    }

    // Return empty array if no rawData available
    return [];
  };

  const getManufacturerDataBytes = (device: ScannedDevice): number[] => {
    if (!device.advertising?.manufacturerData) return [];
    const mfgData = device.advertising.manufacturerData;
    let bytes: number[] = [];

    if (Array.isArray(mfgData)) {
      bytes = mfgData;
      logger.debug('BLE', `Device ${device.name || device.id} mfg data is array, length: ${bytes.length}, first 10: ${bytes.slice(0, 10).map((b, i) => `[${i}]=0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
    } else if (mfgData.bytes) {
      bytes = Array.from(mfgData.bytes as number[]);
      logger.debug('BLE', `Device ${device.name || device.id} mfg data has .bytes property, length: ${bytes.length}`);
    } else if (mfgData.data) {
      bytes = Array.from(mfgData.data as number[]);
      logger.debug('BLE', `Device ${device.name || device.id} mfg data has .data property, length: ${bytes.length}`);
    } else {
      logger.debug('BLE', `Device ${device.name || device.id} mfg data unknown type: ${typeof mfgData}, value: ${JSON.stringify(mfgData)}`);
    }

    return bytes;
  };

  const filterAndSortDevices = () => {
    // Filter
    let filtered = Array.from(devices.values()).filter(device => {
      // Basic filters
      if (device.rssi < rssiFilter) return false;

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

      // Advanced filters
      if (serviceUuidFilter && device.advertising?.serviceUUIDs) {
        const filterUuids = serviceUuidFilter.toLowerCase().split(',').map(s => s.trim()).filter(s => s);
        const hasMatch = filterUuids.some(filterUuid =>
          device.advertising!.serviceUUIDs!.some(deviceUuid =>
            deviceUuid.toLowerCase().includes(filterUuid)
          )
        );
        if (!hasMatch) return false;
      }

      // Company ID filter
      if (companyIdFilter && device.advertising?.manufacturerData) {
        const bytes = getManufacturerDataBytes(device);
        logger.debug('BLE', `CompanyID filter: bytes.length=${bytes.length}, need >=7`);
        if (bytes.length < 7) {
          logger.debug('BLE', `CompanyID filter REJECT: bytes too short`);
          return false;
        }
        const companyId = bytes[5] | (bytes[6] << 8);
        const filterCompanyId = parseInt(companyIdFilter.replace(/^0x/i, ''), 16);
        logger.debug('BLE', `CompanyID check: got=0x${companyId.toString(16)}, want=${companyIdFilter} (0x${filterCompanyId.toString(16)})`);
        if (isNaN(filterCompanyId) || companyId !== filterCompanyId) {
          logger.debug('BLE', `CompanyID filter REJECT: mismatch`);
          return false;
        }
        logger.debug('BLE', `CompanyID filter PASS`);
      }

      // Raw advertising data byte pattern filter
      if (rawBytePattern) {
        const bytes = getRawAdvertisingBytes(device);
        if (bytes.length === 0) return false;
        if (!matchesBytePattern(bytes, rawBytePattern)) return false;
      }

      return true;
    });

    // Sort (only if not using insertion order)
    if (sortBy !== 'insertion') {
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'rssi':
            return b.rssi - a.rssi; // Strongest first
          case 'name':
            const nameA = (a.name || 'Unknown').toLowerCase();
            const nameB = (b.name || 'Unknown').toLowerCase();
            return nameA.localeCompare(nameB);
          case 'firstSeen':
            return (a.firstSeen?.getTime() || 0) - (b.firstSeen?.getTime() || 0);
          case 'lastSeen':
            return b.lastSeen.getTime() - a.lastSeen.getTime(); // Most recent first
          default:
            return 0;
        }
      });
    }

    return filtered;
  };

  const filteredDevices = filterAndSortDevices();

  const getActiveFiltersCount = () => {
    let count = 0;
    if (rssiFilter > -100) count++;
    if (nameFilter) count++;
    if (addressFilter) count++;
    if (showOnlyNamed) count++;
    if (serviceUuidFilter) count++;
    if (companyIdFilter) count++;
    if (rawBytePattern) count++;
    return count;
  };

  const clearAllFilters = () => {
    setRssiFilter(-100);
    setNameFilter('');
    setAddressFilter('');
    setShowOnlyNamed(false);
    setServiceUuidFilter('');
    setCompanyIdFilter('');
    setRawBytePattern('');
    logger.info('BLE', 'All filters cleared');
  };

  const applyPreset = (preset: FilterPreset) => {
    // Clear existing filters first
    setNameFilter('');
    setAddressFilter('');
    setShowOnlyNamed(false);
    setServiceUuidFilter('');
    setCompanyIdFilter('');
    setRawBytePattern('');

    // Apply preset filters
    if (preset.companyId) {
      setCompanyIdFilter(preset.companyId);
    }
    if (preset.serviceUuid) {
      setServiceUuidFilter(preset.serviceUuid);
    }
    if (preset.bytePattern) {
      setRawBytePattern(preset.bytePattern);
    }

    // Ensure advanced filters are visible
    setShowAdvancedFilters(true);

    logger.info('BLE', `Applied preset: ${preset.name}`);
  };

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

  const toggleFavorite = (deviceId: string) => {
    setFavoriteDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
        logger.info('BLE', `Removed device ${deviceId} from favorites`);
      } else {
        newSet.add(deviceId);
        logger.info('BLE', `Added device ${deviceId} to favorites`);
      }
      return newSet;
    });
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

  const bytesToHexWithOffsets = (data: any): string => {
    if (!data) return '';
    try {
      let bytes: number[] = [];
      if (data.bytes) bytes = Array.from(data.bytes as number[]);
      else if (Array.isArray(data)) bytes = Array.from(data);
      else if (data.data) bytes = Array.from(data.data as number[]);
      else if (typeof data === 'string') return data;

      // Trim trailing zeros for cleaner display
      // Note: Filter still uses full array, so positions remain correct
      while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
        bytes.pop();
      }

      // Format with offsets: [0]=02 [1]=01 [2]=06 etc.
      // Indices match the actual byte positions in the full array
      return bytes.map((b, i) => `[${i}]=${b.toString(16).padStart(2, '0')}`).join(' ').toUpperCase();
    } catch (e) {
      return '';
    }
  };

  const decodeManufacturerData = (hex: string): string[] => {
    const decoded: string[] = [];
    const bytes = hex.split(' ').map(b => parseInt(b, 16));

    if (bytes.length < 7) return decoded;

    const companyId = bytes[5] | (bytes[6] << 8);
    const data = bytes.slice(7);

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
      const hexWithOffsets = bytesToHexWithOffsets(adv.manufacturerData);
      const hexPlain = bytesToHex(adv.manufacturerData);
      if (hexWithOffsets) {
        fields.push(renderAdvertisingField(
          device,
          'mfgData',
          'Manufacturer Data',
          hexWithOffsets,
          () => decodeManufacturerData(hexPlain)
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
      const rawHexWithOffsets = bytesToHexWithOffsets(adv.rawData);
      if (rawHexWithOffsets) {
        const byteCount = rawHexWithOffsets.split(' ').length;
        fields.push(renderAdvertisingField(
          device,
          'rawData',
          'Raw Advertisement',
          `${byteCount} bytes`,
          () => [`Full packet: ${rawHexWithOffsets}`]
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
          {isScanning ? 'Scanning...' : `${filteredDevices.length} / ${devices.size} devices`}
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

      {/* Sort Options */}
      <View style={styles.sortSection}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'insertion' && styles.sortButtonActive]}
            onPress={() => setSortBy('insertion')}>
            <Text style={[styles.sortButtonText, sortBy === 'insertion' && styles.sortButtonTextActive]}>
              Insertion Order
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'rssi' && styles.sortButtonActive]}
            onPress={() => setSortBy('rssi')}>
            <Text style={[styles.sortButtonText, sortBy === 'rssi' && styles.sortButtonTextActive]}>
              Signal Strength
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
            onPress={() => setSortBy('name')}>
            <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
              Name
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'lastSeen' && styles.sortButtonActive]}
            onPress={() => setSortBy('lastSeen')}>
            <Text style={[styles.sortButtonText, sortBy === 'lastSeen' && styles.sortButtonTextActive]}>
              Last Seen
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'firstSeen' && styles.sortButtonActive]}
            onPress={() => setSortBy('firstSeen')}>
            <Text style={[styles.sortButtonText, sortBy === 'firstSeen' && styles.sortButtonTextActive]}>
              First Seen
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Filter Section Header */}
      <TouchableOpacity
        style={styles.filterHeader}
        onPress={() => setShowFilters(!showFilters)}>
        <Text style={styles.filterHeaderText}>
          {showFilters ? '▼' : '▶'} Filters {getActiveFiltersCount() > 0 ? `(${getActiveFiltersCount()})` : ''}
        </Text>
        {getActiveFiltersCount() > 0 && (
          <TouchableOpacity onPress={clearAllFilters} style={styles.clearFiltersButton}>
            <Text style={styles.clearFiltersText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Active Filter Chips */}
      {getActiveFiltersCount() > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsContainer}>
          {rssiFilter > -100 && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>RSSI ≥ {rssiFilter} dBm</Text>
              <TouchableOpacity onPress={() => setRssiFilter(-100)} style={styles.filterChipClose}>
                <Text style={styles.filterChipCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          {nameFilter !== '' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Name: {nameFilter}</Text>
              <TouchableOpacity onPress={() => setNameFilter('')} style={styles.filterChipClose}>
                <Text style={styles.filterChipCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          {addressFilter !== '' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Addr: {addressFilter}</Text>
              <TouchableOpacity onPress={() => setAddressFilter('')} style={styles.filterChipClose}>
                <Text style={styles.filterChipCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          {showOnlyNamed && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Named only</Text>
              <TouchableOpacity onPress={() => setShowOnlyNamed(false)} style={styles.filterChipClose}>
                <Text style={styles.filterChipCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          {serviceUuidFilter && (
            <View style={[styles.filterChip, styles.filterChipAdvanced]}>
              <Text style={styles.filterChipText}>UUID: {serviceUuidFilter}</Text>
              <TouchableOpacity onPress={() => setServiceUuidFilter('')} style={styles.filterChipClose}>
                <Text style={styles.filterChipCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          {companyIdFilter && (
            <View style={[styles.filterChip, styles.filterChipAdvanced]}>
              <Text style={styles.filterChipText}>Company: {companyIdFilter}</Text>
              <TouchableOpacity onPress={() => setCompanyIdFilter('')} style={styles.filterChipClose}>
                <Text style={styles.filterChipCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          {rawBytePattern && (
            <View style={[styles.filterChip, styles.filterChipAdvanced]}>
              <Text style={styles.filterChipText}>pattern: {rawBytePattern}</Text>
              <TouchableOpacity onPress={() => setRawBytePattern('')} style={styles.filterChipClose}>
                <Text style={styles.filterChipCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Filter Controls */}
      {showFilters && (
        <ScrollView
          style={styles.filtersScrollView}
          contentContainerStyle={styles.filters}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}>
          {/* RSSI Slider */}
          <View style={styles.rssiSliderContainer}>
            <Text style={styles.rssiLabel}>Min RSSI: {rssiFilter} dBm</Text>
            <Slider
              style={styles.rssiSlider}
              minimumValue={-100}
              maximumValue={-30}
              step={5}
              value={rssiFilter}
              onValueChange={setRssiFilter}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#E5E5EA"
              thumbTintColor="#007AFF"
            />
          </View>

          {/* Text Filters */}
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

          {/* Named Only Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Show named devices only</Text>
              <Switch
                value={showOnlyNamed}
                onValueChange={setShowOnlyNamed}
                trackColor={{false: '#767577', true: '#007AFF'}}
              />
            </View>
          </View>

          {/* Filter Presets */}
          <View style={styles.presetsSection}>
            <Text style={styles.presetsLabel}>Quick Filters:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
              {FILTER_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.name}
                  style={styles.presetButton}
                  onPress={() => applyPreset(preset)}>
                  <Text style={styles.presetIcon}>{preset.icon}</Text>
                  <Text style={styles.presetName}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Advanced Filters Toggle */}
          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}>
            <Text style={styles.advancedToggleText}>
              {showAdvancedFilters ? '▼' : '▶'} Advanced Payload Filtering
            </Text>
          </TouchableOpacity>

          {/* Advanced Filters Section */}
          {showAdvancedFilters && (
            <View style={styles.advancedFiltersSection}>
              {/* Service UUID Filter */}
              <View style={styles.advancedFilterGroup}>
                <Text style={styles.advancedFilterLabel}>Service UUID(s)</Text>
                <Text style={styles.advancedFilterHint}>Comma-separated UUIDs</Text>
                <TextInput
                  style={styles.advancedFilterInput}
                  value={serviceUuidFilter}
                  onChangeText={setServiceUuidFilter}
                  placeholder="e.g. 180F, 180A"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                />
              </View>

              {/* Company ID Filter */}
              <View style={styles.advancedFilterGroup}>
                <Text style={styles.advancedFilterLabel}>Manufacturer Company ID</Text>
                <Text style={styles.advancedFilterHint}>Hex value (e.g. 0x004C for Apple)</Text>
                <TextInput
                  style={styles.advancedFilterInput}
                  value={companyIdFilter}
                  onChangeText={setCompanyIdFilter}
                  placeholder="0x004C"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                />
              </View>

              {/* Raw Advertising Byte Pattern */}
              <View style={styles.advancedFilterGroup}>
                <Text style={styles.advancedFilterLabel}>Raw Advertising Byte Pattern</Text>
                <Text style={styles.advancedFilterHint}>Hex pattern with 'xx' for wildcards (e.g., "aabbxxcc" matches 0xAA 0xBB ?? ?? 0xCC)</Text>
                <TextInput
                  style={styles.advancedFilterInput}
                  value={rawBytePattern}
                  onChangeText={setRawBytePattern}
                  placeholder="aabbxxcc"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.gatewaySection}>
        <View style={styles.gatewaySectionHeader}>
          <Text style={styles.gatewaySectionTitle}>MQTT Gateway</Text>
          <Switch
            value={gatewayEnabled}
            onValueChange={setGatewayEnabled}
            trackColor={{false: '#767577', true: '#34C759'}}
          />
        </View>

        {gatewayEnabled && (
          <>
            {/* Status Bar */}
            <View style={styles.gatewayStatusBar}>
              <Text style={[styles.mqttStatusText, mqttConnected ? styles.mqttConnected : styles.mqttDisconnected]}>
                {mqttConnected ? `✓ ${mqttBroker}` : `○ Connecting...`}
              </Text>
              {lastGatewayPost && nextPostIn !== null && (
                <Text style={styles.gatewayNextText}>
                  Next: {nextPostIn}s
                </Text>
              )}
              {gatewayError && (
                <Text style={styles.gatewayErrorText}>
                  ✗ {gatewayError}
                </Text>
              )}
            </View>

            {/* Configuration */}
            <View style={styles.configRow}>
              {mqttConfig ? (
                <Text style={styles.configText} numberOfLines={1} ellipsizeMode="middle">
                  {mqttTopic}
                </Text>
              ) : (
                <Text style={styles.configPlaceholder}>Not configured</Text>
              )}
              <TouchableOpacity
                style={styles.qrButtonCompact}
                onPress={requestCameraPermission}>
                <Text style={styles.qrButtonCompactText}>📷</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.intervalRow}>
              <Text style={styles.intervalLabel}>Interval:</Text>
              <TextInput
                style={styles.intervalInput}
                value={gatewayInterval}
                onChangeText={setGatewayInterval}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
              <Text style={styles.intervalLabel}>sec</Text>
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
            <View style={styles.deviceMainInfo}>
              <View style={styles.deviceRow}>
                <Text style={styles.deviceName}>
                  {device.name || 'Unknown Device'}
                </Text>
                <View style={styles.deviceHeaderRight}>
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={() => toggleFavorite(device.id)}>
                    <Text style={styles.favoriteIcon}>
                      {favoriteDevices.has(device.id) ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[
                    styles.rssi,
                    device.rssi > -70 ? styles.rssiGood :
                    device.rssi > -85 ? styles.rssiMedium : styles.rssiBad
                  ]}>
                    {device.rssi}
                  </Text>
                </View>
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
            </View>

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

      {/* QR Code Scanner Modal */}
      {showQRScanner && (
        <View style={styles.qrModal}>
          <View style={styles.qrTopContent}>
            <Text style={styles.qrTitle}>Scan MQTT Config QR Code</Text>
            <Text style={styles.qrSubtitle}>Position the QR code within the frame</Text>
          </View>

          <Camera
            style={styles.qrCamera}
            cameraType="back"
            scanBarcode={true}
            onReadCode={handleQRCodeScan}
            showFrame={true}
            laserColor="#34C759"
            frameColor="#FFFFFF"
          />

          <TouchableOpacity
            style={styles.qrCancelButton}
            onPress={() => setShowQRScanner(false)}>
            <Text style={styles.qrCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
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
  filtersScrollView: {
    maxHeight: 120,
    backgroundColor: 'white',
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  filters: {
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 6,
    padding: 4,
    fontSize: 12,
    color: '#000',
  },
  switchRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchLabel: {
    fontSize: 14,
    color: '#000',
    marginRight: 8,
    flex: 1,
  },
  sortSection: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sortLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  sortScroll: {
    flexDirection: 'row',
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  filterHeader: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  clearFiltersButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
  },
  clearFiltersText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  filterChipsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
    marginRight: 4,
  },
  filterChipClose: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipCloseText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    lineHeight: 18,
  },
  filterChipAdvanced: {
    backgroundColor: '#FF9500',
  },
  rssiSliderContainer: {
    marginBottom: 4,
  },
  rssiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  rssiSlider: {
    width: '100%',
    height: 25,
  },
  presetsSection: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  presetsScroll: {
    flexDirection: 'row',
  },
  presetButton: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginRight: 4,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    minWidth: 50,
  },
  presetIcon: {
    fontSize: 14,
    marginBottom: 1,
  },
  presetName: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
  },
  advancedToggle: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  advancedToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
  },
  advancedFiltersSection: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  advancedFilterGroup: {
    marginBottom: 8,
  },
  advancedFilterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  advancedFilterHint: {
    fontSize: 10,
    color: '#8E8E93',
    marginBottom: 3,
  },
  advancedFilterInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 6,
    padding: 4,
    fontSize: 12,
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  byteFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addByteFilterButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#34C759',
    borderRadius: 12,
  },
  addByteFilterText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  byteFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  byteFilterIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 30,
  },
  byteFilterInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  byteFilterInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 4,
    padding: 6,
    fontSize: 13,
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: 'white',
  },
  byteFilterPosition: {
    width: 50,
    textAlign: 'center',
  },
  byteFilterValue: {
    flex: 1,
  },
  byteFilterEqual: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginHorizontal: 6,
  },
  removeByteFilterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeByteFilterText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
    lineHeight: 20,
  },
  noByteFiltersText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gatewayNextText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  gatewayErrorText: {
    fontSize: 11,
    color: '#FF3B30',
    fontWeight: '600',
  },
  mqttStatusText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  mqttConnected: {
    color: '#34C759',
  },
  mqttDisconnected: {
    color: '#FF9500',
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  configPlaceholder: {
    flex: 1,
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  qrButtonCompact: {
    backgroundColor: '#34C759',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  qrButtonCompactText: {
    fontSize: 18,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intervalLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  intervalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 6,
    padding: 6,
    fontSize: 13,
    color: '#000',
    marginHorizontal: 6,
    width: 50,
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
  deviceHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteButton: {
    padding: 4,
  },
  favoriteIcon: {
    fontSize: 20,
    color: '#FFD700',
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
  qrModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
    flexDirection: 'column',
  },
  qrCamera: {
    flex: 1,
  },
  qrTopContent: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  qrSubtitle: {
    fontSize: 14,
    color: '#CCC',
  },
  qrCancelButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    margin: 20,
  },
  qrCancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  configText: {
    flex: 1,
    fontSize: 11,
    color: '#3C3C43',
    fontFamily: 'monospace',
  },
});

export default BLEScannerScreen;
