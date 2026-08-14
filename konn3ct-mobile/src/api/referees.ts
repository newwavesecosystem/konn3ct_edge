import { apiClient } from './client';

export interface RefereeItem {
  id?: string | number;
  firstname?: string;
  lastname?: string;
  email?: string;
  plan?: string;
  created_at?: string;
  [key: string]: any;
}

/**
 * GET /referee
 * Fetch paginated list of referees
 */
export async function fetchReferees(): Promise<RefereeItem[]> {
  const res = await apiClient.get('/referee');
  // API returns paginated data: res.data.data.data
  const rawData = res.data?.data?.data || [];
  return Array.isArray(rawData) ? rawData : [];
}
