import { apiClient } from './client';

export interface DonationStats {
  donation_sum: number | string;
  donation_count: number;
  settlement_sum: number | string;
  settlement_count: number;
  pending_sum: number | string;
  pending_count: number;
  [key: string]: any;
}

export interface DonationItem {
  id: number | string;
  ref?: string;
  reference?: string;
  date?: string;
  created_at?: string;
  donor_name?: string;
  donor?: string;
  desc?: string;
  description?: string;
  provider?: string;
  payment_provider?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  [key: string]: any;
}

/**
 * GET /donation/stats
 * Fetch stats for incoming donations.
 */
export async function fetchDonationStats(): Promise<DonationStats | null> {
  const res = await apiClient.get('/donation/stats');
  if (res.data?.data) {
    return res.data.data;
  }
  if (res.data) {
    return res.data;
  }
  return null;
}

/**
 * GET /donation/in
 * Fetch list of incoming donations.
 */
export async function fetchDonationsIn(): Promise<DonationItem[]> {
  const res = await apiClient.get('/donation/in');
  const data = res.data;
  
  // Laravel paginator returns { data: { data: [...] } }
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.donations && Array.isArray(data.donations)) return data.donations;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;

  if (data && typeof data === 'object') {
    const arrayValues = Object.values(data).find((v: any) => Array.isArray(v));
    if (arrayValues) return arrayValues as DonationItem[];
  }
  return [];
}
