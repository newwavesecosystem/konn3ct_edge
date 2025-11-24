import { api } from ".";

export const getPlans = async () => {
  try {
    const res = await api.get("/pricing-plans");
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const getList = async () => {
  try {
    const res = await api.get("/payments");
    return res.data.data;
  } catch (error) {
    throw error;
  }
};
