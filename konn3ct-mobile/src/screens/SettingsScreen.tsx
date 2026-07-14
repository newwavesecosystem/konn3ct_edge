import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Globe,
  SunMedium,
  Moon,
  MonitorSmartphone,
  ChevronDown,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { APP_CONFIG } from '../config/appConfig';

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
};

const THEMES = [
  { id: 'light', title: 'Light', desc: 'A bright, clean interface.', icon: SunMedium },
  { id: 'dark', title: 'Dark', desc: 'Easy on the eyes, great for night.', icon: Moon },
  { id: 'system', title: 'System', desc: 'Adapts to your device settings.', icon: MonitorSmartphone },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [activeTheme, setActiveTheme] = useState('system');
  const [activeLanguage, setActiveLanguage] = useState('English');

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 24) : 24 }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.modalTitle}>Settings</Text>
          <Text style={styles.modalSubtitle}>Manage your account preferences and profile.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          
          {/* Language Selection */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Language</Text>
                <Text style={styles.cardDesc}>Choose the language used across your app.</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.dropdownBtn}>
              <Globe size={18} color={COLORS.textMuted} />
              <Text style={styles.dropdownText}>{activeLanguage}</Text>
              <View style={{ flex: 1 }} />
              <ChevronDown size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Appearance Selection */}
          {!APP_CONFIG.GOV_LOGIN && (
            <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Appearance</Text>
                <Text style={styles.cardDesc}>Customize how the app looks on your device.</Text>
              </View>
            </View>

            <View style={styles.themeContainer}>
              {THEMES.map((theme) => {
                const isSelected = activeTheme === theme.id;
                const Icon = theme.icon;

                return (
                  <TouchableOpacity
                    key={theme.id}
                    style={[styles.themeCard, isSelected && styles.themeCardActive]}
                    activeOpacity={0.8}
                    onPress={() => setActiveTheme(theme.id)}
                  >
                    <View style={styles.themeCardHeader}>
                      <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                        <Icon size={20} color={isSelected ? '#fff' : COLORS.textMuted} />
                      </View>
                      <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </View>
                    <Text style={[styles.themeTitle, isSelected && styles.themeTitleActive]}>
                      {theme.title}
                    </Text>
                    <Text style={styles.themeDesc}>{theme.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },
  
  // Header
  modalHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 10,
  },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4, lineHeight: 20 },
  closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 12 },

  // Main Content
  scrollContent: {
    paddingTop: 24,
  },
  section: {
    paddingHorizontal: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
  },

  // Language Dropdown
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Themes
  themeContainer: {
    gap: 12,
  },
  themeCard: {
    backgroundColor: 'rgba(0,0,0,0.01)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  themeCardActive: {
    backgroundColor: 'rgba(32, 116, 80, 0.05)',
    borderColor: 'rgba(32, 116, 80, 0.2)',
  },
  themeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxActive: {
    backgroundColor: COLORS.brandGreen,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: {
    borderColor: COLORS.brandGreen,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.brandGreen,
  },
  themeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  themeTitleActive: {
    color: COLORS.brandGreen,
  },
  themeDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});
