import React, { useState } from "react";
import { Wifi, Mic, Video, MessageCircle } from "lucide-react";

const users = [
  {
    name: "Odejimni Samuel",
    initials: "OD",
    time: "Oct 2, 05:35:47 PM",
    online: "00:06:43",
    talk: "00:00:04",
    webcam: "00:06:17",
    messages: 3,
    reaction: "\u{1F605}",
    raise: 4,
  },
  {
    name: "Akanji Joseph",
    initials: "AJ",
    time: "Oct 2, 05:50:00 PM",
    online: "00:06:43",
    talk: "00:00:04",
    webcam: "00:06:17",
    messages: 3,
    reaction: "\u{1F605}",
    raise: 2,
  },
  {
    name: "Debbie Williams",
    initials: "DW",
    time: "Oct 2, 05:35:47 PM",
    online: "00:02:43",
    talk: "00:01:14",
    webcam: "00:01:17",
    messages: 8,
    reaction: "\u{1F605}",
    raise: 2,
  },
  {
    name: "Name Name",
    initials: "NN",
    time: "Oct 2, 05:35:47 PM",
    online: "00:02:43",
    talk: "00:01:14",
    webcam: "00:01:17",
    messages: 8,
    reaction: "\u{1F605}",
    raise: 2,
  },
  {
    name: "Name Name",
    initials: "NN",
    time: "Oct 2, 05:35:47 PM",
    online: "00:02:43",
    talk: "00:01:14",
    webcam: "00:01:17",
    messages: 8,
    reaction: "\u{1F605}",
    raise: 2,
  },
  {
    name: "Name Name",
    initials: "NN",
    time: "Oct 2, 05:35:47 PM",
    online: "00:02:43",
    talk: "00:01:14",
    webcam: "00:01:17",
    messages: 8,
    reaction: "\u{1F605}",
    raise: 2,
  },
];

const stats = [
  { title: "Active User", value: 3, color: "bg-blue-100 text-blue-700" },
  { title: "Activity Score", value: 2, color: "bg-pink-100 text-pink-700" },
  { title: "Timeline", value: 0, color: "bg-cyan-100 text-cyan-700" },
  { title: "Polls", value: 1, color: "bg-yellow-100 text-yellow-700" },
  { title: "Donation", value: 0, color: "bg-purple-100 text-purple-700" },
];

export default function AttendanceUpgrade() {
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 4;
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedUsers = users.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="min-h-screen flex flex-col items-center py-6 px-2">
      <div className="max-w-6xl w-full bg-white rounded-2xl shadow p-4">
        <h2 className="text-sm font-semibold mb-4">Odejimni Samuel Room</h2>

        {/* Stats Row */}
        <div className="flex flex-wrap gap-2 mb-6">
          {stats.map((s, i) => (
            <div
              key={i}
              className={`flex-1 min-w-[120px] rounded-lg ${s.color} flex flex-col items-center justify-center p-2`}
            >
              <p className="text-lg font-semibold">{s.value}</p>
              <p className="text-xs font-medium">{s.title}</p>
            </div>
          ))}
        </div>

        {/* Overview Section */}
        <h3 className="text-sm font-semibold mb-2">Overview</h3>

        <div className="md:overflow-x-auto lg:overflow-visible">
          <div className="md:min-w-[720px] lg:min-w-0">
            {/* Header Row */}
            <div className="mb-2 grid grid-cols-7 border-b pb-1 text-xs font-semibold text-gray-600">
              <p>User</p>
              <p>Online</p>
              <p>Talk</p>
              <p>Webcam</p>
              <p>Msgs</p>
              <p>React</p>
              <p>Raise</p>
            </div>

            {/* User Rows */}
            <div className="space-y-2">
              {paginatedUsers.map((u, i) => (
                <div
                  key={`${u.name}-${pageStart + i}`}
                  className="grid grid-cols-7 items-center rounded-lg bg-white p-2 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-700">
                      {u.initials}
                    </div>
                    <div className="leading-tight">
                      <p className="text-xs font-medium">{u.name}</p>
                      <p className="text-[10px] text-gray-500">{u.time}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-700">
                    <Wifi size={12} /> {u.online}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-700">
                    <Mic size={12} /> {u.talk}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-700">
                    <Video size={12} /> {u.webcam}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-700">
                    <MessageCircle size={12} /> {u.messages}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-700">
                    <span>{u.reaction}</span>
                    <span>{u.reaction === "\u{1F605}" ? 1 : 0}</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-700">
                    <span>{"\u{1F525}"}</span> {u.raise}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center mt-4 text-xs text-gray-600 font-medium">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className={`px-2 py-1 border rounded-l-md ${
              currentPage === 1 ? "cursor-not-allowed opacity-50" : "hover:bg-gray-100"
            }`}
          >
            &lt;
          </button>
          <span className="px-3">
            {currentPage}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className={`px-2 py-1 border rounded-r-md ${
              currentPage === totalPages ? "cursor-not-allowed opacity-50" : "hover:bg-gray-100"
            }`}
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
