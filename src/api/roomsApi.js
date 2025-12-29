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

export const manageAccessCode = async (data) => {
  try {
    const payload = { ...data, id: String(data.id) }; // ✅ ensure id is string
    const res = await api.post("/accesscode", payload);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const limitUser = async (data) => {
  try {
    const payload = { ...data, id: String(data.id) };
    const res = await api.post("/limituser", payload);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const bannerUpload = async (data) => {
  try {
    const formData = new FormData();
    formData.append("id", String(data.id));
    formData.append("banner", data.banner);

    const res = await api.post("/bannerupload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const transferRoom = async (data) => {
  try {
    const payload = { ...data, id: String(data.id) };
    const res = await api.post("/transfer-room", payload);
    return res.data;
  } catch (error) {
    throw error;
  }
};
