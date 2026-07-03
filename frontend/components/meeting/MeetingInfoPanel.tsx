"use client";

import React, { useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { Copy, Check, Link2, Clock, Users, Shield, Radio, Gift } from "lucide-react";

export function MeetingInfoPanel() {
  const { meetingInfo, participants, meetingDuration, totalDonations, currentUser, roomFeatureFlags } = useMeeting();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(dynamicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dynamicLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${meetingInfo.roomSlug}` : meetingInfo.meetingLink;
  const hostName = participants.find(p => p.role === 'host')?.name || meetingInfo.hostName;

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--mt-border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--mt-text)" }}>Meeting Info</h3>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
        {/* Room name */}
        <div>
          <p className="text-lg font-bold leading-tight" style={{ color: "var(--mt-text)" }}>
            {meetingInfo.roomName}
          </p>
          <p className="text-xs mt-1 capitalize" style={{ color: "var(--mt-text-faint)" }}>
            {meetingInfo.roomType}
          </p>
        </div>

        {/* Meeting link */}
        <div
          className="rounded-xl p-3"
          style={{
            backgroundColor: "var(--mt-bg-control)",
            border: "1px solid var(--mt-border)",
          }}
        >
          <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--mt-text-faint)" }}>
            Share Link
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate" style={{ color: "var(--mt-text)" }}>
                {dynamicLink}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-brand-green" />
              ) : (
                <Copy className="w-3.5 h-3.5" style={{ color: "var(--mt-text-secondary)" }} />
              )}
            </button>
          </div>
        </div>

        {/* Stats row */}
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
          <p
            className="text-[11px] uppercase tracking-wider font-semibold mb-2"
            style={{ color: "var(--mt-text-faint)" }}
          >
            Host
          </p>
          <p className="text-sm" style={{ color: "var(--mt-text-secondary)" }}>{hostName}</p>
        </div>

        {/* Donations */}
        {roomFeatureFlags.donationsEnabled && (currentUser.role === 'host' || currentUser.role === 'co-host') && (
          <div>
            <p
              className="text-[11px] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"
              style={{ color: "var(--mt-text-faint)" }}
            >
              <Gift className="w-3.5 h-3.5" /> Total Donations
            </p>
            <p className="text-xl font-bold text-brand-green">
              ${totalDonations.toFixed(2)}
            </p>
          </div>
        )}

        {/* Access code */}
        {meetingInfo.accessCode && (
          <div>
            <p
              className="text-[11px] uppercase tracking-wider font-semibold mb-2"
              style={{ color: "var(--mt-text-faint)" }}
            >
              Access Code
            </p>
            <p className="text-sm font-mono" style={{ color: "var(--mt-text-secondary)" }}>
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
    <div
      className="rounded-xl p-3"
      style={{
        backgroundColor: "var(--mt-bg-control)",
        border: "1px solid var(--mt-border)",
      }}
    >
      <div className="flex items-center gap-2 mb-1" style={{ color: "var(--mt-text-faint)" }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          {label}
        </span>
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--mt-text-secondary)" }}>{value}</p>
    </div>
  );
}
