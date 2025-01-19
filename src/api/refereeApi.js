import { api } from ".";

export const getReferee = async (page) => {
  try {
    const res = await api.get(`/referee?page=${page}`);
    return res.data.data;
  } catch (error) {
    throw error;
  }
};
