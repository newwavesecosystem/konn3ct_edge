"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { ParticipantTile } from "./ParticipantTile";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/types/meeting";
import {
  MonitorOff,
  MonitorUp,
  Maximize2,
  Minimize2,
  MousePointerClick,
} from "lucide-react";

export function StageView() {
  const { participants, layoutMode, isScreenSharing, toggleScreenShare, currentUser } =
    useMeeting();

  // Check if ANY participant is currently screen sharing
  const screenSharer = participants.find((p) => p.isScreenSharing);
  const isSomeoneSharing = !!screenSharer || isScreenSharing;

  // If someone is sharing, override the layout to the screen share view
  if (isSomeoneSharing) {
    return (
      <ScreenShareLayout
        participants={participants}
        screenSharer={screenSharer}
        isCurrentUserSharing={isScreenSharing}
        onStopSharing={toggleScreenShare}
        currentUserId={currentUser.id}
      />
    );
  }

  // ── Regular layouts (no screen share active) ─────────
  const activeSpeaker =
    participants.find((p) => p.isSpeaking) || participants[0];
  const others = participants.filter((p) => p.id !== activeSpeaker.id);

  if (layoutMode === "grid") {
    return <GridLayout participants={participants} />;
  }

  if (layoutMode === "spotlight") {
    return (
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
        <ParticipantTile
          participant={activeSpeaker}
          isLarge
          className="w-full max-w-5xl"
        />
      </div>
    );
  }

  // Default: speaker layout
  return (
    <div className="flex-1 flex flex-col gap-2 p-2 sm:p-3 overflow-hidden">
      {/* Main speaker */}
      <div className="flex-1 min-h-0">
        <ParticipantTile
          participant={activeSpeaker}
          isLarge
          className="w-full h-full"
        />
      </div>
      {/* Filmstrip */}
      {others.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 shrink-0">
          {others.slice(0, 6).map((p) => (
            <div key={p.id} className="w-28 sm:w-36 lg:w-44 shrink-0">
              <ParticipantTile participant={p} />
            </div>
          ))}
          {others.length > 6 && (
            <div className="w-28 sm:w-36 lg:w-44 shrink-0 aspect-video rounded-2xl bg-[#1a1a2e] flex items-center justify-center">
              <span className="text-white/60 text-sm font-medium">
                +{others.length - 6} more
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Screen Share Layout ────────────────────────────────
function ScreenShareLayout({
  participants,
  screenSharer,
  isCurrentUserSharing,
  onStopSharing,
  currentUserId,
}: {
  participants: Participant[];
  screenSharer: Participant | undefined;
  isCurrentUserSharing: boolean;
  onStopSharing: () => void;
  currentUserId: string;
}) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const sharerName = screenSharer?.name ?? "You";
  const isMe =
    isCurrentUserSharing || screenSharer?.id === currentUserId;

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 sm:p-3 overflow-hidden">
      {/* ── Shared screen area ──────────────────────── */}
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden bg-[#0a0a18] border border-white/5 transition-all duration-300",
          isFullscreen
            ? "fixed inset-2 z-50"
            : "flex-1 min-h-0 lg:min-w-0"
        )}
      >
        {/* Mock shared screen content */}
        <div className="absolute inset-0 flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a18]/90 backdrop-blur-sm border-b border-white/5 shrink-0 z-10">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-blue-500/15 text-blue-400 px-2.5 py-1 rounded-lg">
                <MonitorUp className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">
                  {isMe ? "You are sharing" : `${sharerName} is sharing`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              {isMe && (
                <button
                  onClick={onStopSharing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-xs font-semibold transition-all duration-200 active:scale-95"
                >
                  <MonitorOff className="w-3.5 h-3.5" />
                  Stop Sharing
                </button>
              )}
            </div>
          </div>

          {/* Screen content mock */}
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#0e1525] via-[#0a0a18] to-[#0e0e24]">
            <div className="flex flex-col items-center gap-4 text-center px-6 max-w-lg">
              {/* Mock presentation / desktop */}
              <div className="w-full max-w-md aspect-[16/10] rounded-xl bg-[#141428] border border-white/5 p-6 flex flex-col gap-3 shadow-2xl">
                {/* Mock title bar */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                  <div className="ml-3 h-4 w-40 rounded bg-white/5" />
                </div>
                {/* Mock content lines */}
                <div className="flex-1 flex flex-col gap-2 pt-2">
                  <div className="h-5 w-3/4 rounded bg-white/8" />
                  <div className="h-3 w-full rounded bg-white/4" />
                  <div className="h-3 w-5/6 rounded bg-white/4" />
                  <div className="h-3 w-2/3 rounded bg-white/4" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-16 flex-1 rounded-lg bg-blue-500/10 border border-blue-500/10" />
                    <div className="h-16 flex-1 rounded-lg bg-green-500/10 border border-green-500/10" />
                    <div className="h-16 flex-1 rounded-lg bg-purple-500/10 border border-purple-500/10" />
                  </div>
                  <div className="h-3 w-1/2 rounded bg-white/4 mt-2" />
                  <div className="h-3 w-3/4 rounded bg-white/4" />
                </div>
              </div>

              <div className="flex items-center gap-2 text-white/20">
                <MousePointerClick className="w-4 h-4" />
                <span className="text-xs">
                  {isMe
                    ? "Your screen is being shared with participants"
                    : "Viewing shared screen"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Participant filmstrip (side on desktop, bottom on mobile) ── */}
      <div
        className={cn(
          "shrink-0 flex gap-2 overflow-auto no-scrollbar",
          isFullscreen && "hidden",
          // Mobile: horizontal scroll at bottom
          "flex-row lg:flex-col",
          // Desktop: vertical column on the right
          "lg:w-44 xl:w-52 lg:overflow-y-auto lg:overflow-x-hidden"
        )}
      >
        {participants.map((p) => (
          <div
            key={p.id}
            className={cn(
              "shrink-0",
              // Mobile: fixed width horizontal tiles
              "w-28 sm:w-36",
              // Desktop: full width vertical tiles
              "lg:w-full"
            )}
          >
            <ParticipantTile participant={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Grid Layout ────────────────────────────────────────
function GridLayout({ participants }: { participants: Participant[] }) {
  const count = participants.length;
  const cols =
    count <= 1
      ? 1
      : count <= 4
      ? 2
      : count <= 9
      ? 3
      : 4;

  return (
    <div
      className={cn(
        "flex-1 p-2 sm:p-3 grid gap-2 auto-rows-fr overflow-hidden",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-2 sm:grid-cols-3",
        cols === 4 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      )}
    >
      {participants.map((p) => (
        <ParticipantTile key={p.id} participant={p} />
      ))}
    </div>
  );
}
