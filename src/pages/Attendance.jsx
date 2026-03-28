import React from "react";

import AttendanceList from "./AttendanceList";

const Attendance = () => {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-12 transition-colors duration-300 md:items-start lg:items-center">
      <AttendanceList />
    </div>
  );
};

export default Attendance;
