import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

interface NDEFTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type TemplateType = 'url' | 'text' | 'phone' | 'email' | 'wifi' | 'location';

interface Template {
  type: TemplateType;
  label: string;
  icon: string;
  color: string;
}

const templates: Template[] = [
  { type: 'url', label: 'Website URL', icon: 'web', color: '#007AFF' },
  { type: 'text', label: 'Plain Text', icon: 'text', color: '#34C759' },
  { type: 'phone', label: 'Phone Number', icon: 'phone', color: '#FF9500' },
  { type: 'email', label: 'Email Address', icon: 'email', color: '#FF3B30' },
  { type: 'wifi', label: 'WiFi Credentials', icon: 'wifi', color: '#5AC8FA' },
  { type: 'location', label: 'GPS Location', icon: 'map-marker', color: '#AF52DE' },
];

const NDEFTemplateModal: React.FC<NDEFTemplateModalProps> = ({ visible, onClose, onSuccess }) => {
  const { theme } = useTheme();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [isWriting, setIsWriting] = useState(false);

  // Form values
  const [url, setUrl] = useState('https://');
  const [text, setText] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiSecurity, setWifiSecurity] = useState<'WPA' | 'WEP' | 'open'>('WPA');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const handleTemplateSelect = (type: TemplateType) => {
    setSelectedTemplate(type);
  };

  const handleBack = () => {
    setSelectedTemplate(null);
  };

  const handleWrite = async () => {
    if (!selectedTemplate) return;

    try {
      setIsWriting(true);

      let bytes: number[] = [];

      switch (selectedTemplate) {
        case 'url':
          if (!url || url === 'https://') {
            Alert.alert('Invalid URL', 'Please enter a valid URL');
            return;
          }
          bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
          break;

        case 'text':
          if (!text.trim()) {
            Alert.alert('Invalid Text', 'Please enter some text');
            return;
          }
          bytes = Ndef.encodeMessage([Ndef.textRecord(text)]);
          break;

        case 'phone':
          if (!phone.trim()) {
            Alert.alert('Invalid Phone', 'Please enter a phone number');
            return;
          }
          bytes = Ndef.encodeMessage([Ndef.uriRecord(`tel:${phone}`)]);
          break;

        case 'email':
          if (!email.trim()) {
            Alert.alert('Invalid Email', 'Please enter an email address');
            return;
          }
          bytes = Ndef.encodeMessage([Ndef.uriRecord(`mailto:${email}`)]);
          break;

        case 'wifi':
          if (!wifiSSID.trim()) {
            Alert.alert('Invalid WiFi', 'Please enter an SSID');
            return;
          }
          // WiFi format: android.com:pkg type with custom payload
          const wifiPayload = `WIFI:T:${wifiSecurity};S:${wifiSSID};P:${wifiPassword};;`;
          bytes = Ndef.encodeMessage([Ndef.textRecord(wifiPayload)]);
          break;

        case 'location':
          if (!latitude.trim() || !longitude.trim()) {
            Alert.alert('Invalid Location', 'Please enter latitude and longitude');
            return;
          }
          bytes = Ndef.encodeMessage([Ndef.uriRecord(`geo:${latitude},${longitude}`)]);
          break;
      }

      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Hold your device near an NFC tag to write',
      });

      // Write the NDEF message
      await NfcManager.ndefHandler.writeNdefMessage(bytes);

      Alert.alert('Success', 'NDEF message written successfully!');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Write error:', error);
      Alert.alert('Write Error', error.message || 'Failed to write NDEF message');
    } finally {
      setIsWriting(false);
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setUrl('https://');
    setText('');
    setPhone('');
    setEmail('');
    setWifiSSID('');
    setWifiPassword('');
    setWifiSecurity('WPA');
    setLatitude('');
    setLongitude('');
  };

  const renderTemplateForm = () => {
    switch (selectedTemplate) {
      case 'url':
        return (
          <View>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Website URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={url}
              onChangeText={setUrl}
              placeholder="https://example.com"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        );

      case 'text':
        return (
          <View>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Text Message</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={text}
              onChangeText={setText}
              placeholder="Enter your text here..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
            />
          </View>
        );

      case 'phone':
        return (
          <View>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1234567890"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
            />
          </View>
        );

      case 'email':
        return (
          <View>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={email}
              onChangeText={setEmail}
              placeholder="user@example.com"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        );

      case 'wifi':
        return (
          <View>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Network Name (SSID)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={wifiSSID}
              onChangeText={setWifiSSID}
              placeholder="MyWiFiNetwork"
              placeholderTextColor={theme.colors.textSecondary}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginTop: 12 }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={wifiPassword}
              onChangeText={setWifiPassword}
              placeholder="********"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginTop: 12 }]}>Security Type</Text>
            <View style={styles.securityButtons}>
              {(['WPA', 'WEP', 'open'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.securityButton,
                    wifiSecurity === type && { backgroundColor: theme.colors.primary },
                    { borderColor: theme.colors.border }
                  ]}
                  onPress={() => setWifiSecurity(type)}>
                  <Text style={[
                    styles.securityButtonText,
                    { color: wifiSecurity === type ? 'white' : theme.colors.text }
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'location':
        return (
          <View>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Latitude</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={latitude}
              onChangeText={setLatitude}
              placeholder="37.7749"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginTop: 12 }]}>Longitude</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={longitude}
              onChangeText={setLongitude}
              placeholder="-122.4194"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="numeric"
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={selectedTemplate ? handleBack : onClose}>
              <Icon name={selectedTemplate ? "arrow-left" : "close"} size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {selectedTemplate ? 'Write NDEF Message' : 'Choose Template'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalBody}>
            {!selectedTemplate ? (
              <View style={styles.templatesGrid}>
                {templates.map((template) => (
                  <TouchableOpacity
                    key={template.type}
                    style={[styles.templateCard, { backgroundColor: theme.colors.background }]}
                    onPress={() => handleTemplateSelect(template.type)}>
                    <Icon name={template.icon} size={36} color={template.color} />
                    <Text style={[styles.templateLabel, { color: theme.colors.text }]}>
                      {template.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.formContainer}>
                {renderTemplateForm()}

                <TouchableOpacity
                  style={[styles.writeButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleWrite}
                  disabled={isWriting}>
                  <Icon name="nfc" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.writeButtonText}>
                    {isWriting ? 'Writing...' : 'Write to Tag'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  templateCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  formContainer: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  securityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  securityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  securityButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  writeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NDEFTemplateModal;
