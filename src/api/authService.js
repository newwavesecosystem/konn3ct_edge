import axios from "axios";
const BASE_URL = process.env.REACT_APP_BASE_URL;
// Login Request
export const login = async (credentials) => {
  try {
    const response = await axios.post(`${BASE_URL}/login`, credentials);
    return response.data;
  } catch (error) {
    throw error.response?.data || "Login failed. Please try again.";
  }
};

export const loginSocial = async (credentials) => {
  try {
    const response = await axios.post(`${BASE_URL}/login-social`, credentials);
    return response.data;
  } catch (error) {
    throw error.response?.data || "Login failed. Please try again.";
  }
};

// Register Request
export const register = async (userData) => {
  try {
    const response = await axios.post(`${BASE_URL}/register`, userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || "Registration failed. Please try again.";
  }
};
