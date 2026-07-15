import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Headset,
  Bell,
  Shield,
  Monitor,
  Lock,
  Copy,
  LogOut,
  ChevronRight,
  User,
  CreditCard,
  Smartphone,
} from 'lucide-react-native';

import { useNavigation } from '@react-navigation/native';
import { fetchProfile, updateProfile, updatePassword, ProfileData } from '../api/profile';
import { useAuthStore } from '../store/useAuthStore';
import { APP_CONFIG } from '../config/appConfig';
import * as Device from 'expo-device';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
  amber: '#f59e0b',
  overlay: 'rgba(0,0,0,0.4)',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, login } = useAuthStore();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal states
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  
  // Form states
  const [formFirstname, setFormFirstname] = useState('');
  const [formLastname, setFormLastname] = useState('');
  const [formPhone, setFormPhone] = useState('');
  
  const [formCurrentPassword, setFormCurrentPassword] = useState('');
  const [formNewPassword, setFormNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchProfile();
      setProfile(data);
    } catch (e) {
      console.error('Failed to load profile', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Derived values from state or fallback
  const firstName = user?.name?.split(' ')[0] || 'User'; // For greeting
  const actualFirstName = profile?.user?.firstname || '';
  const actualLastName = profile?.user?.lastname || '';
  const displayProfileName = (actualFirstName || actualLastName) 
    ? `${actualLastName} ${actualFirstName}`.trim() 
    : (user?.name || 'User');
    
  const email = profile?.user?.email || user?.email || 'user@example.com';
  const phone = profile?.user?.phone || '';
  const plan = profile?.user_plan?.name || 'Basic Plan';
  const referralCode = profile?.user?.referral_code || 'KONN3CT-2026';
  const referralLink = `https://konn3ct.com/r/${referralCode}`;
  
  const handleEditProfilePress = () => {
    setFormFirstname(actualFirstName || user?.name?.split(' ')[1] || '');
    setFormLastname(actualLastName || user?.name?.split(' ')[0] || '');
    setFormPhone(phone);
    setEditModalVisible(true);
  };

  const submitEditProfile = async () => {
    if (!formFirstname) return Alert.alert('Error', 'First name is required');
    setIsSubmitting(true);
    try {
      await updateProfile({ firstname: formFirstname, lastname: formLastname, phone: formPhone });
      Alert.alert('Success', 'Profile updated successfully');
      setEditModalVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitUpdatePassword = async () => {
    if (!formCurrentPassword || !formNewPassword) return Alert.alert('Error', 'Please fill all password fields');
    setIsSubmitting(true);
    try {
      await updatePassword({ current_password: formCurrentPassword, new_password: formNewPassword });
      Alert.alert('Success', 'Password updated successfully');
      setPasswordModalVisible(false);
      setFormCurrentPassword('');
      setFormNewPassword('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarPress = () => {
    // optional avatar upload logic later
  };

  const handleCopy = (text: string) => {
    console.log('Copied:', text);
  };

  const handleLogout = () => {
    console.log('Logout pressed');
  };

  return (
    <View style={styles.container}>
      {/* ===== STICKY HEADER ===== */}
      <View style={[styles.stickyHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.stickyHeaderLeft}>
          <TouchableOpacity style={styles.avatarLogoContainer} onPress={handleAvatarPress} activeOpacity={0.8}>
            <View style={styles.avatarRing}>
              <Text style={styles.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>2</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.stickyHeaderName}>Hi, {firstName.toUpperCase()}</Text>
        </View>

        <View style={styles.stickyHeaderRight}>
          {APP_CONFIG.SHOW_HELP_ICON && (
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Headset color={COLORS.textPrimary} size={24} />
          </TouchableOpacity>
          )}

          {APP_CONFIG.SHOW_NOTIFICATIONS && (
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => (navigation.navigate as any)('Notifications')}>
            <Bell color={COLORS.textPrimary} size={24} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>20</Text>
            </View>
          </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Text style={styles.pageSubtitle}>Manage your account preferences and profile.</Text>
        </View>

        {/* --- Profile Info & Plan Card --- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: `${COLORS.brandBlue}15` }]}>
              <User color={COLORS.brandBlue} size={20} />
            </View>
            <View style={styles.cardHeaderTextGroup}>
              <Text style={styles.cardTitle}>Profile Information</Text>
              <Text style={styles.cardSubtitle}>Your personal details and active plan</Text>
            </View>
          </View>
          
          <View style={styles.cardBody}>
            <View style={styles.profileMetaRow}>
              <View style={styles.profileMetaAvatar}>
                <Text style={styles.profileMetaInitial}>{firstName.charAt(0)}</Text>
              </View>
              <View style={styles.profileMetaText}>
                <Text style={styles.profileName}>{displayProfileName}</Text>
                <Text style={styles.profileEmail}>{email}</Text>
              </View>
              <TouchableOpacity style={styles.outlineBtnSmall} onPress={handleEditProfilePress}>
                <Text style={styles.outlineBtnSmallText}>Edit</Text>
              </TouchableOpacity>
            </View>

            {!APP_CONFIG.GOV_LOGIN && (
              <>
                <View style={styles.divider} />

                <View style={styles.planInfoBox}>
                  <View style={styles.planInfoLeft}>
                    <CreditCard color={COLORS.textPrimary} size={18} />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.planName}>{plan}</Text>
                      <Text style={styles.planDesc}>Current subscription plan</Text>
                    </View>
                  </View>
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>ACTIVE</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* --- Referral Card --- */}
        {!APP_CONFIG.GOV_LOGIN && (
          <View style={styles.card}>
            <View style={styles.cardBody}>
              <View style={styles.referralHeaderRow}>
                <Text style={styles.cardTitle}>Referral Program</Text>
                <View style={styles.referralCodeBox}>
                  <Text style={styles.referralCodeText}>{referralCode}</Text>
                  <TouchableOpacity onPress={() => handleCopy(referralCode)} style={styles.iconBtnSmall}>
                    <Copy color={COLORS.textMuted} size={14} />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={{ marginTop: 16 }}>
                <Text style={styles.inputLabel}>Referral Link</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    value={referralLink}
                    editable={false}
                  />
                  <TouchableOpacity onPress={() => handleCopy(referralLink)} style={styles.outlineBtnSquare}>
                    <Copy color={COLORS.textPrimary} size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* --- Security Card --- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: `${COLORS.brandBlue}15` }]}>
              <Shield color={COLORS.brandBlue} size={20} />
            </View>
            <View style={styles.cardHeaderTextGroup}>
              <Text style={styles.cardTitle}>Security</Text>
              <Text style={styles.cardSubtitle}>Manage your password and authentication</Text>
            </View>
          </View>
          
          <View style={styles.cardBody}>
            <TouchableOpacity style={styles.actionRowBtn} activeOpacity={0.7} onPress={() => setPasswordModalVisible(true)}>
              <View style={styles.actionRowLeft}>
                <View style={styles.actionRowIconBox}>
                  <Lock color={COLORS.textMuted} size={18} />
                </View>
                <View>
                  <Text style={styles.actionRowTitle}>Password</Text>
                  <Text style={styles.actionRowSubtitle}>Keep your account secure</Text>
                </View>
              </View>
              <View style={styles.outlineBtnSmall}>
                <Text style={styles.outlineBtnSmallText}>Change</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- Active Sessions Card --- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: `${COLORS.amber}15` }]}>
              <Monitor color={COLORS.amber} size={20} />
            </View>
            <View style={styles.cardHeaderTextGroup}>
              <Text style={styles.cardTitle}>Active Sessions</Text>
              <Text style={styles.cardSubtitle}>Manage devices logged into your account</Text>
            </View>
          </View>
          
          <View style={styles.cardBody}>
            <View style={styles.actionRowBtn}>
              <View style={styles.actionRowLeft}>
                <View style={styles.actionRowIconBox}>
                  <Smartphone color={COLORS.textMuted} size={18} />
                </View>
                <View>
                  <Text style={styles.actionRowTitle}>{Device.modelName || Device.deviceName || (Platform.OS === 'ios' ? 'iOS Device' : 'Android Device')} - App</Text>
                  <Text style={styles.actionRowSubtitle}>Lagos, Nigeria • <Text style={{ color: COLORS.brandGreen }}>This device</Text></Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.outlineBtnSmall, { borderColor: `${COLORS.danger}30` }]}>
                <Text style={[styles.outlineBtnSmallText, { color: COLORS.danger }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.closeModalText}>Close</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput style={styles.textInputFull} value={formFirstname} onChangeText={setFormFirstname} />

                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput style={styles.textInputFull} value={formLastname} onChangeText={setFormLastname} />

                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput style={styles.textInputFull} value={formPhone} onChangeText={setFormPhone} keyboardType="phone-pad" />
              </ScrollView>
              <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
                <TouchableOpacity style={styles.primaryBtn} onPress={submitEditProfile} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={isPasswordModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                  <Text style={styles.closeModalText}>Close</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput style={styles.textInputFull} value={formCurrentPassword} onChangeText={setFormCurrentPassword} secureTextEntry />

                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput style={styles.textInputFull} value={formNewPassword} onChangeText={setFormNewPassword} secureTextEntry />
              </ScrollView>
              <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
                <TouchableOpacity style={styles.primaryBtn} onPress={submitUpdatePassword} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },
  
  // Sticky Header
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    zIndex: 10,
  },
  stickyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarLogoContainer: {
    position: 'relative',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#10B981', // green ring
    backgroundColor: 'rgba(16, 185, 129, 0.15)', // light green bg
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -6,
    right: -8,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.pageBg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  avatarBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  stickyHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: -0.3,
  },
  stickyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.pageBg,
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Main Content
  scrollContent: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  pageHeader: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
  },

  // Cards
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 0,
    gap: 12,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderTextGroup: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cardBody: {
    padding: 20,
  },

  // Profile Specific
  profileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileMetaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.brandBlue}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileMetaInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.brandBlue,
  },
  profileMetaText: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  outlineBtnSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  outlineBtnSmallText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  planInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  planDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  planBadge: {
    backgroundColor: `${COLORS.brandGreen}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brandGreen,
  },

  // Referral Specific
  referralHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  referralCodeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  iconBtnSmall: {
    padding: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: COLORS.textMuted,
    fontSize: 13,
  },
  outlineBtnSquare: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Action Rows
  actionRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionRowIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  actionRowSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.pageBg,
    height: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeModalText: {
    fontSize: 16,
    color: COLORS.danger,
    fontWeight: '600',
  },
  textInputFull: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    marginBottom: 16,
    color: COLORS.textPrimary,
  },
  modalFooter: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  primaryBtn: {
    backgroundColor: COLORS.brandBlue,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
