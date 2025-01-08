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
    console.log(data)
    const res = await api.post("/createroom", data);

    console.log(res);
  } catch (error) {
    throw error;
  }
};
