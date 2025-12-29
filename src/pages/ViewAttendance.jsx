import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getAttendanceDetails,
  getMeetingSummary,
  getMeetingHighlights,
  getMeetingMinutes,
} from "../api/attendanceApi";
import { ArrowLeft } from "lucide-react";

const NAVBAR_HEIGHT = 72;

const ViewAttendance = () => {
  const { meeting_id, identifier } = useParams();
  const navigate = useNavigate();

  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Side panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState("");
  const [panelContent, setPanelContent] = useState("");
  const [panelLoading, setPanelLoading] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await getAttendanceDetails(meeting_id, identifier);

        if (Array.isArray(data)) setAttendanceData(data);
        else if (typeof data === "object") setAttendanceData([data]);
        else setAttendanceData([]);
      } catch (err) {
        console.error(err);
        setError("Unable to load participant details.");
      } finally {
        setLoading(false);
      }
    };

    if (!meeting_id || !identifier) {
      setError("Missing meeting_id or identifier.");
      setLoading(false);
      return;
    }

    fetchDetails();
  }, [meeting_id, identifier]);

  const openPanel = async (type) => {
    setPanelOpen(true);
    setPanelLoading(true);
    setPanelContent("");

    try {
      let result = "";
      if (type === "minutes") {
        setPanelTitle("Minutes of Meeting");
        result = await getMeetingMinutes(meeting_id);
      }
      if (type === "highlights") {
        setPanelTitle("Meeting Highlights");
        result = await getMeetingHighlights(meeting_id);
      }
      if (type === "summary") {
        setPanelTitle("Meeting Summary");
        result = await getMeetingSummary(meeting_id);
      }

      setPanelContent(result || "No data returned.");
    } catch (err) {
      console.error(err);
      setPanelContent("Failed to load content.");
    } finally {
      setPanelLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600 text-sm">Loading participant data...</p>
      </div>
    );

  if (error)
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );

  return (
    <>
      {/* MAIN CONTENT */}
      <div className="min-h-screen flex items-center justify-center px-4 py-20 m-auto">
        <div className="w-full max-w-6xl bg-white rounded-2xl shadow-sm border p-8">

          {/* TOP ACTIONS */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="flex gap-3 mb-3">
                <button className="px-4 py-1.5 border rounded-md text-sm">COPY</button>
                <button className="px-4 py-1.5 border rounded-md text-sm">CSV</button>
                <button className="px-4 py-1.5 border rounded-md text-sm">EXCEL</button>
                <button className="px-4 py-1.5 border rounded-md text-sm">PRINT</button>
              </div>

              <div className="flex gap-3">
                {/* <button
                  onClick={() => openPanel("minutes")}
                  className="px-4 py-2 text-xs bg-blue-100 text-blue-700 rounded-md"
                >
                  Send Minutes of Meeting
                </button> */}
                <button
                  onClick={() => openPanel("highlights")}
                  className="px-4 py-2 text-xs bg-yellow-100 text-yellow-700 rounded-md"
                >
                  Send Meeting Highlight
                </button>
                <button
                  onClick={() => openPanel("summary")}
                  className="px-4 py-2 text-xs bg-purple-100 text-purple-700 rounded-md"
                >
                  Send Meeting Summary
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Search"
              className="border px-4 py-2 rounded-full w-64 text-sm"
            />
          </div>

          {/* TITLE */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold">Meeting Attendance</h2>
            <button
              onClick={() => navigate("/attendance")}
              className="flex items-center gap-2 border px-3 py-1.5 rounded-full text-sm"
            >
              <ArrowLeft size={16} />
              Back to Attendance
            </button>
          </div>

          {/* TABLE HEADER */}
          <div className="grid grid-cols-[60px_1.5fr_2fr_1fr_1.5fr] text-sm text-gray-500 font-medium mb-2">
            <span>S/N</span>
            <span>NAME</span>
            <span>EMAIL</span>
            <span>STATUS</span>
            <span>DATE & TIME</span>
          </div>

          {/* TABLE ROWS */}
          <div className="space-y-3">
            {attendanceData.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-10">
                No participants found for this meeting.
              </div>
            ) : (
              attendanceData.map((row, index) => (
                <div
                  key={row.id || index}
                  className="grid grid-cols-[60px_1.5fr_2fr_1fr_1.5fr] items-center bg-gray-50 hover:bg-gray-100 transition rounded-xl px-4 py-3 text-sm text-gray-700"
                >
                  <span>{index + 1}</span>
                  <span>{row.name || row.attendee_name || "N/A"}</span>

                  <span className="truncate" title={row.email || row.attendee_email}>
                    {row.email || row.attendee_email || "N/A"}
                  </span>

                  <span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        row.status === "Joined" || row.status === "Present"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.status || "Unknown"}
                    </span>
                  </span>

                  <span>
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString()
                      : row.date
                      ? row.date + (row.time ? ` | ${row.time}` : "")
                      : "N/A"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* OVERLAY */}
      {panelOpen && (
        <div
          onClick={() => setPanelOpen(false)}
          className="fixed inset-0 bg-black/20 z-40"
        />
      )}

      {/* SIDE PANEL */}
      <div
        className={`fixed right-0 bg-white border-l shadow-xl z-50 transition-transform duration-300
        w-full sm:w-[360px]
        ${panelOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{
          top: NAVBAR_HEIGHT,
          height: `calc(100vh - ${NAVBAR_HEIGHT}px)`,
        }}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">{panelTitle}</h3>
          <button
            onClick={() => setPanelOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-4 overflow-y-auto h-[calc(100%-56px)]">
          {panelLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {panelContent}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ViewAttendance;
