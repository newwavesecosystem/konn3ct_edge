import { apiClient } from './client';

export interface DashboardStats {
  rooms: number;
  upcoming_meetings: number;
  streaming: number;
  recordings: number;
  [key: string]: any;
}

export interface TodayMeeting {
  id: number | string;
  topic?: string;
  title?: string;
  name?: string;
  room_id?: string;
  roomId?: string;
  start_time?: string;
  startTime?: string;
  duration?: string | number;
  host_name?: string;
  host?: string;
  [key: string]: any;
}

/**
 * GET /dashboard/stats
 * [DEV ENDPOINT] Fetch high-level statistics for the user dashboard.
 * Note: Found in the new Postman dev collection.
 */
export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  const res = await apiClient.get('/dashboard/stats');
  if (res.data?.data) {
    return res.data.data;
  }
  if (res.data) {
    return res.data;
  }
  return null;
}

/**
 * GET /dashboard/today-meeting
 * [DEV ENDPOINT] Fetch the list of meetings scheduled for today.
 * Note: Found in the new Postman dev collection.
 */
export async function fetchTodayMeetings(): Promise<TodayMeeting[]> {
  const res = await apiClient.get('/dashboard/today-meeting');
  const data = res.data;
  
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.meetings && Array.isArray(data.meetings)) return data.meetings;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;

  if (data && typeof data === 'object') {
    const arrayValues = Object.values(data).find((v: any) => Array.isArray(v));
    if (arrayValues) return arrayValues as TodayMeeting[];
  }
  return [];
}
