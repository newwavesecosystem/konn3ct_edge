import { apiClient } from './client';

export interface SchedulePayload {
  room_id: string | number;
  title: string;
  hostname?: string;
  description: string;
  recurrence: string; // once, daily, weekly, monthly
  date: string;       // YYYY-MM-DD
  fromtime: string;   // HH:mm
  totime: string;     // HH:mm
  timezone: string;
  guest: string;      // comma separated emails
}

export async function fetchSchedules() {
  const res = await apiClient.get('/schedule');
  // Handle paginated structure correctly (res.data.data.data) or fallback
  return res.data?.data?.data || res.data?.data || [];
}

export async function createSchedule(data: SchedulePayload) {
  try {
    const res = await apiClient.post('/schedule', data);
    if (res.data && (res.data.status === false || res.data.success === false)) {
      throw new Error(res.data.message || 'Failed to create schedule');
    }
    return res.data;
  } catch (error: any) {
    // Log full details so we can diagnose server-side failures precisely
    console.error('[createSchedule] HTTP Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: JSON.stringify(error.response?.data),
      message: error.message,
    });
    throw error;
  }
}

export async function updateSchedule(id: string | number, data: Partial<SchedulePayload>) {
  const res = await apiClient.put(`/schedule-edit/${id}`, data);
  if (res.data && (res.data.status === false || res.data.success === false)) {
    throw new Error(res.data.message || 'Failed to update schedule');
  }
  return res.data;
}

export async function cancelSchedule(id: string | number) {
  const res = await apiClient.delete(`/schedule-cancel/${id}`);
  if (res.data && (res.data.status === false || res.data.success === false)) {
    throw new Error(res.data.message || 'Failed to cancel schedule');
  }
  return res.data;
}
