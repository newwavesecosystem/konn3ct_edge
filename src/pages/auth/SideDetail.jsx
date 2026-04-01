import { CircleCheck } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../lib/utils";

const DEFAULT_MEETING_FEATURES = [
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

const normalizeMeetingFeatures = (value) => {
  if (!Array.isArray(value)) {
    return DEFAULT_MEETING_FEATURES;
  }

  const validFeatures = value.filter(
    (feature) => typeof feature === "string" && feature.trim().length > 0
  );

  return validFeatures.length > 0 ? validFeatures : DEFAULT_MEETING_FEATURES;
};

const SideDetail = ({ className }) => {
  const { t } = useTranslation();
  const rawMeetingFeatures = t("auth.sideDetail.features", {
    returnObjects: true,
    defaultValue: DEFAULT_MEETING_FEATURES,
  });
  // Async locale loading can briefly return a key/string instead of the array.
  const meetingFeatures = normalizeMeetingFeatures(rawMeetingFeatures);

  return (
    <div
      className={cn("mb-10 flex flex-1 flex-col gap-y-6 font-medium", className)}
    >
      {meetingFeatures.map((message, id) => (
        <div key={id} className="flex gap-x-2 items-center">
          <CircleCheck className="h-[20px] w-[20px]" />
          <p className="text-[#0A2540] dark:text-white">{message}</p>
        </div>
      ))}
    </div>
  );
};

export default SideDetail;
