import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import BleManager, { Peripheral } from 'react-native-ble-manager';
import { ScannedDevice } from '../types';

export const useBLE = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Map<string, ScannedDevice>>(new Map());
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const scanningRef = useRef(false);
  const autoRestartRef = useRef(false);

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

      // Auto-restart scan if enabled
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

  const startScan = useCallback(async () => {
    if (!permissionsGranted) {
      Alert.alert('Permissions Required', 'Please grant BLE permissions to scan');
      return;
    }

    try {
      setDevices(new Map());
      setIsScanning(true);
      scanningRef.current = true;
      autoRestartRef.current = true;
      await BleManager.scan([], 30, true);
    } catch (error) {
      console.error('Scan error:', error);
      setIsScanning(false);
      scanningRef.current = false;
      autoRestartRef.current = false;
      Alert.alert('Error', 'Failed to start BLE scan');
    }
  }, [permissionsGranted]);

  const stopScan = useCallback(async () => {
    try {
      autoRestartRef.current = false;
      await BleManager.stopScan();
      setIsScanning(false);
      scanningRef.current = false;
    } catch (error) {
      console.error('Stop scan error:', error);
      autoRestartRef.current = false;
      setIsScanning(false);
      scanningRef.current = false;
    }
  }, []);

  const clearList = useCallback(() => {
    setDevices(new Map());
  }, []);

  const connectToDevice = useCallback(async (deviceId: string) => {
    try {
      await BleManager.connect(deviceId);
      Alert.alert('Connected', `Connected to device ${deviceId}`);
      const peripheralInfo = await BleManager.retrieveServices(deviceId);
      console.log('Peripheral info:', peripheralInfo);
      return peripheralInfo;
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Error', 'Failed to connect to device');
      throw error;
    }
  }, []);

  return {
    isScanning,
    devices,
    permissionsGranted,
    startScan,
    stopScan,
    clearList,
    connectToDevice,
  };
};
