import { api } from ".";

export const getRecordings = async () => {
  try {
    const res = await api.get("/recording");
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const deleteRecording = async (recordID) => {
  try {
    const res = await api.delete(`/deleterecording/${recordID}`);
    console.log(res.data);
    return res.data;
  } catch (error) {
    throw error;
  }
};
