"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  MonitorUp,
  MoreHorizontal,
  Check,
  X,
  UserMinus,
  Smartphone,
  Shield,
  ShieldOff,
  Lock,
  Unlock,
  MessageSquareOff,
  VideoOff as VideoOffIcon,
  Search
} from "lucide-react";
import type { Participant } from "@/lib/types/meeting";

const roleLabel: Record<string, string> = {
  host: "Host",
  "co-host": "Co-host",
  presenter: "Presenter",
  attendee: "Attendee",
  guest: "Guest",
};

const roleColor: Record<string, string> = {
  host: "text-yellow-400 bg-yellow-400/10",
  "co-host": "text-blue-400 bg-blue-400/10",
  presenter: "text-purple-400 bg-purple-400/10",
};

export function ParticipantsPanel() {
  const { participants: allParticipants, currentUser, waitingUsers, admitUser, denyUser, admitAllUsers, denyAllUsers } = useMeeting();
  const [searchQuery, setSearchQuery] = React.useState("");

  const participants = allParticipants.filter(p => 
    p.role !== "bot" && p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hosts = participants.filter(
    (p) => p.role === "host" || p.role === "co-host"
  );
  const presenters = participants.filter((p) => p.role === "presenter");
  const attendees = participants.filter(
    (p) => p.role === "attendee" || p.role === "guest"
  );
  
  const totalVisibleParticipants = hosts.length + presenters.length + attendees.length;

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 flex flex-col gap-3"
        style={{ borderBottom: "1px solid var(--mt-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--mt-text)" }}>
            Participants{" "}
            <span style={{ color: "var(--mt-text-faint)" }} className="font-normal">
              ({totalVisibleParticipants})
            </span>
          </h3>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mt-text-muted)" }} />
          <input
            type="text"
            placeholder="Search participants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none transition-colors"
            style={{ 
              backgroundColor: "var(--mt-bg-input)", 
              color: "var(--mt-text)",
              border: "1px solid var(--mt-border)"
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {currentUser.role === 'host' && waitingUsers.length > 0 && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between px-1 mb-1">
              <p
                className="text-[11px] uppercase tracking-wider font-semibold"
                style={{ color: "var(--mt-text-faint)" }}
              >
                Waiting Room ({waitingUsers.length})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => admitAllUsers()}
                  className="text-[10px] px-2 py-0.5 rounded bg-brand-green/10 text-brand-green hover:bg-brand-green/20 transition-colors"
                >
                  Admit All
                </button>
                <button
                  onClick={() => denyAllUsers()}
                  className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                >
                  Deny All
                </button>
              </div>
            </div>
            {waitingUsers.map((u) => (
              <div key={u.userId} className="flex items-center gap-3 px-2 py-2 rounded-xl transition-colors group"
                style={{ backgroundColor: "var(--mt-bg-hover)" }}
              >
                <Avatar
                  fallback={u.name.slice(0, 2).toUpperCase()}
                  alt={u.name}
                  className="w-8 h-8 text-xs"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate font-medium" style={{ color: "var(--mt-text-secondary)" }}>
                    {u.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => admitUser(u.userId)}
                    className="p-1.5 rounded-lg text-brand-green bg-brand-green/10 hover:bg-brand-green/20 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => denyUser(u.userId)}
                    className="p-1.5 rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hosts.length > 0 && (
          <ParticipantGroup
            label="Hosts"
            participants={hosts}
            currentUserId={currentUser.id}
          />
        )}
        {presenters.length > 0 && (
          <ParticipantGroup
            label="Presenters"
            participants={presenters}
            currentUserId={currentUser.id}
          />
        )}
        {attendees.length > 0 && (
          <ParticipantGroup
            label="Attendees"
            participants={attendees}
            currentUserId={currentUser.id}
          />
        )}
      </div>
    </div>
  );
}

function ParticipantGroup({
  label,
  participants,
  currentUserId,
}: {
  label: string;
  participants: Participant[];
  currentUserId: string;
}) {
  return (
    <div className="px-3 py-2">
      <p
        className="text-[11px] uppercase tracking-wider font-semibold px-1 mb-1"
        style={{ color: "var(--mt-text-faint)" }}
      >
        {label} ({participants.length})
      </p>
      {participants.map((p) => (
        <ParticipantRow
          key={p.id}
          participant={p}
          isMe={p.id === currentUserId}
        />
      ))}
    </div>
  );
}

function ParticipantRow({
  participant,
  isMe,
}: {
  participant: Participant;
  isMe: boolean;
}) {
  const initials = participant.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const { currentUser, forceMuteUser, forceVideoOffUser, kickUser, changeUserRole } = useMeeting();
  const isSpeaking = participant.isSpeaking;
  const isHost = currentUser.role === 'host' || currentUser.role === 'co-host';
  const canManage = isHost && !isMe && participant.role !== 'host';
  const canMakeCoHost = currentUser.role === 'host' && !isMe && participant.role !== 'host';

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-xl transition-colors group"
      style={{ cursor: "default" }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--mt-bg-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
    >
      <div className="relative">
        <Avatar
          fallback={initials}
          alt={participant.name}
          className={cn(
            "w-8 h-8 text-xs transition-shadow duration-200",
            isSpeaking && "ring-2 ring-brand-green ring-offset-2 ring-offset-transparent"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm truncate font-medium" style={{ color: "var(--mt-text-secondary)" }}>
            {participant.name}
          </span>
          {isMe && (
            <span className="text-[10px]" style={{ color: "var(--mt-text-faint)" }}>(You)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {roleColor[participant.role] && (
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                roleColor[participant.role]
              )}
            >
              {roleLabel[participant.role]}
            </span>
          )}
          {participant.isMobile && (
            <span className="text-[10px] flex items-center gap-0.5" style={{ color: "var(--mt-text-faint)" }} title="Joined from Mobile">
              <Smartphone className="w-3 h-3" />
            </span>
          )}
          {participant.isScreenSharing && (
            <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
              <MonitorUp className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {/* Status icons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {participant.isHandRaised && (
          <Hand className="w-3.5 h-3.5 text-yellow-400" />
        )}
        {participant.isMuted ? (
          <MicOff className="w-3.5 h-3.5 text-red-400/60" />
        ) : (
          <Mic className="w-3.5 h-3.5" style={{ color: "var(--mt-text-faint)" }} />
        )}
        {participant.isCameraOn ? (
          <Video className="w-3.5 h-3.5" style={{ color: "var(--mt-text-faint)" }} />
        ) : (
          <VideoOff className="w-3.5 h-3.5 text-red-400/60" />
        )}
        
        {canManage && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            {canMakeCoHost && participant.role !== 'co-host' && (
              <button 
                onClick={() => changeUserRole(participant.userId, 'co-host')}
                title="Make Co-host"
                className="p-1 rounded-lg hover:bg-blue-500/20 text-blue-400"
              >
                <Shield className="w-3.5 h-3.5" />
              </button>
            )}
            {canMakeCoHost && participant.role === 'co-host' && (
              <button 
                onClick={() => changeUserRole(participant.userId, 'attendee')}
                title="Remove Co-host"
                className="p-1 rounded-lg hover:bg-red-500/20 text-red-400"
              >
                <ShieldOff className="w-3.5 h-3.5" />
              </button>
            )}
            {!participant.isMuted && (
              <button 
                onClick={() => forceMuteUser(participant.userId)}
                title="Mute for everyone"
                className="p-1 rounded-lg hover:bg-white/10"
                style={{ color: "var(--mt-text-faint)" }}
              >
                <MicOff className="w-3.5 h-3.5" />
              </button>
            )}
            {participant.isCameraOn && (
              <button 
                onClick={() => forceVideoOffUser(participant.userId)}
                title="Turn off video"
                className="p-1 rounded-lg hover:bg-white/10"
                style={{ color: "var(--mt-text-faint)" }}
              >
                <VideoOffIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <button 
              onClick={() => kickUser(participant.userId)}
              title="Remove from meeting"
              className="p-1 rounded-lg hover:bg-red-500/20 text-red-400"
            >
              <UserMinus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
