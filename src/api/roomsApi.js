import { api } from ".";

export const getRooms = async () => {
  try {
    const res = await api.get("/myrooms");
    return res.data.data;
  } catch (error) {
    throw error;
  }
};

export const createMeeting = async (data) => {
  try {
    const res = await api.post("/createroom", data);

    return res.data;
  } catch (error) {
    throw error;
  }
};

export const getMeetings = async () => {
  try {
    const res = await api.get("/upcoming-meetings");
    return res.data.data;
  } catch (error) {
    throw error;
  }
};

export const startMeeting = async (id) => {
  try {
    const res = await api.get(`start-a-room/${id}`);

    return res;
  } catch (error) {
    throw error;
  }
};

export const deleteRoom = async (id) => {
  try {
    const res = await api.delete(`deleteroom/${id}`);
    return res;
  } catch (error) {
    throw error;
  }
};
