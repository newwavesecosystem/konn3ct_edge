// src/api/attendanceApi.js
import { api } from ".";
const API = api;

// 🧩 Fetch all meeting attendance records
export const getMeetings = async () => {
  try {
    const response = await API.get("/meeting-attendance");
    const result = response.data;

    // Extract main data array
    const records =
      result?.data?.data && Array.isArray(result.data.data)
        ? result.data.data
        : [];

    // Map it into frontend-friendly format
    const formatted = records.map((item) => ({
      id: item.id,
      meetingId: item.meeting_id,
      host: item.room_info?.name || "Unknown Room",
      attendeeName: item.name,
      date: new Date(item.created_at).toLocaleDateString(),
      time: new Date(item.created_at).toLocaleTimeString(),
      identifier: item.identifier,
      status: item.status,
    }));

    return formatted;
  } catch (error) {
    console.error("Error fetching meetings:", error);
    throw error;
  }
};

// 🧩 Fetch detailed attendance for a specific meeting
export const getAttendanceDetails = async (meetingId, attendanceId) => {
  try {
    const response = await API.get(
      `/attendance-details/${meetingId}/${attendanceId}`
    );
    const result = response.data;

    // Extract list safely from nested structure
    const records =
      result?.data?.data && Array.isArray(result.data.data)
        ? result.data.data
        : [];

    return records;
  } catch (error) {
    console.error("Error fetching attendance details:", error);
    throw error;
  }
};

