import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPreRegParticipants } from "../api/eventsApi";

const EventParticipants = () => {
  const { id: reference } = useParams();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setLoading(true);
        const res = await getPreRegParticipants(reference);
        // API returns array directly or inside .data — support both
        setParticipants(res?.data || res || []);
      } catch (err) {
        console.error("Error fetching participants:", err);
      } finally {
        setLoading(false);
      }
    };

    if (reference) fetchParticipants();
  }, [reference]);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 w-full max-w-5xl mx-auto mt-10">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <button className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50">
            Copy
          </button>
          <button className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50">
            CSV
          </button>
          <button className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50">
            Excel
          </button>
          <button className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50">
            Print
          </button>
        </div>

        <button className="bg-[#227451] hover:bg-green-700 text-white text-sm px-5 py-2 rounded-full transition-all">
          Send Reminder Now
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search"
          className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* Header */}
      <h2 className="text-md font-semibold text-gray-800 mb-3">
        Pre-Registered Users
      </h2>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-100 rounded-xl overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left font-medium">S/N</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Date & Time</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700">
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-6 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : participants.length > 0 ? (
              participants.map((p, index) => (
                <tr
                  key={p.id || index}
                  className={`border-t hover:bg-gray-50 transition ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">{p.name || "-"}</td>
                  <td className="px-4 py-3">{p.email || "-"}</td>
                  <td className="px-4 py-3">{p.phone || "-"}</td>
                  <td className="px-4 py-3">{p.dateTime || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center py-6 text-gray-500">
                  No participants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
        <span>
          Showing {participants.length > 0 ? `1-${participants.length}` : "0/0"}
        </span>
        <div className="flex space-x-1">
          <button className="border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-100">
            &lt;
          </button>
          <button className="border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-100">
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventParticipants;
