import { api } from ".";
const API = api;

export const getPreRegList = async () => {
  try {
    const res = await API.get("/pre-reg-list");
    return res.data;
  } catch (error) {
    console.error("Error fetching pre-registration list:", error);
    throw error;
  }
};

// Fetch pre-registration summary
export const getPreRegSummary = async () => {
  try {
    const res = await api.get("/pre-reg-summary");
    // normalize
    return res.data?.data || { events: 0, participants: 0 };
  } catch (error) {
    console.error("Error fetching pre-registration summary:", error);
    throw error;
  }
};

// ✅ Fetch participants by event reference, not ID
export const getPreRegParticipants = async (reference) => {
  try {
    const res = await api.get(`/pre-reg-participants/${reference}`);
    // some APIs return { data: [...] }, others return the array directly
    return res.data?.data || res.data || [];
  } catch (error) {
    console.error("Failed to fetch participants:", error);
    throw error;
  }
};


export const createPreRegEvent = async (formData) => {
  try {
    const res = await API.post("/pre-reg", formData, {
      headers: {
        "Content-Type":
          formData instanceof FormData
            ? "multipart/form-data"
            : "application/json",
      },
    });
    return res.data;
  } catch (error) {
    console.error("Error creating pre-registration event:", error);
    throw error;
  }
};

export const getRooms = async () => {
  try {
    const res = await api.get("/myrooms");
    return res.data.data;
  } catch (error) {
    throw error;
  }
};

export default {
  getPreRegList,
  getPreRegSummary,
  getPreRegParticipants,
  createPreRegEvent,
  getRooms,
};
