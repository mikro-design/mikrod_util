import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import type { NdefRecord as LibraryNdefRecord } from 'react-native-nfc-manager';

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
  ndefMessage?: LibraryNdefRecord[];
  timestamp: string;
}

export type NdefRecord = LibraryNdefRecord;
export type NdefMessage = LibraryNdefRecord[];

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
