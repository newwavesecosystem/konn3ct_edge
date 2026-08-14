import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Globe,
  SunMedium,
  Moon,
  MonitorSmartphone,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { useLanguageStore } from '../store/useLanguageStore';
import { t } from '../config/translations';
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

const LANGUAGES = [
  { id: 'en', label: 'English', native: 'English' },
  { id: 'fr', label: 'French', native: 'Français' },
  { id: 'sw', label: 'Swahili', native: 'Kiswahili' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [activeTheme, setActiveTheme] = useState('system');
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const { lang, setLang } = useLanguageStore();
  const activeLanguage = LANGUAGES.find((l) => l.id === lang) ?? LANGUAGES[0];

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 24) : 24 }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.modalTitle}>{t(lang, 'settings')}</Text>
          <Text style={styles.modalSubtitle}>{t(lang, 'settings_subtitle')}</Text>
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
          <Text style={styles.sectionTitle}>{t(lang, 'general')}</Text>

          {/* Language Selection */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>{t(lang, 'language')}</Text>
                <Text style={styles.cardDesc}>{t(lang, 'language_desc')}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.dropdownBtn}
              activeOpacity={0.7}
              onPress={() => setLangPickerVisible(true)}
            >
              <Globe size={18} color={COLORS.textMuted} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.dropdownText}>{activeLanguage.label}</Text>
                {activeLanguage.native !== activeLanguage.label && (
                  <Text style={styles.dropdownNative}>{activeLanguage.native}</Text>
                )}
              </View>
              <ChevronDown size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Appearance Selection */}
          {!APP_CONFIG.GOV_LOGIN && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>{t(lang, 'appearance')}</Text>
                  <Text style={styles.cardDesc}>{t(lang, 'appearance_desc')}</Text>
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

      {/* ===== LANGUAGE PICKER BOTTOM SHEET ===== */}
      <Modal
        visible={langPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangPickerVisible(false)}
      >
        <Pressable style={styles.langOverlay} onPress={() => setLangPickerVisible(false)}>
          <Pressable style={[styles.langSheet, { paddingBottom: Math.max(insets.bottom, 24) }]} onPress={() => {}}>
            <View style={styles.langHandle} />

            <Text style={styles.langSheetTitle}>{t(lang, 'select_language')}</Text>
            <Text style={styles.langSheetSubtitle}>{t(lang, 'language_desc')}</Text>

            <View style={styles.langList}>
              {LANGUAGES.map((option) => {
                const isSelected = activeLanguage.id === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.langRow, isSelected && styles.langRowActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setLang(option.id as any);
                      setLangPickerVisible(false);
                    }}
                  >
                    <View style={styles.langRowLeft}>
                      <View style={[styles.langDot, isSelected && styles.langDotActive]}>
                        <Globe size={16} color={isSelected ? '#fff' : COLORS.textMuted} />
                      </View>
                      <View>
                        <Text style={[styles.langLabel, isSelected && styles.langLabelActive]}>
                          {option.label}
                        </Text>
                        {option.native !== option.label && (
                          <Text style={styles.langNative}>{option.native}</Text>
                        )}
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.langCheckCircle}>
                        <Check size={14} color="#fff" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.langCancelBtn}
              activeOpacity={0.8}
              onPress={() => setLangPickerVisible(false)}
            >
              <Text style={styles.langCancelText}>{t(lang, 'cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  scrollContent: { paddingTop: 24 },
  section: { paddingHorizontal: 20, gap: 16 },
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

  // Language Dropdown Button
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dropdownNative: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // Language Picker Modal
  langOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  langSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  langHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  langSheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  langSheetSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  langList: {
    gap: 10,
    marginBottom: 20,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langRowActive: {
    backgroundColor: 'rgba(32,116,80,0.06)',
    borderColor: 'rgba(32,116,80,0.25)',
  },
  langRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  langDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langDotActive: {
    backgroundColor: COLORS.brandGreen,
  },
  langLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  langLabelActive: {
    color: COLORS.brandGreen,
  },
  langNative: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  langCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.brandGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langCancelBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMuted,
  },

  // Themes
  themeContainer: { gap: 12 },
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
  iconBoxActive: { backgroundColor: COLORS.brandGreen },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: { borderColor: COLORS.brandGreen },
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
  themeTitleActive: { color: COLORS.brandGreen },
  themeDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});
