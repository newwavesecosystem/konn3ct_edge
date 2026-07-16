import { apiClient } from './client';

export interface RecordingPlaybackFormat {
  type?: string;
  url?: string;
  processingTime?: string;
  length?: string;
  size?: string;
  preview?: {
    images?: {
      image?: string[];
    };
  };
}

export interface RecordingItem {
  recordID: string;
  meetingID?: string;
  internalMeetingID?: string;
  name?: string;
  isBreakout?: string;
  published?: string;
  state?: string;
  startTime?: string;
  endTime?: string;
  participants?: string | number;
  rawSize?: string;
  size?: string;
  playback?: {
    format?: RecordingPlaybackFormat;
  };
  metadata?: any;
  [key: string]: any;
}

export interface DownloadLinks {
  video?: { name: string; url: string };
  screenshare?: { name: string; url: string };
  chats?: { name: string; url: string };
}

export interface RecordingsResponse {
  recordings: RecordingItem[];
  downloadLinks?: DownloadLinks;
}

/**
 * GET /recording
 * Fetch list of all recordings and global download link templates
 */
export async function fetchRecordings(): Promise<RecordingsResponse> {
  const res = await apiClient.get('/recording');
  const data = res.data;
  
  let recordings: RecordingItem[] = [];
  if (Array.isArray(data.data)) {
    recordings = data.data;
  } else if (data.data?.data && Array.isArray(data.data.data)) {
    recordings = data.data.data;
  } else if (Array.isArray(data)) {
    recordings = data;
  }

  return {
    recordings,
    downloadLinks: data.download_links
  };
}

/**
 * DELETE /deleterecording/{id}
 * Delete a specific recording by ID
 */
export async function deleteRecording(recordID: string): Promise<any> {
  const res = await apiClient.delete(`/deleterecording/${recordID}`);
  return res.data;
}
