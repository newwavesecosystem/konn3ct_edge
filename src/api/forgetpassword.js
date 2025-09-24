import { api } from ".";

const API = api;
// Request for password reset (sends code to email/phone)
export const requestForgotPassword = async (emailphone, type = "email") => {
  try {
    const response = await API.post("/forgot-password-request", {
      emailphone,
      type,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Reset password using code
export const resetForgotPassword = async (emailphone, type = "email", code, password) => {
  try {
    const response = await API.post("/forgot-password", {
      emailphone,
      type,
      code,
      password,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};