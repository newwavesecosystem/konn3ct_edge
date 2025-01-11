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

export const joinRoom = async (data) => {
  const { roomName, ...body } = data;
  try {
    if (Number.isFinite(Number(roomName))) {
      const res = await api.post("/join-room", { id: roomName, ...body });
      return res.data;
    } else {
      const res = await api.post("/kv4/join-room", { room: roomName, ...body });
      return res.data;
    }
  } catch (error) {
    throw error;
  }
};
