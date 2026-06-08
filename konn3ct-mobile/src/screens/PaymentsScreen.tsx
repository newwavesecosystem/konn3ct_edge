import React, { useState } from 'react';
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
  X,
  Zap,
  Crown,
  Shield,
  Check,
  ArrowRight,
  FileText,
  CreditCard,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  brandGreenLight: '#eef8f3',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
};

const MOCK_PLANS = {
  monthly: [
    { name: 'Basic', price: 'Free', target: 'For individuals', features: ['Recordings (No)', '40 mins duration', '100 Participants', '1 Room'], cta: 'Current Plan', popular: false, icon: Zap, color: '#94a3b8' },
    { name: 'Pro', price: 'NGN 15,000', target: 'For professionals', features: ['Recordings (Yes)', 'Unlimited duration', '500 Participants', '5 Rooms'], cta: 'Upgrade Now', popular: true, icon: Crown, color: COLORS.brandGreen },
    { name: 'Enterprise', price: 'Custom', target: 'For large organizations', features: ['Custom features', 'Dedicated support', 'Unlimited Participants', 'Unlimited Rooms'], cta: 'Contact Sales', popular: false, icon: Shield, color: COLORS.brandBlue },
  ],
  yearly: [
    { name: 'Basic', price: 'Free', target: 'For individuals', features: ['Recordings (No)', '40 mins duration', '100 Participants', '1 Room'], cta: 'Current Plan', popular: false, icon: Zap, color: '#94a3b8' },
    { name: 'Pro', price: 'NGN 150,000', target: 'For professionals', features: ['Recordings (Yes)', 'Unlimited duration', '500 Participants', '5 Rooms'], cta: 'Upgrade Now', popular: true, icon: Crown, color: COLORS.brandGreen },
    { name: 'Enterprise', price: 'Custom', target: 'For large organizations', features: ['Custom features', 'Dedicated support', 'Unlimited Participants', 'Unlimited Rooms'], cta: 'Contact Sales', popular: false, icon: Shield, color: COLORS.brandBlue },
  ]
};

const MOCK_INVOICES = [
  { id: 'inv-1', date: 'Oct 01, 2026', plan: 'PRO', ref: 'REF-837492A', amount: '15,000' },
  { id: 'inv-2', date: 'Sep 01, 2026', plan: 'PRO', ref: 'REF-392019B', amount: '15,000' },
  { id: 'inv-3', date: 'Aug 01, 2026', plan: 'PRO', ref: 'REF-119283C', amount: '15,000' },
];

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const renderPlanCard = (plan: any) => {
    const Icon = plan.icon;
    const isCurrent = plan.name === 'Basic';

    return (
      <View key={plan.name} style={[styles.planCard, plan.popular && styles.planCardPopular]}>
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>POPULAR</Text>
          </View>
        )}
        <View style={styles.planHeader}>
          <View style={[styles.planIconBox, { backgroundColor: `${plan.color}15` }]}>
            <Icon color={plan.color} size={24} />
          </View>
          <View>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planTarget}>{plan.target}</Text>
          </View>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.planPrice}>{plan.price}</Text>
          {plan.price !== 'Free' && plan.price !== 'Custom' && (
            <Text style={styles.planDuration}> / {billingCycle === 'monthly' ? 'mo' : 'yr'}</Text>
          )}
        </View>

        <View style={styles.featuresList}>
          {plan.features.map((feat: string, index: number) => (
            <View key={index} style={styles.featureItem}>
              <View style={[styles.checkCircle, { backgroundColor: plan.popular ? `${COLORS.brandGreen}15` : 'rgba(0,0,0,0.04)' }]}>
                <Check size={12} color={plan.popular ? COLORS.brandGreen : COLORS.textMuted} strokeWidth={3} />
              </View>
              <Text style={styles.featureText}>{feat}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.planBtn, isCurrent ? styles.planBtnCurrent : plan.popular ? styles.planBtnPopular : styles.planBtnNormal]}
          activeOpacity={0.8}
          disabled={isCurrent}
        >
          <Text style={[styles.planBtnText, isCurrent ? styles.planBtnTextCurrent : plan.popular ? styles.planBtnTextPopular : styles.planBtnTextNormal]}>
            {plan.cta}
          </Text>
          {!isCurrent && <ArrowRight size={16} color={plan.popular ? '#fff' : '#fff'} style={{marginLeft: 8}} />}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Math.max(insets.top, 24) }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.modalTitle}>Billing & Plans</Text>
          <Text style={styles.modalSubtitle}>Manage your subscription and billing details.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Plan Banner */}
        <View style={styles.activePlanCard}>
          <LinearGradient
            colors={[COLORS.brandGreenLight, '#ffffff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            borderRadius={16}
          />
          <View style={styles.activePlanContent}>
            <View style={styles.activePlanLeft}>
              <View style={styles.activeIconBox}>
                <Zap color="#fff" size={24} />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.activePlanTitle}>Basic Plan</Text>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                  </View>
                </View>
                <Text style={styles.activePlanEmail}>user@example.com</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Upgrade Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Choose a Plan</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, billingCycle === 'monthly' && styles.tabBtnActive]}
            onPress={() => setBillingCycle('monthly')}
          >
            <Text style={[styles.tabText, billingCycle === 'monthly' && styles.tabTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, billingCycle === 'yearly' && styles.tabBtnActive]}
            onPress={() => setBillingCycle('yearly')}
          >
            <Text style={[styles.tabText, billingCycle === 'yearly' && styles.tabTextActive]}>Yearly</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.plansScroll}
          decelerationRate="fast"
          snapToInterval={width * 0.85 + 16}
        >
          {MOCK_PLANS[billingCycle].map(renderPlanCard)}
        </ScrollView>

        {/* Invoice History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Invoice History</Text>
        </View>

        <View style={styles.invoiceList}>
          {MOCK_INVOICES.map((inv, i) => (
            <View key={inv.id} style={[styles.invoiceItem, i === MOCK_INVOICES.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.invoiceLeft}>
                <View style={styles.invoiceIcon}>
                  <CreditCard color={COLORS.textMuted} size={20} />
                </View>
                <View>
                  <Text style={styles.invoicePlan}>{inv.plan} • NGN {inv.amount}</Text>
                  <Text style={styles.invoiceMeta}>{inv.date} • {inv.ref}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.receiptBtn}>
                <FileText color={COLORS.brandBlue} size={14} />
                <Text style={styles.receiptBtnText}>Receipt</Text>
              </TouchableOpacity>
            </View>
          ))}
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

  activePlanCard: {
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(32, 116, 80, 0.2)',
    overflow: 'hidden',
  },
  activePlanContent: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activePlanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.brandGreen,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  activePlanTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  activeBadge: {
    backgroundColor: 'rgba(32, 116, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brandGreen,
  },
  activePlanEmail: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },

  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  plansScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  planCard: {
    width: width * 0.85,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: 24,
    position: 'relative',
  },
  planCardPopular: {
    borderColor: 'rgba(32, 116, 80, 0.3)',
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.brandGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 16,
    borderTopRightRadius: 19,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  planIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  planTarget: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  planDuration: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  featuresList: {
    gap: 12,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  planBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
  },
  planBtnCurrent: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  planBtnPopular: {
    backgroundColor: COLORS.brandGreen,
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  planBtnNormal: {
    backgroundColor: COLORS.brandBlue,
  },
  planBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  planBtnTextCurrent: { color: COLORS.textMuted },
  planBtnTextPopular: { color: '#fff' },
  planBtnTextNormal: { color: '#fff' },

  invoiceList: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  invoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  invoiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoicePlan: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  invoiceMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(1, 46, 137, 0.05)',
  },
  receiptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brandBlue,
  },
});
