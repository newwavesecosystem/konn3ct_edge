import { api } from ".";

const API = api;
const AI_BASE_URL = process.env.REACT_APP_API_BOT;


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
      meeting_id: item.meeting_id,
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

const buildAttendancePage = (payload) => {
  if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return {
      data: payload,
      current_page: 1,
      last_page: 1,
      next_page_url: null,
      prev_page_url: null,
      from: payload.length > 0 ? 1 : null,
      per_page: payload.length,
      total: payload.length,
    };
  }

  if (payload && typeof payload === "object") {
    return {
      data: [payload],
      current_page: 1,
      last_page: 1,
      next_page_url: null,
      prev_page_url: null,
      from: 1,
      per_page: 1,
      total: 1,
    };
  }

  return {
    data: [],
    current_page: 1,
    last_page: 1,
    next_page_url: null,
    prev_page_url: null,
    from: null,
    per_page: 0,
    total: 0,
  };
};

export const getAttendanceDetails = async (meeting_id, identifier, page = 1) => {
  if (!meeting_id || !identifier)
    throw new Error("Missing meeting_id or identifier");

  try {
    const response = await API.get(`/attendance-details/${meeting_id}/${identifier}`, {
      params: { page },
    });

    return buildAttendancePage(response.data?.data);
  } catch (error) {
    console.error("Error fetching attendance details:", error);
    throw error;
  }
};


// Meeting Summary
export const getMeetingSummary = async (meetingID) => {
  const res = await fetch(`${AI_BASE_URL}/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingID }),
  });

  const data = await res.json();
  return data.message;
};

// Meeting Highlights
export const getMeetingHighlights = async (meetingID) => {
  const res = await fetch(`${AI_BASE_URL}/highlights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingID }),
  });

  const data = await res.json();
  return data.message;
};
// Meeting minutes
export const getMeetingMinutes = async (meetingID) => {
  const res = await fetch(`${AI_BASE_URL}/minutes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingID }),
  });

  const data = await res.json();
  return data.message;
};

