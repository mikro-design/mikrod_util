import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcEvents } from 'react-native-nfc-manager';
import { NFCData } from '../types';

export const useNFC = () => {
  const [isNFCEnabled, setIsNFCEnabled] = useState(false);
  const [isNFCSupported, setIsNFCSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [nfcData, setNfcData] = useState<NFCData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initNFC = async () => {
      try {
        const supported = await NfcManager.isSupported();
        setIsNFCSupported(supported);

        if (supported) {
          await NfcManager.start();
          const enabled = await NfcManager.isEnabled();
          setIsNFCEnabled(enabled);

          if (!enabled) {
            setError('NFC is supported but disabled. Please enable NFC in settings.');
          }
        } else {
          setError('This device does not support NFC');
          Alert.alert('NFC Not Supported', 'This device does not support NFC');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize NFC';
        setError(errorMessage);
        console.error('NFC init error:', err);
      }
    };

    initNFC();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    };
  }, []);

  const startNFCScan = useCallback(async () => {
    if (isScanning) return;
    if (!isNFCSupported) {
      Alert.alert('Error', 'NFC is not supported on this device');
      return;
    }
    if (!isNFCEnabled) {
      Alert.alert('Error', 'Please enable NFC in your device settings');
      return;
    }

    try {
      setIsScanning(true);
      setError(null);

      const techs = [NfcTech.NfcV, NfcTech.Ndef, NfcTech.NfcA];

      // Try to connect to a tag that's already present
      for (const tech of techs) {
        try {
          await NfcManager.connect([tech]);
          const tag = await NfcManager.getTag();

          if (tag) {
            console.log('Found tag with tech:', tech, tag);
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
            setIsScanning(false);
            return;
          }
        } catch (e) {
          console.log(`Connect with ${tech} failed:`, e);
          // Try next tech
        }
      }

      // If no tag found immediately, listen for new tags
      NfcManager.setEventListener(NfcEvents.DiscoverTag, async (tag) => {
        console.log('Tag discovered:', tag);

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

          setIsScanning(false);
          NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
          await NfcManager.unregisterTagEvent().catch(() => {});
        }
      });

      await NfcManager.registerTagEvent();

    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to scan for NFC tags';
      console.warn('NFC scan error:', err);
      setError(errorMessage);
      Alert.alert('Scan Error', errorMessage);
      setIsScanning(false);
      NfcManager.unregisterTagEvent().catch(() => {});
    }
  }, [isScanning, isNFCSupported, isNFCEnabled]);

  const stopNFCScan = useCallback(async () => {
    try {
      setIsScanning(false);
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      await NfcManager.unregisterTagEvent();
      await NfcManager.cancelTechnologyRequest();
    } catch (err) {
      console.error('Stop scan error:', err);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setNfcData([]);
  }, []);

  const parseNdefMessage = useCallback((message: any): string => {
    if (!message || !Array.isArray(message)) return 'No NDEF data';

    return message.map((record: any, index: number) => {
      try {
        const payload = record.payload;
        if (payload) {
          const text = Ndef.text.decodePayload(new Uint8Array(payload));
          return `Record ${index + 1}: ${text}`;
        }
      } catch (e) {
        return `Record ${index + 1}: [Binary data]`;
      }
      return `Record ${index + 1}: [Empty]`;
    }).join('\n');
  }, []);

  return {
    isNFCEnabled,
    isNFCSupported,
    isScanning,
    nfcData,
    error,
    startNFCScan,
    stopNFCScan,
    clearHistory,
    parseNdefMessage,
  };
};
