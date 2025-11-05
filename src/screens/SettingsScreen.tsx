import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { useFavorites } from '../context/FavoritesContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ExportImportModal from '../components/ExportImportModal';

const SettingsScreen = () => {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const { favorites } = useFavorites();
  const [showExportModal, setShowExportModal] = useState(false);

  const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Light', icon: 'white-balance-sunny' },
    { mode: 'dark', label: 'Dark', icon: 'moon-waning-crescent' },
    { mode: 'auto', label: 'Auto (System)', icon: 'theme-light-dark' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.content}>
        {/* Theme Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="palette" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Appearance
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
            Choose your preferred theme for the app
          </Text>

          {themeOptions.map((option) => (
            <TouchableOpacity
              key={option.mode}
              style={[
                styles.themeOption,
                { borderBottomColor: theme.colors.border },
              ]}
              onPress={() => setThemeMode(option.mode)}>
              <View style={styles.themeOptionContent}>
                <Icon
                  name={option.icon}
                  size={24}
                  color={theme.colors.textSecondary}
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.themeOptionLabel, { color: theme.colors.text }]}>
                  {option.label}
                </Text>
              </View>
              {themeMode === option.mode && (
                <Icon name="check-circle" size={24} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Data Management Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="database" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Data Management
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
            Export, import, and manage your data
          </Text>

          <TouchableOpacity
            style={[styles.themeOption, { borderBottomColor: theme.colors.border }]}
            onPress={() => setShowExportModal(true)}>
            <View style={styles.themeOptionContent}>
              <Icon name="export" size={24} color={theme.colors.success} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                  Export / Import
                </Text>
                <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                  Backup and restore your data
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.themeOption, { borderBottomWidth: 0 }]}>
            <View style={styles.themeOptionContent}>
              <Icon name="star" size={24} color="#FF9500" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                  Favorites
                </Text>
                <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                  {favorites.length} saved devices
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* App Info Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="information" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              About
            </Text>
          </View>

          <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              App Name
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              Mikrod Util
            </Text>
          </View>

          <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Version
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              0.0.1
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Current Theme
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {isDark ? 'Dark' : 'Light'}
            </Text>
          </View>
        </View>

        {/* Features Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="feature-search" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Features
            </Text>
          </View>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Icon name="nfc" size={20} color={theme.colors.success} style={{ marginRight: 8 }} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                NFC Tag Reading & Writing
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Icon name="bluetooth" size={20} color={theme.colors.info} style={{ marginRight: 8 }} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                BLE Device Scanning
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Icon name="chart-line" size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                RSSI Signal Graphs
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Icon name="memory" size={20} color={theme.colors.error} style={{ marginRight: 8 }} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                Hex Memory Editor
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Icon name="router-wireless" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                BLE Gateway Mode
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <ExportImportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        scanData={[]}
        dataType="ble"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    marginLeft: 28,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  themeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeOptionLabel: {
    fontSize: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  featureList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureText: {
    fontSize: 14,
  },
});

export default SettingsScreen;
