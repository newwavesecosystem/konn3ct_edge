// attendanceApi.js
import { api } from ".";
const API = api;

// Fetch all meeting attendance records
export const getMeetings = async () => {
  try {
    const response = await API.get("/meeting-attendance");
    const result = response.data;

    const records =
      result?.data?.data && Array.isArray(result.data.data)
        ? result.data.data
        : [];

    return records.map((item) => ({
      id: item.id,
      meeting_id: item.meeting_id,  // IMPORTANT
      host: item.room_info?.name || "Unknown Room",
      name: item.name,
      date: new Date(item.created_at).toLocaleDateString(),
      time: new Date(item.created_at).toLocaleTimeString(),
      identifier: item.identifier,
      status: item.status,
    }));
  } catch (error) {
    console.error("Error fetching meetings:", error);
    throw error;
  }
};

// Fetch attendance details by meeting_id + identifier
export const getAttendanceDetails = async (meeting_id, identifier) => {
  if (!meeting_id || !identifier)
    throw new Error("Missing meeting_id or identifier");

  try {
    const response = await API.get(
      `/attendance-details/${meeting_id}/${identifier}`
    );

    console.log("RAW ATTENDANCE DETAILS:", response.data);

    const payload = response.data?.data?.data;

    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === "object") return [payload];

    return [];
  } catch (error) {
    console.error("Error fetching attendance details:", error);
    throw error;
  }
};
