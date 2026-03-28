import React from "react";
import AttendanceList from "./AttendanceList";
import { View } from "lucide-react";
import ViewAttendance from "./ViewAttendance";
import AttendanceUpgrade from "./AttendanceUpgrade";

const Attendance = () => {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white px-4 py-12 md:items-start lg:items-center">
      <AttendanceList />
      {/* <ViewAttendance /> */}
      {/* <AttendanceUpgrade /> */}
    </div>
  );
};

export default Attendance;
