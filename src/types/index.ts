import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';

// Navigation Types
export type RootStackParamList = {
  NFC: undefined;
  BLE: undefined;
};

export type NFCStackParamList = {
  NFCReader: undefined;
  NFCTagDetail: {
    tagId: string;
    tagType: string;
    techTypes: string[];
  };
};

export type NFCScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<NFCStackParamList, 'NFCReader'>,
  BottomTabNavigationProp<RootStackParamList>
>;

export type NFCTagDetailNavigationProp = NativeStackNavigationProp<
  NFCStackParamList,
  'NFCTagDetail'
>;

// NFC Types
export interface NFCData {
  id: string;
  type: string;
  techTypes: string[];
  ndefMessage?: NdefMessage;
  timestamp: string;
}

export interface NdefRecord {
  id?: number[];
  tnf?: number;
  type?: number[];
  payload?: number[];
}

export interface NdefMessage extends Array<NdefRecord> {}

// BLE Types
export interface ScannedDevice {
  id: string;
  name?: string;
  rssi: number;
  lastSeen: Date;
  advertising?: AdvertisingData;
}

export interface AdvertisingData {
  localName?: string;
  txPowerLevel?: number;
  manufacturerData?: ManufacturerData;
  serviceUUIDs?: string[];
  serviceData?: ServiceData[] | { [key: string]: any };
  rawData?: number[] | { bytes: number[] };
}

export interface ManufacturerData {
  bytes?: number[];
  data?: number[];
}

export interface ServiceData {
  uuid: string;
  data?: number[];
  bytes?: number[];
}

// Utility Types
export type HexString = string;
export type ByteArray = number[];
