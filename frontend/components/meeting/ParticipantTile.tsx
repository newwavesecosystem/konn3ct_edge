"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  MicOff,
  VideoOff,
  MonitorUp,
  Hand,
  Crown,
  Shield,
  SignalHigh,
  SignalMedium,
  SignalLow
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
  const { currentUser, selectedDevices, isMirrorVideoEnabled, pauseRemoteVideo, resumeRemoteVideo } = useMeeting();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { root: null, rootMargin: "200px" } // Preload slightly before it enters view
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isSelf = participant.id === currentUser.id;

  React.useEffect(() => {
    if (!isSelf && participant.videoTrack) {
      if (!isVisible) {
        pauseRemoteVideo(participant.videoTrack.id);
      } else {
        resumeRemoteVideo(participant.videoTrack.id);
      }
    }
  }, [isVisible, isSelf, participant.videoTrack, pauseRemoteVideo, resumeRemoteVideo]);

  const initials = participant.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Camera video ref
  const setVideoRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        if (participant.videoTrack) {
          if (el.srcObject) {
            const stream = el.srcObject as MediaStream;
            if (stream.getVideoTracks()[0] === participant.videoTrack) return;
          }
          el.srcObject = new MediaStream([participant.videoTrack]);
          el.play().catch((e) => {
            if (e.name !== 'AbortError') console.warn("Video play failed:", e);
          });
        } else {
          el.srcObject = null;
        }
      }
    },
    [participant.videoTrack]
  );

  // Dedicated screen share ref — completely independent from camera
  const setScreenRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        if (participant.screenTrack) {
          if (el.srcObject) {
            const stream = el.srcObject as MediaStream;
            if (stream.getVideoTracks()[0] === participant.screenTrack) return;
          }
          el.srcObject = new MediaStream([participant.screenTrack]);
          el.play().catch((e) => {
            if (e.name !== 'AbortError') console.warn("Screen share play failed:", e);
          });
        } else {
          el.srcObject = null;
        }
      }
    },
    [participant.screenTrack]
  );

  const isCameraEffectivelyOn = participant.isCameraOn && !!participant.videoTrack && isVisible;

  return (
    <div
      ref={containerRef}
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
      {/* ── Screen Share Overlay ──────────────────────────────────────────────
          Renders on TOP of the camera tile when screensharing is active.
          Camera feed stays alive underneath and shows as a PiP corner bubble.
      ──────────────────────────────────────────────────────────────────────── */}
      {participant.screenTrack && participant.isScreenSharing && isVisible && (
        <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
          {/* Full screen content — object-contain preserves aspect ratio */}
          <video
            ref={setScreenRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />

          {/* Screen-share badge */}
          <div className="absolute top-3 left-3 z-30 bg-blue-600/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 text-xs text-white font-medium shadow-lg">
            <MonitorUp className="w-3 h-3" />
            Screen
          </div>

          {/* PiP camera bubble — bottom-right corner */}
          {isCameraEffectivelyOn && (
            <div className="absolute bottom-3 right-3 z-30 w-24 h-16 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl">
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{
                  transform:
                    participant.id === currentUser.id ? "scaleX(-1)" : "none",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Speaking ring (inset, never clipped by overflow-hidden parents) ── */}
      {/* ── Speaking ring disabled for now ── */}

      {/* ── Video / avatar area ── */}
      {isCameraEffectivelyOn ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={
            isLarge
              ? { backgroundColor: "black" }
              : {
                  background:
                    "linear-gradient(135deg, var(--mt-bg-tile-camera), var(--mt-bg-tile), var(--mt-bg-tile-alt2))",
                }
          }
        >
          <video
            ref={setVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full h-full",
              "object-cover"
            )}
            style={{
              transform:
                isSelf && isMirrorVideoEnabled ? "scaleX(-1)" : "none",
            }}
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--mt-bg-tile-alt), var(--mt-bg-tile), var(--mt-bg-tile-alt2))",
          }}
        >
          <div className="relative flex flex-col items-center gap-2">
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
            {/* Speaking animation disabled for now */}
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
        {/* Network quality + camera off indicators */}
        <div className="flex items-center gap-1 shrink-0">
          {!isCameraEffectivelyOn && (
            <VideoOff className="w-3.5 h-3.5 text-red-400 drop-shadow-md" />
          )}
          {participant.networkQuality === 'poor' && (
            <span title="Poor Connection"><SignalMedium className="w-3.5 h-3.5 text-yellow-400 drop-shadow-md" /></span>
          )}
          {participant.networkQuality === 'bad' && (
            <span title="Bad Connection"><SignalLow className="w-3.5 h-3.5 text-red-500 drop-shadow-md" /></span>
          )}
          {participant.networkQuality === 'good' && (
            <span title="Good Connection"><SignalHigh className="w-3.5 h-3.5 text-brand-green drop-shadow-md" /></span>
          )}
        </div>
      </div>

    </div>
  );
}