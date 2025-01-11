import axios from "axios";

const BASE_URL = "https://dev.konn3ct.ng/api/app";

export const api = axios.create({
  baseURL: BASE_URL,
});

// Add a request interceptor to dynamically set the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
