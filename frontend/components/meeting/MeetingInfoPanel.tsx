"use client";

import React, { useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { Copy, Check, Link2, Clock, Users, Shield, Radio } from "lucide-react";

export function MeetingInfoPanel() {
  const { meetingInfo, participants, meetingDuration } = useMeeting();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(meetingInfo.meetingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">Meeting Info</h3>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
        {/* Room name */}
        <div>
          <p className="text-lg font-bold text-white leading-tight">
            {meetingInfo.roomName}
          </p>
          <p className="text-xs text-white/30 mt-1 capitalize">
            {meetingInfo.roomType}
          </p>
        </div>

        {/* Meeting link */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <p className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-2">
            Meeting Link
          </p>
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-brand-green-soft shrink-0" />
            <span className="text-xs text-white/60 truncate flex-1">
              {meetingInfo.meetingLink}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-brand-green" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/40" />
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <InfoStat
            icon={<Clock className="w-4 h-4" />}
            label="Duration"
            value={formatDuration(meetingDuration)}
          />
          <InfoStat
            icon={<Users className="w-4 h-4" />}
            label="Participants"
            value={`${participants.length}/${meetingInfo.maxParticipants}`}
          />
          <InfoStat
            icon={<Shield className="w-4 h-4" />}
            label="Waiting Room"
            value={meetingInfo.isWaitingRoomEnabled ? "Enabled" : "Disabled"}
          />
          <InfoStat
            icon={<Radio className="w-4 h-4" />}
            label="Recording"
            value={meetingInfo.isRecording ? "Active" : "Off"}
          />
        </div>

        {/* Host */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-2">
            Host
          </p>
          <p className="text-sm text-white/80">{meetingInfo.hostName}</p>
        </div>

        {/* Access code */}
        {meetingInfo.accessCode && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-2">
              Access Code
            </p>
            <p className="text-sm text-white/80 font-mono">
              {meetingInfo.accessCode}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-2 text-white/30 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          {label}
        </span>
      </div>
      <p className="text-sm font-medium text-white/80">{value}</p>
    </div>
  );
}
