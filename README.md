# Mikrod Util

[![CI](https://github.com/mikro-design/mikrod_util/workflows/CI/badge.svg)](https://github.com/mikro-design/mikrod_util/actions/workflows/ci.yml)
[![Android Build](https://github.com/mikro-design/mikrod_util/workflows/Android%20Build/badge.svg)](https://github.com/mikro-design/mikrod_util/actions/workflows/android-build.yml)
[![iOS Build](https://github.com/mikro-design/mikrod_util/workflows/iOS%20Build/badge.svg)](https://github.com/mikro-design/mikrod_util/actions/workflows/ios-build.yml)
[![Security Scan](https://github.com/mikro-design/mikrod_util/workflows/Security%20Scan/badge.svg)](https://github.com/mikro-design/mikrod_util/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Mikrod Util** is a React Native mobile application for NFC tag reading/writing and BLE device scanning, designed for industrial OT/IoT applications. It provides smartphone-based alternatives to dedicated hardware scanners while offering unique gateway functionality for BLE-to-cloud data forwarding.

## Features

### NFC Reader
- **ISO15693 Tag Support**: Read and write ST25DV and compatible NFC tags
- **Memory Editor**: Hex editor with byte-level editing and ASCII visualization
- **Session Management**: Persistent NFC sessions reduce re-scan time
- **Configurable Reading**: Specify start block and block count
- **History Tracking**: View and manage previously scanned tags

### BLE Scanner
- **Continuous Scanning**: Auto-restart scanning with 30-second intervals
- **Advanced Filtering**: Filter by name, address, RSSI threshold, or named-only devices
- **Protocol Decoding**:
  - iBeacon parsing (UUID, Major, Minor, TX Power)
  - Apple device detection (AirTag, FindMy, AirPods, AirPlay)
  - Manufacturer data decoding (Apple, Nordic, Samsung, Microsoft, Google, Garmin, Huawei)
  - Service UUID recognition (18 standard BLE services)
- **Gateway Mode**: POST scan data to REST endpoints at configurable intervals
- **Keep-Awake**: Screen stays on during gateway operation
- **RSSI-Based Discovery**: Color-coded signal strength indicators

## Installation

### Prerequisites
- Node.js >= 20
- React Native development environment ([Setup Guide](https://reactnative.dev/docs/environment-setup))
- For iOS: Xcode 14+, CocoaPods
- For Android: Android Studio, JDK 17

### Install Dependencies

```sh
npm install

# iOS only - install CocoaPods
cd ios
bundle install
bundle exec pod install
cd ..
```

## Running the App

### Start Metro Bundler
```sh
npm start
```

### Run on Android
```sh
npm run android
```

### Run on iOS
```sh
npm run ios
```

## Development

### Available Scripts
- `npm start` - Start Metro bundler
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS simulator
- `npm test` - Run unit tests
- `npm run lint` - Run ESLint
- `npx prettier --check "**/*.{js,jsx,ts,tsx}"` - Check code formatting

### Project Structure
```
src/
├── screens/
│   ├── NFCReaderScreen.tsx         # NFC tag scanning & history
│   ├── NFCTagDetailScreen.tsx      # Memory editor (hex + ASCII)
│   └── BLEScannerScreen.tsx        # BLE scanner with gateway mode
├── hooks/
│   ├── useNFC.ts                   # NFC state management
│   └── useBLE.ts                   # BLE state management
└── types/
    └── index.ts                    # TypeScript definitions
```

## CI/CD

This project uses GitHub Actions for automated testing, building, and deployment.

### Workflows
- **CI** (`ci.yml`): Linting, type checking, unit tests, coverage
- **Android Build** (`android-build.yml`): Debug/release APK and AAB builds
- **iOS Build** (`ios-build.yml`): Debug simulator builds and release IPA
- **Security Scan** (`security.yml`): Dependency scanning, CodeQL, secret detection
- **Dependency Updates** (`dependency-update.yml`): Automated dependency updates

See [.github/workflows/README.md](.github/workflows/README.md) for detailed CI/CD setup instructions.

### Build Artifacts
Automated builds are available as GitHub Actions artifacts:
- Android Debug APK (every push to main/develop)
- Android Release APK/AAB (tagged releases)
- iOS IPA (tagged releases, requires signing setup)

## Code Analysis

A comprehensive analysis comparing Mikrod Util with industrial OT/IoT solutions is available in [ANALYSIS.md](ANALYSIS.md).

**Highlights**:
- **Cost**: Free (uses smartphone) vs $100-$5000 for dedicated hardware
- **Gateway Mode**: Rivals industrial IoT gateways for BLE-to-REST forwarding
- **Protocol Support**: Excellent BLE advertising data parsing
- **Rating**: 7.5/10 for industrial use
- **Ideal For**: Field technicians, developers, security auditors, small deployments

## Use Cases

### Ideal For:
- Field service technicians reading NFC asset tags
- BLE beacon deployment testing and debugging
- Security auditing and rogue device discovery
- Prototype development and lab testing
- Small IoT deployments (<100 devices)

### Limitations:
- Not suitable for large-scale industrial deployments
- Lacks UHF RFID support for warehouse operations
- No GATT service read/write (BLE connections unused)
- Limited to HTTP POST (no MQTT, CoAP, WebSocket)
- No offline data buffering

## Permissions

### Android
- `BLUETOOTH_SCAN` - Scan for BLE devices
- `BLUETOOTH_CONNECT` - Connect to BLE devices
- `ACCESS_FINE_LOCATION` - Required for BLE scanning
- `NFC` - Read/write NFC tags

### iOS
- `NSBluetoothAlwaysUsageDescription` - BLE scanning
- `NFCReaderUsageDescription` - NFC tag reading

## Technology Stack
- **Framework**: React Native 0.81.4
- **Language**: TypeScript 5.8.3
- **Navigation**: React Navigation 7.x
- **NFC**: react-native-nfc-manager 3.17.1
- **BLE**: react-native-ble-manager 12.2.2
- **Platforms**: iOS & Android

## License

MIT License - see [LICENSE](LICENSE) for details

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

All PRs must pass CI checks (linting, tests, type checking).

## Roadmap

### Short-Term (1-2 weeks)
- [ ] HTTPS enforcement for gateway URLs
- [ ] Scan history storage (AsyncStorage)
- [ ] CSV/JSON export for scan data
- [ ] ISO15693 tag authentication support

### Medium-Term (1-2 months)
- [ ] MQTT gateway support
- [ ] GATT service browser (BLE characteristic read/write)
- [ ] ISO14443A and Mifare Classic support
- [ ] Offline gateway queue (SQLite)

### Long-Term (3-6 months)
- [ ] User authentication (Firebase Auth)
- [ ] Cloud sync backend API
- [ ] Automated workflows (tag scanning triggers actions)
- [ ] Web dashboard for gateway monitoring
- [ ] BLE Mesh support

## Support

- **Issues**: [GitHub Issues](https://github.com/mikro-design/mikrod_util/issues)
- **Documentation**: See [ANALYSIS.md](ANALYSIS.md) and [.github/workflows/README.md](.github/workflows/README.md)

## Acknowledgments

- Built with [React Native](https://reactnative.dev/)
- NFC support via [react-native-nfc-manager](https://github.com/revtel/react-native-nfc-manager)
- BLE support via [react-native-ble-manager](https://github.com/innoveit/react-native-ble-manager)
- Navigation via [React Navigation](https://reactnavigation.org/)

---

**Note**: This tool is designed for authorized security testing, development, and field service applications. Always obtain proper authorization before scanning or modifying NFC tags or BLE devices.
