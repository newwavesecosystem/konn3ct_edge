import { apiClient } from './client';

export interface Addon {
  id: number;
  name: string;
  description: string;
  freetrial: number;
  price: number;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface AddonsResponse {
  success: boolean;
  message: string;
  data: Addon[];
  current_status: Record<string, string>;
}

export const paymentsApi = {
  getAddons: async () => {
    const res = await apiClient.get<AddonsResponse>('/addons');
    return res.data;
  },
};

export interface PricingPlan {
  id: number;
  name: string;
  monthly_cost: string;
  yearly_cost: string;
  recording: number;
  duration: number;
  participant: number;
  rooms: number;
  customize_link: number;
  breakout_rooms: number;
  access_code: number;
  dialin: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentItem {
  id: string | number;
  [key: string]: any;
}

export async function fetchPayments(): Promise<PaymentItem[]> {
  const res = await apiClient.get('/payments');
  const data = res.data?.data?.payments?.data || [];
  return data;
}

export async function fetchPricingPlans(): Promise<PricingPlan[]> {
  const res = await apiClient.get('/pricing-plans');
  const data = res.data?.data?.plan || [];
  return data;
}
