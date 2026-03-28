import { CircleCheck } from "lucide-react";
import React from "react";

import { cn } from "../../lib/utils";

const SideDetail = ({ className }) => {
  const meetingFeatures = [
    "Meeting length up to 60 min for FREE",
    "Transcription & Translation",
    "Meeting Summary & Highlights",
    "Auto Attendance",
    "Share Youtube Videos(eCinema)",
    "Livestream to Youtube & Facebook Concurrently",
    "Receive Donations in your Meeting",
    "Multi-User, Multi-Page and Friendly Whiteboard",
    "Create Public & Private, Free & Paid Events",
  ];

  return (
    <div
      className={cn("mb-10 flex flex-1 flex-col gap-y-6 font-medium", className)}
    >
      {meetingFeatures.map((message, id) => (
        <div key={id} className="flex gap-x-2 items-center">
          <CircleCheck className="h-[20px] w-[20px]" />
          <p className="text-[#0A2540]">{message}</p>
        </div>
      ))}
    </div>
  );
};

export default SideDetail;
