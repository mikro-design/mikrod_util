import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import NFCReaderScreen from './src/screens/NFCReaderScreen';
import BLEScannerScreen from './src/screens/BLEScannerScreen';
import NFCTagDetailScreen from './src/screens/NFCTagDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function NFCStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="NFCReader"
        component={NFCReaderScreen}
        options={{
          headerTitle: 'Mikrod Util - NFC Reader',
        }}
      />
      <Stack.Screen
        name="NFCTagDetail"
        component={NFCTagDetailScreen}
        options={{
          headerTitle: 'Tag Memory Editor',
        }}
      />
    </Stack.Navigator>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#8E8E93',
            headerShown: false,
          }}>
          <Tab.Screen
            name="NFC"
            component={NFCStack}
            options={{
              tabBarLabel: 'NFC',
              tabBarIcon: ({ color, size }) => (
                <Text style={{ fontSize: size, color }}>📡</Text>
              ),
            }}
          />
          <Tab.Screen
            name="BLE"
            component={BLEScannerScreen}
            options={{
              tabBarLabel: 'BLE',
              tabBarIcon: ({ color, size }) => (
                <Text style={{ fontSize: size, color }}>📶</Text>
              ),
              headerShown: true,
              headerTitle: 'Mikrod Util - BLE Scanner',
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
