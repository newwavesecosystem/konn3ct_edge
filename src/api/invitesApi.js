import { api } from ".";

export const getInvites = async (page) => {
  try {
    const res = await api.get(`/invites?page=${page}`);
    return res.data.data;
  } catch (error) {
    throw error;
  }
};

export const resendInvite = async (id) => {
  try {
    const res = await api.put(`/resendinvites/${id}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};
