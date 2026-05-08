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
      {/* Main speaker — 50% on mobile, flex-1 on desktop */}
      <div className="h-1/2 sm:flex-1 sm:h-auto min-h-0 shrink-0 sm:shrink">
        <ParticipantTile
          participant={activeSpeaker}
          isLarge
          className="w-full h-full"
        />
      </div>
      {/* Filmstrip — 50% on mobile (grid), horizontal scroll on desktop */}
      {others.length > 0 && (
        <div className="h-1/2 sm:h-auto sm:shrink-0 min-h-0 overflow-hidden">
          {/* Mobile: 2-column grid, scrollable */}
          <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto no-scrollbar sm:hidden">
            {others.slice(0, 6).map((p) => (
              <div key={p.id}>
                <ParticipantTile participant={p} />
              </div>
            ))}
            {others.length > 6 && (
              <div
                className="aspect-video rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "var(--mt-bg-tile)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--mt-text-muted)" }}>
                  +{others.length - 6} more
                </span>
              </div>
            )}
          </div>
          {/* Desktop: horizontal filmstrip */}
          <div className="hidden sm:flex gap-2 overflow-x-auto no-scrollbar py-1">
            {others.slice(0, 6).map((p) => (
              <div key={p.id} className="w-36 lg:w-44 shrink-0">
                <ParticipantTile participant={p} />
              </div>
            ))}
            {others.length > 6 && (
              <div
                className="w-36 lg:w-44 shrink-0 aspect-video rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "var(--mt-bg-tile)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--mt-text-muted)" }}>
                  +{others.length - 6} more
                </span>
              </div>
            )}
          </div>
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
    <div className="flex-1 flex flex-col lg:flex-row gap-1.5 sm:gap-2 p-1.5 sm:p-3 overflow-hidden">
      {/* ── Shared screen area ──────────────────────── */}
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden transition-all duration-300",
          isFullscreen
            ? "fixed inset-2 z-50"
            : "flex-1 min-h-0 min-w-0"
        )}
        style={{
          backgroundColor: "var(--mt-bg-screen)",
          border: "1px solid var(--mt-border)",
        }}
      >
        {/* Mock shared screen content */}
        <div className="absolute inset-0 flex flex-col">
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 backdrop-blur-sm shrink-0 z-10"
            style={{
              backgroundColor: "var(--mt-bg-screen)",
              borderBottom: "1px solid var(--mt-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-blue-500/15 text-blue-400 px-2 sm:px-2.5 py-1 rounded-lg">
                <MonitorUp className="w-3.5 h-3.5" />
                <span className="text-[11px] sm:text-xs font-semibold">
                  {isMe ? "You are sharing" : `${sharerName} is sharing`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--mt-text-faint)" }}
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
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-xs font-semibold transition-all duration-200 active:scale-95"
                >
                  <MonitorOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Stop Sharing</span>
                  <span className="sm:hidden">Stop</span>
                </button>
              )}
            </div>
          </div>

          {/* Screen content mock */}
          <div
            className="flex-1 flex items-center justify-center"
            style={{
              background: `linear-gradient(to bottom right, var(--mt-bg-screen-grad1), var(--mt-bg-screen), var(--mt-bg-screen-grad2))`,
            }}
          >
            <div className="flex flex-col items-center gap-3 sm:gap-4 text-center px-4 sm:px-6 max-w-lg">
              {/* Mock presentation / desktop */}
              <div
                className="w-full max-w-md aspect-[16/10] rounded-xl p-4 sm:p-6 flex flex-col gap-2 sm:gap-3 shadow-2xl"
                style={{
                  backgroundColor: "var(--mt-bg-screen-content)",
                  border: "1px solid var(--mt-border)",
                }}
              >
                {/* Mock title bar */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-400/60" />
                  <div
                    className="ml-2 sm:ml-3 h-3 sm:h-4 w-24 sm:w-40 rounded"
                    style={{ backgroundColor: "var(--mt-bg-control)" }}
                  />
                </div>
                {/* Mock content lines */}
                <div className="flex-1 flex flex-col gap-1.5 sm:gap-2 pt-1 sm:pt-2">
                  <div className="h-4 sm:h-5 w-3/4 rounded" style={{ backgroundColor: "var(--mt-text-whisper)" }} />
                  <div className="h-2.5 sm:h-3 w-full rounded" style={{ backgroundColor: "var(--mt-bg-control)" }} />
                  <div className="h-2.5 sm:h-3 w-5/6 rounded" style={{ backgroundColor: "var(--mt-bg-control)" }} />
                  <div className="h-2.5 sm:h-3 w-2/3 rounded" style={{ backgroundColor: "var(--mt-bg-control)" }} />
                  <div className="mt-2 sm:mt-3 flex gap-1.5 sm:gap-2">
                    <div className="h-10 sm:h-16 flex-1 rounded-lg bg-blue-500/10 border border-blue-500/10" />
                    <div className="h-10 sm:h-16 flex-1 rounded-lg bg-green-500/10 border border-green-500/10" />
                    <div className="h-10 sm:h-16 flex-1 rounded-lg bg-purple-500/10 border border-purple-500/10" />
                  </div>
                  <div className="h-2.5 sm:h-3 w-1/2 rounded mt-1 sm:mt-2" style={{ backgroundColor: "var(--mt-bg-control)" }} />
                  <div className="h-2.5 sm:h-3 w-3/4 rounded" style={{ backgroundColor: "var(--mt-bg-control)" }} />
                </div>
              </div>

              <div className="flex items-center gap-2" style={{ color: "var(--mt-text-ghost)" }}>
                <MousePointerClick className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-[11px] sm:text-xs">
                  {isMe
                    ? "Your screen is being shared"
                    : "Viewing shared screen"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Participant filmstrip (bottom horizontal on mobile, vertical sidebar on desktop) ── */}
      <div
        className={cn(
          "shrink-0 overflow-hidden no-scrollbar",
          isFullscreen && "hidden"
        )}
      >
        {/* Mobile / Tablet: horizontal scroll at bottom */}
        <div className="flex lg:hidden gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {participants.map((p) => (
            <div key={p.id} className="w-24 sm:w-32 shrink-0">
              <ParticipantTile participant={p} />
            </div>
          ))}
        </div>
        {/* Desktop: vertical sidebar */}
        <div className="hidden lg:flex flex-col gap-2 w-44 xl:w-52 overflow-y-auto no-scrollbar h-full">
          {participants.map((p) => (
            <div key={p.id} className="w-full shrink-0">
              <ParticipantTile participant={p} />
            </div>
          ))}
        </div>
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
