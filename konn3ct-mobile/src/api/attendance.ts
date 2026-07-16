import { apiClient } from './client';

export interface MeetingAttendanceSession {
  id: number | string;
  room_id: string | number;
  meeting_id: string;
  host_name?: string;
  date?: string;
  time?: string;
  [key: string]: any;
}

export interface MeetingParticipant {
  id: number | string;
  name: string;
  email: string;
  join_time?: string;
  leave_time?: string;
  duration?: string;
  [key: string]: any;
}

/**
 * GET /meeting-attendance
 * Fetch list of past meetings for the authenticated user.
 */
export async function fetchMeetingAttendanceList(): Promise<MeetingAttendanceSession[]> {
  const res = await apiClient.get('/meeting-attendance');
  const data = res.data;
  
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.attendance && Array.isArray(data.attendance)) return data.attendance;
  if (data?.data?.attendance && Array.isArray(data.data.attendance)) return data.data.attendance;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;

  if (data && typeof data === 'object') {
    const arrayValues = Object.values(data).find((v: any) => Array.isArray(v));
    if (arrayValues) return arrayValues as MeetingAttendanceSession[];
  }
  return [];
}

/**
 * GET /attendance-details/:roomId/:meetingId
 * Fetch specific participant details for a past meeting.
 */
export async function fetchAttendanceDetails(roomId: string, meetingId: string): Promise<MeetingParticipant[]> {
  const res = await apiClient.get(`/attendance-details/${roomId}/${meetingId}`);
  const data = res.data;

  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.details && Array.isArray(data.details)) return data.details;
  if (data?.participants && Array.isArray(data.participants)) return data.participants;
  if (data?.data?.details && Array.isArray(data.data.details)) return data.data.details;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;

  if (data && typeof data === 'object') {
    const arrayValues = Object.values(data).find((v: any) => Array.isArray(v));
    if (arrayValues) return arrayValues as MeetingParticipant[];
  }
  return [];
}
