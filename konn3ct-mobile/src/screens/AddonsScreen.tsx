import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Layers,
  HardDrive,
  BarChart3,
  Headset,
  ArrowRight,
  CheckCircle2,
  Bell,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandBlueDark: '#001D5C',
  brandGreen: '#207450',
  brandGreenDark: '#145339',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
};

const MOCK_ADDONS = [
  {
    id: 'ai_analytics',
    name: 'Advanced AI Analytics',
    description: 'Get deep insights into attendee engagement, drop-off rates, and sentiment analysis for all your meetings.',
    price: 15000,
    status: 'inactive',
    icon: BarChart3,
    colors: ['#3b82f6', '#2563eb'], // Blue gradient
  },
  {
    id: 'storage_expansion',
    name: 'Cloud Storage Expansion',
    description: 'Add an extra 500GB of secure cloud storage for your meeting recordings and shared documents.',
    price: 5000,
    status: 'active',
    icon: HardDrive,
    colors: ['#8b5cf6', '#7c3aed'], // Purple gradient
  },
  {
    id: 'premium_support',
    name: '24/7 Premium Support',
    description: 'Priority access to our technical support team with a guaranteed 1-hour response time.',
    price: 25000,
    status: 'inactive',
    icon: Headset,
    colors: ['#ec4899', '#db2777'], // Pink gradient
  },
];

export default function AddonsScreen() {
  const insets = useSafeAreaInsets();
  
  // Mock user data for the header
  const firstName = 'KAYODE';
  
  const handleAvatarPress = () => {
    console.log('Avatar pressed');
  };

  const handlePurchase = (addon: any) => {
    console.log('Purchase clicked for:', addon.name);
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG').format(amount);
  };

  const renderAddonCard = (addon: typeof MOCK_ADDONS[0]) => {
    const isActive = addon.status === 'active';
    const Icon = addon.icon;

    return (
      <View key={addon.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={addon.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBox}
          >
            <Icon color="#ffffff" size={24} strokeWidth={2} />
          </LinearGradient>
          
          <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
            {isActive && <CheckCircle2 color={COLORS.brandGreen} size={12} style={{ marginRight: 4 }} />}
            <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {isActive ? 'ACTIVE' : 'AVAILABLE'}
            </Text>
          </View>
        </View>

        <Text style={styles.addonName}>{addon.name}</Text>
        <Text style={styles.addonDescription}>{addon.description}</Text>

        <View style={styles.priceContainer}>
          <Text style={styles.priceCurrency}>NGN</Text>
          <Text style={styles.priceAmount}>{formatPrice(addon.price)}</Text>
          <Text style={styles.pricePeriod}>/mo</Text>
        </View>

        <TouchableOpacity 
          style={styles.actionBtnContainer}
          activeOpacity={0.85}
          onPress={() => handlePurchase(addon)}
          disabled={isActive}
        >
          <LinearGradient
            colors={isActive ? [COLORS.brandGreen, COLORS.brandGreenDark] : [COLORS.brandBlue, COLORS.brandBlueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.actionBtn, isActive && { opacity: 0.8 }]}
          >
            <Text style={styles.actionBtnText}>{isActive ? 'Subscribed' : 'Subscribe Now'}</Text>
            {!isActive && <ArrowRight color="#ffffff" size={16} />}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
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
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Headset color={COLORS.textPrimary} size={24} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => (navigation.navigate as any)('Notifications')}>
            <Bell color={COLORS.textPrimary} size={24} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>20</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 20, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Banner */}
        <LinearGradient
          colors={[COLORS.brandBlue, COLORS.brandBlueDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerBanner}
        >
          <View style={styles.headerGlow} />
          <View style={styles.headerContent}>
            <View style={styles.headerIconWrapper}>
              <Layers color="#fff" size={24} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Add-ons & Services</Text>
              <Text style={styles.headerSubtitle}>Enhance your plan with premium features</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.grid}>
          {MOCK_ADDONS.map(renderAddonCard)}
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
  scrollContent: {
    paddingHorizontal: 20,
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
    backgroundColor: '#F43F5E', // rose/red
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

  // Header Banner
  headerBanner: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  headerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    flexWrap: 'wrap',
  },

  // Cards List
  grid: {
    gap: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: 'rgba(32, 116, 80, 0.08)',
    borderColor: 'rgba(32, 116, 80, 0.15)',
  },
  badgeInactive: {
    backgroundColor: COLORS.pageBg,
    borderColor: COLORS.border,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badgeTextActive: {
    color: COLORS.brandGreen,
  },
  badgeTextInactive: {
    color: COLORS.textMuted,
  },
  addonName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  addonDescription: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: 24,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  priceCurrency: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    marginRight: 4,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 4,
    marginLeft: 2,
  },
  actionBtnContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
