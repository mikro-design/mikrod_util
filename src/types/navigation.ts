import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type RootStackParamList = {
  Main: undefined;
};

export type NFCStackParamList = {
  NFCReader: undefined;
  NFCTagDetail: {
    tagId: string;
    tagType: string;
    techTypes: string[];
  };
};

export type BLEStackParamList = {
  BLEScanner: undefined;
  GATTBrowser: {
    deviceId: string;
    deviceName: string;
  };
};

export type TabParamList = {
  NFC: undefined;
  BLE: undefined;
  Settings: undefined;
};

// Screen props types
export type NFCTagDetailScreenProps = NativeStackScreenProps<
  NFCStackParamList,
  'NFCTagDetail'
>;
export type GATTBrowserScreenProps = NativeStackScreenProps<
  BLEStackParamList,
  'GATTBrowser'
>;
export type NFCReaderScreenProps = CompositeScreenProps<
  NativeStackScreenProps<NFCStackParamList, 'NFCReader'>,
  BottomTabScreenProps<TabParamList>
>;
export type BLEScannerScreenProps = CompositeScreenProps<
  NativeStackScreenProps<BLEStackParamList, 'BLEScanner'>,
  BottomTabScreenProps<TabParamList>
>;
export type SettingsScreenProps = BottomTabScreenProps<
  TabParamList,
  'Settings'
>;
