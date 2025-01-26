import { api } from ".";

export const getStreams = async (page) => {
  try {
    const res = await api.get(`/streamings?page=${page}`);
    return res.data.data;
  } catch (error) {
    throw error;
  }
};

export const stopStreaming = async (id) => {
  try {
    const res = await api.get(`/stop-streaming/${id}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const startStream = async (data) => {
  try {
    const res = await api.post("/start-streaming", data);
    return res.data;
  } catch (error) {
    throw error;
  }
};
