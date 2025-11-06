import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NFCReaderScreen from './src/screens/NFCReaderScreen';
import BLEScannerScreen from './src/screens/BLEScannerScreen';
import NFCTagDetailScreen from './src/screens/NFCTagDetailScreen';
import GATTBrowserScreen from './src/screens/GATTBrowserScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type {
  NFCStackParamList,
  BLEStackParamList,
  TabParamList,
} from './src/types/navigation';

const Tab = createBottomTabNavigator<TabParamList>();
const NFCStackNav = createNativeStackNavigator<NFCStackParamList>();
const BLEStackNav = createNativeStackNavigator<BLEStackParamList>();

function NFCStack() {
  return (
    <NFCStackNav.Navigator>
      <NFCStackNav.Screen
        name="NFCReader"
        component={NFCReaderScreen}
        options={{
          headerTitle: 'Mikrod Util - NFC Reader',
        }}
      />
      <NFCStackNav.Screen
        name="NFCTagDetail"
        component={NFCTagDetailScreen}
        options={{
          headerTitle: 'Tag Memory Editor',
        }}
      />
    </NFCStackNav.Navigator>
  );
}

function BLEStack() {
  return (
    <BLEStackNav.Navigator>
      <BLEStackNav.Screen
        name="BLEScanner"
        component={BLEScannerScreen}
        options={{
          headerTitle: 'Mikrod Util - BLE Scanner',
        }}
      />
      <BLEStackNav.Screen
        name="GATTBrowser"
        component={GATTBrowserScreen}
        options={{
          headerTitle: 'GATT Services',
        }}
      />
    </BLEStackNav.Navigator>
  );
}

function TabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="NFC"
        component={NFCStack}
        options={{
          tabBarLabel: 'NFC',
          tabBarIcon: ({ color, size }) => (
            <Icon name="nfc" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="BLE"
        component={BLEStack}
        options={{
          tabBarLabel: 'BLE',
          tabBarIcon: ({ color, size }) => (
            <Icon name="bluetooth" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Icon name="cog" size={size} color={color} />
          ),
          headerShown: true,
          headerTitle: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

function App() {
  return (
    <ThemeProvider>
      <FavoritesProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <TabNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </FavoritesProvider>
    </ThemeProvider>
  );
}

export default App;
