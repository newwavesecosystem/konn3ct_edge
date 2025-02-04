import { api } from ".";

export const getAddons = async (page) => {
  try {
    const res = await api.get(`/addons`);
    return res.data;
  } catch (error) {
    throw error;
  }
};
