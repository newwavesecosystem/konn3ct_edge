import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  DollarSign,
  CreditCard,
  Clock,
  Download,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { fetchDonationStats, fetchDonationsIn, DonationStats, DonationItem } from '../api/donations';

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
  warning: '#f59e0b',
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function DonationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [stats, setStats] = React.useState<DonationStats | null>(null);
  const [donations, setDonations] = React.useState<DonationItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, listData] = await Promise.all([
        fetchDonationStats(),
        fetchDonationsIn()
      ]);
      setStats(statsData);
      setDonations(listData);
    } catch (error) {
      console.error('Failed to fetch donation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const renderStatusBadge = (status: string) => {
    switch(status) {
      case 'successful':
        return (
          <View style={[styles.badge, { backgroundColor: 'rgba(32, 116, 80, 0.1)' }]}>
            <CheckCircle2 size={12} color={COLORS.brandGreen} />
            <Text style={[styles.badgeText, { color: COLORS.brandGreen }]}>Successful</Text>
          </View>
        );
      case 'pending':
        return (
          <View style={[styles.badge, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
            <Clock size={12} color={COLORS.warning} />
            <Text style={[styles.badgeText, { color: COLORS.warning }]}>Pending</Text>
          </View>
        );
      case 'failed':
        return (
          <View style={[styles.badge, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
            <AlertCircle size={12} color={COLORS.danger} />
            <Text style={[styles.badgeText, { color: COLORS.danger }]}>Failed</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Math.max(insets.top, 24) }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.modalTitle}>Donations</Text>
          <Text style={styles.modalSubtitle}>Track and manage your incoming donations and settlements.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        {/* Stats Grid */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.statsScroll}
          decelerationRate="fast"
          snapToInterval={width * 0.75 + 16}
        >
          {/* Total */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(32, 116, 80, 0.1)' }]}>
                <DollarSign color={COLORS.brandGreen} size={20} />
              </View>
              <Text style={styles.statLabel}>Total Donations</Text>
            </View>
            <Text style={styles.statAmount}>NGN {stats?.donation_sum || '0'}</Text>
            <Text style={[styles.statCount, { color: COLORS.brandGreen }]}>{stats?.donation_count || 0} Donations Received</Text>
          </View>

          {/* Settlements */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(1, 46, 137, 0.1)' }]}>
                <CreditCard color={COLORS.brandBlue} size={20} />
              </View>
              <Text style={styles.statLabel}>Settlements</Text>
            </View>
            <Text style={styles.statAmount}>NGN {stats?.settlement_sum || '0'}</Text>
            <Text style={[styles.statCount, { color: COLORS.brandBlue }]}>{stats?.settlement_count || 0} Completed</Text>
          </View>

          {/* Pending */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Clock color={COLORS.warning} size={20} />
              </View>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <Text style={styles.statAmount}>NGN {stats?.pending_sum || '0'}</Text>
            <Text style={[styles.statCount, { color: COLORS.warning }]}>{stats?.pending_count || 0} Transactions</Text>
          </View>
        </ScrollView>

        {/* History Header */}
        <View style={styles.historyHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Donation History</Text>
            <Text style={styles.sectionSubtitle}>A detailed log of all your recent activity.</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn}>
            <Download size={16} color={COLORS.textPrimary} />
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* History List */}
        <View style={styles.historyList}>
          {donations.length === 0 && !isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted }}>No incoming donations found.</Text>
            </View>
          ) : (
            donations.map((don, i) => {
              const donor = don.donor || don.donor_name || 'Anonymous';
              const amount = don.amount || '0';
              const desc = don.desc || don.description || don.topic || 'Donation';
              const provider = don.provider || don.payment_provider || 'N/A';
              const status = (don.status || 'successful').toLowerCase();
              const date = don.date ? formatDate(don.date) : don.created_at ? formatDate(don.created_at) : 'No date';
              const ref = don.ref || don.reference || don.id || 'N/A';

              return (
                <View key={don.id || i} style={[styles.historyItem, i === donations.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.historyRowTop}>
                    <Text style={styles.donorName}>{donor}</Text>
                    <Text style={styles.donationAmount}>NGN {amount}</Text>
                  </View>
                  
                  <View style={styles.historyRowMid}>
                    <Text style={styles.donationDesc} numberOfLines={1}>{desc}</Text>
                    {renderStatusBadge(status)}
                  </View>
                  
                  <View style={styles.historyRowBottom}>
                    <Text style={styles.donationMeta}>{date} • {provider}</Text>
                    <Text style={styles.donationRef}>{ref}</Text>
                  </View>
                </View>
              );
            })
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

  statsScroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  statCard: {
    width: width * 0.75,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  statAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  statCount: {
    fontSize: 13,
    fontWeight: '600',
  },

  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: COLORS.surface,
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  historyList: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  historyItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  historyRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  donorName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    paddingRight: 12,
  },
  donationAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  historyRowMid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  donationDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    flex: 1,
    paddingRight: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  historyRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  donationMeta: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  donationRef: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
