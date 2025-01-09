import { CircleCheck } from "lucide-react";
import React from "react";

const SideDetail = () => {
  const meetingFeatures = [
    "Meeting length up to 40 min",
    "No wait time in between meetings",
    "Up to 100 attendees",
    "Unlimited 1:1 and team messaging",
    "Unlimited whiteboard",
  ];

  return (
    <div className="flex-1 flex flex-col gap-y-6 font-medium">
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
