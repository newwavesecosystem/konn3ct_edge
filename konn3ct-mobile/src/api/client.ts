import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Connected to Kubernetes Backend Ingress Domain
export const IS_DEV = true; // Change to false for production
const API_URL = process.env.EXPO_PUBLIC_API_URL || (
  IS_DEV 
    ? 'https://dev.konn3ct.ng/api/app' 
    : 'https://konn3ctedge.konn3ct.net/api'
);
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject JWT token into requests
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Streaming API
export const streamingApi = {
  startStream: async (data: { roomId: string; rtmpUrls: string[] }) => {
    const res = await apiClient.post<{ message: string; streamId: string }>('/streaming/start', data);
    return res.data;
  },
  stopStream: async (streamId: string) => {
    const res = await apiClient.post<{ message: string }>(`/streaming/${streamId}/stop`);
    return res.data;
  },
  getStreams: async (roomSlug: string) => {
    const res = await apiClient.get<Array<{ id: string; status: string; rtmpUrls: string[] }>>(`/streaming/${roomSlug}`);
    return res.data;
  },
};
