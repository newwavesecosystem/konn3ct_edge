"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  MicOff,
  MonitorUp,
  Hand,
  Crown,
  Shield,
} from "lucide-react";
import type { Participant } from "@/lib/types/meeting";
import { useMeeting } from "@/lib/meeting-context";

interface ParticipantTileProps {
  participant: Participant;
  isLarge?: boolean;
  /** When true, the tile constrains itself to 16:9 (used in filmstrips). */
  fixedAspect?: boolean;
  className?: string;
}

const roleIcon: Record<string, React.ReactNode> = {
  host: <Crown className="w-3 h-3 text-yellow-400" />,
  "co-host": <Shield className="w-3 h-3 text-blue-400" />,
};

/**
 * A single participant tile.
 *
 * The tile is *fluid* by default — it fills 100% of its parent on both axes.
 * The parent layout decides the shape (tall, wide, square). This is the key
 * difference from the old version, which forced every tile to `aspect-video`
 * regardless of context.
 *
 * Pass `fixedAspect` to opt into a 16:9 box (used in filmstrips / spotlight
 * thumbnails, where a uniform tile shape matters).
 */
export function ParticipantTile({
  participant,
  isLarge = false,
  fixedAspect = false,
  className,
}: ParticipantTileProps) {
  const { currentUser } = useMeeting();

  const initials = participant.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const setVideoRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      if (el && participant.videoTrack) {
        if (el.srcObject) {
          const stream = el.srcObject as MediaStream;
          if (stream.getVideoTracks()[0] === participant.videoTrack) return;
        }
        el.srcObject = new MediaStream([participant.videoTrack]);
      }
    },
    [participant.videoTrack],
  );

  const setAudioRef = React.useCallback(
    (el: HTMLAudioElement | null) => {
      if (el && participant.audioTrack) {
        if (el.srcObject) {
          const stream = el.srcObject as MediaStream;
          if (stream.getAudioTracks()[0] === participant.audioTrack) return;
        }
        el.srcObject = new MediaStream([participant.audioTrack]);
      }
    },
    [participant.audioTrack],
  );

  const isSelf = participant.id === currentUser.id;

  return (
    <div
      className={cn(
        "relative w-full h-full rounded-2xl overflow-hidden group",
        "transition-shadow duration-300",
        fixedAspect && "aspect-video",
        className,
      )}
      style={{
        backgroundColor: "var(--mt-bg-tile)",
      }}
    >
      {/* ── Speaking ring (inset, never clipped by overflow-hidden parents) ── */}
      {participant.isSpeaking && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl z-20"
          style={{
            boxShadow:
              "inset 0 0 0 3px var(--color-brand-green, #207450), 0 0 24px -4px rgba(32,116,80,0.55)",
          }}
        />
      )}

      {/* ── Video / avatar area ── */}
      {participant.isCameraOn ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--mt-bg-tile-camera), var(--mt-bg-tile), var(--mt-bg-tile-alt2))",
          }}
        >
          {participant.videoTrack ? (
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: isSelf ? "scaleX(-1)" : "none" }}
            />
          ) : (
            <div className="relative flex flex-col items-center gap-2">
              {/* Camera on but no track yet — show circular avatar */}
              <div
                className={cn(
                  "rounded-full flex items-center justify-center font-bold shadow-lg",
                  isLarge ? "w-32 h-32 text-5xl" : "w-28 h-28 text-3xl",
                )}
                style={{
                  backgroundColor: "var(--mt-avatar-bg, var(--mt-bg-tile-alt))",
                  color: "var(--mt-avatar-text, var(--mt-text))",
                  border: "3px solid rgba(255,255,255,0.18)",
                }}
              >
                {initials}
              </div>
              {participant.isSpeaking && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-[2px]">
                  {[12, 18, 10, 16].map((h, i) => (
                    <span
                      key={i}
                      className="inline-block w-[3px] bg-brand-green rounded-full animate-pulse"
                      style={{
                        height: `${h}px`,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--mt-bg-tile-alt), var(--mt-bg-tile), var(--mt-bg-tile-alt2))",
          }}
        >
          {/* Larger circular avatar — matches the image style */}
          <div
            className={cn(
              "rounded-full flex items-center justify-center font-bold shadow-lg",
              isLarge ? "w-32 h-32 text-5xl" : "w-28 h-28 text-3xl",
            )}
            style={{
              backgroundColor: "var(--mt-avatar-bg, var(--mt-bg-tile-alt))",
              color: "var(--mt-avatar-text, var(--mt-text))",
              border: "3px solid rgba(255,255,255,0.18)",
            }}
          >
            {initials}
          </div>
        </div>
      )}

      {/* ── Hand raised ── */}
      {participant.isHandRaised && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-yellow-500/90 backdrop-blur-sm rounded-full p-1.5 animate-bounce shadow-lg">
            <Hand className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* ── Screen sharing badge ── */}
      {participant.isScreenSharing && (
        <div className="absolute top-3 left-3 z-10">
          <div className="bg-blue-500/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 text-xs text-white font-medium">
            <MonitorUp className="w-3 h-3" />
            Sharing
          </div>
        </div>
      )}

      {/* ── Muted mic pill (Google Meet style, top-right) ── */}
      {participant.isMuted && !participant.isHandRaised && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-black/55 backdrop-blur-md rounded-full p-1.5 shadow-md">
            <MicOff className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}

      {/* ── Name pill (bottom-left, no full-width gradient strip) ── */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2 pointer-events-none">
        <div
          className="flex items-center gap-1.5 min-w-0 max-w-full px-2.5 py-1 rounded-lg backdrop-blur-md"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          {roleIcon[participant.role] && (
            <span className="shrink-0">{roleIcon[participant.role]}</span>
          )}
          <span className="text-white text-xs font-medium truncate">
            {participant.name}
          </span>
          {isSelf && (
            <span className="text-white/60 text-[10px] shrink-0">(You)</span>
          )}
        </div>
      </div>

      {/* Hidden audio element for remote participants */}
      {participant.audioTrack && !isSelf && (
        <audio autoPlay playsInline ref={setAudioRef} />
      )}
    </div>
  );
}