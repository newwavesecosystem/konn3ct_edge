import React from "react";

const ViewAttendance = () => {
  const attendanceData = [
    {
      id: 1,
      name: "Odejimi Samuel",
      email: "Odejimisam@email.com",
      status: "Joined",
      date: "2025-07-26 | 2:29:30",
    },
    {
      id: 2,
      name: "Odejimi Samuel",
      email: "Odejimisam@email.com",
      status: "Joined",
      date: "2025-07-26 | 2:29:30",
    },
    {
      id: 3,
      name: "Odejimi Samuel",
      email: "Odejimisam@email.com",
      status: "Joined",
      date: "2025-07-26 | 2:29:30",
    },
    {
      id: 4,
      name: "Odejimi Samuel",
      email: "Odejimisam@email.com",
      status: "Joined",
      date: "2025-07-26 | 2:29:30",
    },
    {
      id: 5,
      name: "Odejimi Samuel",
      email: "Odejimisam@email.com",
      status: "Joined",
      date: "2025-07-26 | 2:29:30",
    },
    {
      id: 6,
      name: "Odejimi Samuel",
      email: "Odejimisam@email.com",
      status: "Joined",
      date: "2025-07-26 | 2:29:30",
    },
  ];

  return (
    <div className="min-h-screen  flex items-start justify-center pt-16">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-sm border p-8">
        {/* Top Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-3">
            <button className="px-4 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50">
              COPY
            </button>
            <button className="px-4 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50">
              CSV
            </button>
            <button className="px-4 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50">
              EXCEL
            </button>
            <button className="px-4 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50">
              PRINT
            </button>
          </div>

          <input
            type="text"
            placeholder="Search"
            className="border border-gray-200 px-4 py-2 rounded-full w-64 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Title */}
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Meeting Attendance
        </h2>

        {/* Simplified Table */}
        <div className="space-y-3">
          {/* Table Headers */}
          <div className="grid grid-cols-5 text-sm text-gray-500 font-medium">
            <span>S/N</span>
            <span>NAME</span>
            <span>EMAIL</span>
            <span>STATUS</span>
            <span>DATE & TIME</span>
          </div>

          {/* Table Rows */}
          {attendanceData.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-5 items-center bg-gray-50 hover:bg-gray-100 transition rounded-xl px-4 py-3 text-sm text-gray-700"
            >
              <span>{row.id}</span>
              <span>{row.name}</span>
              <span>{row.email}</span>
              <span>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                  {row.status}
                </span>
              </span>
              <span>{row.date}</span>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-2 mt-6">
          <button className="text-gray-400 hover:text-gray-600 text-lg">‹</button>
          <span className="text-gray-600 text-sm">1/5</span>
          <button className="text-gray-400 hover:text-gray-600 text-lg">›</button>
        </div>
      </div>
    </div>
  );
};

export default ViewAttendance;
