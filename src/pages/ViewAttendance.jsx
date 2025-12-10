import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAttendanceDetails } from "../api/attendanceApi";
import { ArrowLeft } from "lucide-react";

const ViewAttendance = () => {
  const { meeting_id, identifier } = useParams(); 
  const navigate = useNavigate();

  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await getAttendanceDetails(meeting_id, identifier);

        if (Array.isArray(data)) setAttendanceData(data);
        else if (typeof data === "object") setAttendanceData([data]);
        else setAttendanceData([]);

      } catch (err) {
        console.error("Failed to load attendance details:", err);
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
    <div className="min-h-screen flex items-center justify-center px-4 py-20 m-auto">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-sm border p-8">

        {/* TOP BUTTONS SECTION */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex gap-3 mb-3">
              <button className="px-4 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50">COPY</button>
              <button className="px-4 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50">CSV</button>
              <button className="px-4 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50">EXCEL</button>
              <button className="px-4 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50">PRINT</button>
            </div>

            {/* NEW BUTTONS ADDED HERE */}
            <div className="flex gap-3">
              <button className="px-4 py-2 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">
                Send Minutes of Meeting
              </button>
              <button className="px-4 py-2 text-xs bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200">
                Send Meeting Highlight
              </button>
              <button className="px-4 py-2 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200">
                Send Meeting Summary
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search"
            className="border border-gray-200 px-4 py-2 rounded-full w-64 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* PAGE TITLE + BACK BUTTON */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Meeting Attendance</h2>
          <button
            onClick={() => navigate("/attendance")}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
          >
            <ArrowLeft size={16} />
            Back to Attendance
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-5 text-sm text-gray-500 font-medium">
            <span>S/N</span>
            <span>NAME</span>
            <span>EMAIL</span>
            <span>STATUS</span>
            <span>DATE & TIME</span>
          </div>

          {attendanceData.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-10">
              No participants found for this meeting.
            </div>
          ) : (
            attendanceData.map((row, index) => (
              <div
                key={row.id || index}
                className="grid grid-cols-5 items-center bg-gray-50 hover:bg-gray-100 transition rounded-xl px-4 py-3 text-sm text-gray-700"
              >
                <span>{index + 1}</span>
                <span>{row.name || row.attendee_name || "N/A"}</span>
                <span>{row.email || row.attendee_email || "N/A"}</span>

                <span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
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

        <div className="flex justify-center items-center gap-2 mt-6">
          <button className="text-gray-400 hover:text-gray-600 text-lg">‹</button>
          <span className="text-gray-600 text-sm">1/1</span>
          <button className="text-gray-400 hover:text-gray-600 text-lg">›</button>
        </div>
      </div>
    </div>
  );
};

export default ViewAttendance;
