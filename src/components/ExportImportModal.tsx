import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Share,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useFavorites } from '../context/FavoritesContext';

interface ExportImportModalProps {
  visible: boolean;
  onClose: () => void;
  scanData?: any[];
  dataType: 'ble' | 'nfc';
}

interface ExportData {
  appName: string;
  version: string;
  exportDate: string;
  dataType: 'ble' | 'nfc';
  scanData: any[];
  favorites: any[];
  settings: {
    theme: string;
  };
}

const ExportImportModal: React.FC<ExportImportModalProps> = ({
  visible,
  onClose,
  scanData = [],
  dataType,
}) => {
  const { theme, themeMode } = useTheme();
  const { favorites } = useFavorites();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (includeSettings: boolean = true) => {
    try {
      setIsExporting(true);

      const exportData: ExportData = {
        appName: 'Mikrod Util',
        version: '0.0.1',
        exportDate: new Date().toISOString(),
        dataType,
        scanData,
        favorites: includeSettings ? favorites : [],
        settings: includeSettings
          ? {
              theme: themeMode,
            }
          : { theme: 'auto' },
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const fileName = `mikrod_${dataType}_export_${Date.now()}.json`;

      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        // Use Share API for mobile
        await Share.share({
          message: jsonString,
          title: `Export ${dataType.toUpperCase()} Data`,
        });
      }

      Alert.alert('Export Successful', `Data exported as ${fileName}`);
      onClose();
    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Export Error', error.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    Alert.alert(
      'Import Data',
      'Import functionality requires file picker. This would allow you to select a previously exported JSON file to restore your data.\n\nNote: This is a placeholder for the full implementation.',
      [{ text: 'OK' }],
    );
    // TODO: Implement file picker and JSON parsing
    // This would use react-native-document-picker or similar
  };

  const handleExportFavoritesOnly = async () => {
    try {
      setIsExporting(true);

      const exportData = {
        appName: 'Mikrod Util',
        version: '0.0.1',
        exportDate: new Date().toISOString(),
        type: 'favorites',
        favorites,
      };

      const jsonString = JSON.stringify(exportData, null, 2);

      await Share.share({
        message: jsonString,
        title: 'Export Favorites',
      });

      Alert.alert('Success', 'Favorites exported successfully');
    } catch (error: any) {
      Alert.alert(
        'Export Error',
        error.message || 'Failed to export favorites',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportScanDataOnly = async () => {
    try {
      setIsExporting(true);

      const exportData = {
        appName: 'Mikrod Util',
        version: '0.0.1',
        exportDate: new Date().toISOString(),
        dataType,
        scanData,
        count: scanData.length,
      };

      const jsonString = JSON.stringify(exportData, null, 2);

      await Share.share({
        message: jsonString,
        title: `Export ${dataType.toUpperCase()} Scans`,
      });

      Alert.alert('Success', `Exported ${scanData.length} scan records`);
    } catch (error: any) {
      Alert.alert(
        'Export Error',
        error.message || 'Failed to export scan data',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);

      let csvContent = '';

      if (dataType === 'ble') {
        csvContent = 'Device Name,Address,RSSI,Last Seen,Manufacturer\n';
        scanData.forEach((device: any) => {
          csvContent += `"${device.name || 'Unknown'}","${device.id}",${
            device.rssi
          },"${new Date(device.lastSeen).toISOString()}","${
            device.advertising?.manufacturerData || ''
          }"\n`;
        });
      } else if (dataType === 'nfc') {
        csvContent = 'Tag ID,Type,Tech Types,Timestamp,NDEF Message\n';
        scanData.forEach((tag: any) => {
          csvContent += `"${tag.id}","${tag.type}","${tag.techTypes.join(
            ';',
          )}","${tag.timestamp}","${tag.ndefMessage || ''}"\n`;
        });
      }

      await Share.share({
        message: csvContent,
        title: `Export ${dataType.toUpperCase()} Data (CSV)`,
      });

      Alert.alert('Success', 'Data exported as CSV format');
    } catch (error: any) {
      Alert.alert('Export Error', error.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View
          style={[styles.modalContent, { backgroundColor: theme.colors.card }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Export / Import Data
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Export Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="export" size={20} color={theme.colors.primary} />
                <Text
                  style={[styles.sectionTitle, { color: theme.colors.text }]}
                >
                  Export Options
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.colors.background },
                ]}
                onPress={() => handleExport(true)}
                disabled={isExporting}
              >
                <View style={styles.optionContent}>
                  <Icon
                    name="database-export"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={[styles.optionTitle, { color: theme.colors.text }]}
                    >
                      Export Everything
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Scans, favorites, and settings
                    </Text>
                  </View>
                </View>
                <Icon
                  name="chevron-right"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.colors.background },
                ]}
                onPress={handleExportScanDataOnly}
                disabled={isExporting || scanData.length === 0}
              >
                <View style={styles.optionContent}>
                  <Icon name="radar" size={24} color={theme.colors.success} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={[styles.optionTitle, { color: theme.colors.text }]}
                    >
                      Export Scan Data Only
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {scanData.length} {dataType.toUpperCase()} records (JSON)
                    </Text>
                  </View>
                </View>
                <Icon
                  name="chevron-right"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.colors.background },
                ]}
                onPress={handleExportCSV}
                disabled={isExporting || scanData.length === 0}
              >
                <View style={styles.optionContent}>
                  <Icon
                    name="file-delimited"
                    size={24}
                    color={theme.colors.warning}
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={[styles.optionTitle, { color: theme.colors.text }]}
                    >
                      Export as CSV
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Spreadsheet-compatible format
                    </Text>
                  </View>
                </View>
                <Icon
                  name="chevron-right"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.colors.background },
                ]}
                onPress={handleExportFavoritesOnly}
                disabled={isExporting || favorites.length === 0}
              >
                <View style={styles.optionContent}>
                  <Icon name="star" size={24} color="#FF9500" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={[styles.optionTitle, { color: theme.colors.text }]}
                    >
                      Export Favorites Only
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {favorites.length} favorite devices
                    </Text>
                  </View>
                </View>
                <Icon
                  name="chevron-right"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Import Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="import" size={20} color={theme.colors.primary} />
                <Text
                  style={[styles.sectionTitle, { color: theme.colors.text }]}
                >
                  Import Options
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.colors.background },
                ]}
                onPress={handleImport}
              >
                <View style={styles.optionContent}>
                  <Icon
                    name="file-upload"
                    size={24}
                    color={theme.colors.info}
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={[styles.optionTitle, { color: theme.colors.text }]}
                    >
                      Import from File
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Restore from exported JSON
                    </Text>
                  </View>
                </View>
                <Icon
                  name="chevron-right"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              <View
                style={[
                  styles.infoBox,
                  { backgroundColor: theme.colors.background },
                ]}
              >
                <Icon
                  name="information"
                  size={16}
                  color={theme.colors.info}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.infoText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Exported data is saved in JSON or CSV format and can be shared
                  via email, cloud storage, or messaging apps.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
});

export default ExportImportModal;
