import { apiClient } from './client';

export interface StreamingItem {
  id: number | string;
  room_id?: string | number;
  type?: string;
  status?: string | number;
  is_running?: boolean;
  created_at?: string;
  updated_at?: string;
  room_name?: string;
  [key: string]: any;
}

export interface StartStreamingPayload {
  room_id: string;
  type: 'Youtube' | 'Facebook';
  key: string;
}

export interface StartComboStreamingPayload {
  room_id: string;
  youtube_key: string;
  facebook_key: string;
}

/**
 * GET /streamings
 * Fetch list of all active or past streamings
 */
export async function fetchStreamings(): Promise<StreamingItem[]> {
  const res = await apiClient.get('/streamings');
  const data = res.data;
  
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.streamings && Array.isArray(data.streamings)) return data.streamings;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;

  if (data && typeof data === 'object') {
    const arrayValues = Object.values(data).find((v: any) => Array.isArray(v));
    if (arrayValues) return arrayValues as StreamingItem[];
  }
  return [];
}

/**
 * POST /start-streaming
 * Start a single stream (Youtube or Facebook)
 */
export async function startStreaming(payload: StartStreamingPayload): Promise<any> {
  const res = await apiClient.post('/start-streaming', payload);
  return res.data;
}

/**
 * POST /start-streaming-combo
 * Start a combined stream for both Youtube and Facebook
 */
export async function startComboStreaming(payload: StartComboStreamingPayload): Promise<any> {
  const res = await apiClient.post('/start-streaming-combo', payload);
  return res.data;
}

/**
 * GET /stop-streaming/{id}
 * Stop an active stream by its ID
 */
export async function stopStreaming(id: string | number): Promise<any> {
  const res = await apiClient.get(`/stop-streaming/${id}`);
  return res.data;
}
