import React from "react";
import AttendanceList from "./AttendanceList";
import { View } from "lucide-react";
import ViewAttendance from "./ViewAttendance";
import AttendanceUpgrade from "./AttendanceUpgrade";
import SessionDashboard from "./SessionDashboard";

const Attendance = () => {
  return (
    <div className="w-full min-h-screen flex justify-center items-center bg-white py-12 px-4">
      <AttendanceList />
      {/* <ViewAttendance /> */}
      {/* <AttendanceUpgrade /> */}
      {/* <SessionDashboard /> */}
    </div>
  );
};

export default Attendance;
