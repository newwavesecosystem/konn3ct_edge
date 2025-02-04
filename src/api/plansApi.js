import { api } from ".";

export const getPlans = async () => {
  try {
    const res = await api.get("/pricing-plans");
    return res.data;
  } catch (error) {
    throw error;
  }
};
