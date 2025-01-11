import { api } from ".";

export const getUser = async () => {
  try {
    const res = await api.get("/profile");

    return res.data.data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
