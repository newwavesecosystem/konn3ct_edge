import { api } from ".";

export const getUser = async () => {
  try {
    const res = await api.get("/profile");
    return res.data.data;
  } catch (error) {
    throw error;
  }
};

export const updateProfile = async (data) => {
  try {
    const res = await api.post("/update-profile", data);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const updatePassword = async (data) => {
  try {
    const res = await api.put("/update-password", data);
    console.log(res);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const getSessions = async () => {
  try {
    const res = await api.get("/user-sessions");
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const logoutSession = async () => {
  try {
    const res = await api.delete("/user-sessions-delete-others");
    return res.data;
  } catch (error) {
    throw error;
  }
};
