import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Connected to Kubernetes Backend Ingress Domain
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://konn3ctedge.konn3ct.net/api';

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
