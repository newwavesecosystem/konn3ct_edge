"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import {
  Mic,
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
  className?: string;
}

const roleIcon: Record<string, React.ReactNode> = {
  host: <Crown className="w-3 h-3 text-yellow-400" />,
  "co-host": <Shield className="w-3 h-3 text-blue-400" />,
};

export function ParticipantTile({
  participant,
  isLarge = false,
  className,
}: ParticipantTileProps) {
  const { currentUser, selectedDevices, isMirrorVideoEnabled } = useMeeting();

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

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const applyAudioSink = async (el: HTMLAudioElement, sinkId: string) => {
    if (sinkId && typeof (el as any).setSinkId === "function") {
      try {
        await (el as any).setSinkId(sinkId);
      } catch (e) {
        console.warn("Failed to set audio output device:", e);
      }
    }
  };

  const setAudioRef = React.useCallback(
    (el: HTMLAudioElement | null) => {
      audioRef.current = el;
      if (el && participant.audioTrack) {
        if (el.srcObject) {
          const stream = el.srcObject as MediaStream;
          if (stream.getAudioTracks()[0] === participant.audioTrack) {
            applyAudioSink(el, selectedDevices.audioOutput);
            return;
          }
        }
        el.srcObject = new MediaStream([participant.audioTrack]);
        applyAudioSink(el, selectedDevices.audioOutput);
        el.play().catch((e) => console.warn("Audio play failed:", e));
      }
    },
    [participant.audioTrack, selectedDevices.audioOutput]
  );

  React.useEffect(() => {
    if (audioRef.current && selectedDevices.audioOutput) {
      applyAudioSink(audioRef.current, selectedDevices.audioOutput);
    }
  }, [selectedDevices.audioOutput]);

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden group transition-all duration-300",
        participant.isSpeaking && "ring-2 ring-brand-green ring-offset-2",
        "aspect-video",
        className
      )}
      style={{
        backgroundColor: "var(--mt-bg-tile)",
        ...(participant.isSpeaking
          ? ({ ringOffsetColor: "var(--mt-bg)" } as React.CSSProperties)
          : {}),
      }}
    >
      {/* ── Screen Share Overlay ──────────────────────────────────────────────
          Renders on TOP of the camera tile when screensharing is active.
          Camera feed stays alive underneath and shows as a PiP corner bubble.
      ──────────────────────────────────────────────────────────────────────── */}
      {participant.screenTrack && participant.isScreenSharing && (
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
          {participant.videoTrack && (
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

      {/* ── Normal Camera View ────────────────────────────────────────────── */}
      {participant.isCameraOn ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(to bottom right, var(--mt-bg-tile-camera), var(--mt-bg-tile), var(--mt-bg-tile-alt2))`,
          }}
        >
          {participant.videoTrack && !participant.isScreenSharing ? (
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{
                transform:
                  participant.id === currentUser.id && isMirrorVideoEnabled ? "scaleX(-1)" : "none",
              }}
            />
          ) : (
            <div className="relative flex flex-col items-center gap-2">
              <Avatar
                fallback={initials}
                alt={participant.name}
                className={cn(
                  "border-2",
                  isLarge ? "w-20 h-20 text-2xl" : "w-14 h-14 text-lg"
                )}
                style={
                  { borderColor: "var(--mt-border-strong)" } as React.CSSProperties
                }
              />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                {participant.isSpeaking && (
                  <div className="flex items-center gap-[2px]">
                    {[...Array(4)].map((_, i) => (
                      <span
                        key={i}
                        className="inline-block w-[3px] bg-brand-green rounded-full animate-pulse"
                        style={{
                          height: `${[12, 18, 10, 16][i]}px`,
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(to bottom right, var(--mt-bg-tile-alt), var(--mt-bg-tile), var(--mt-bg-tile-alt2))`,
          }}
        >
          <Avatar
            fallback={initials}
            alt={participant.name}
            className={cn(
              "border-2",
              isLarge ? "w-24 h-24 text-3xl" : "w-14 h-14 text-lg"
            )}
            style={
              { borderColor: "var(--mt-border-strong)" } as React.CSSProperties
            }
          />
        </div>
      )}

      {/* Connecting Overlay */}
      {participant.isConnecting && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          <span className="text-white text-[11px] font-medium tracking-wide animate-pulse">Connecting...</span>
        </div>
      )}

      {/* Hand raised indicator */}
      {participant.isHandRaised && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-yellow-500/90 backdrop-blur-sm rounded-full p-1.5 animate-bounce shadow-lg">
            <Hand className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Bottom overlay with name & status icons */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            {roleIcon[participant.role] && (
              <span className="shrink-0">{roleIcon[participant.role]}</span>
            )}
            <span className="text-white text-xs font-medium truncate">
              {participant.name}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {participant.isMuted ? (
              <MicOff className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-white/80" />
            )}
            {!participant.isCameraOn && (
              <VideoOff className="w-3.5 h-3.5 text-red-400" />
            )}
            {participant.networkQuality === 'poor' && (
              <SignalMedium className="w-3.5 h-3.5 text-yellow-400" title="Poor Connection" />
            )}
            {participant.networkQuality === 'bad' && (
              <SignalLow className="w-3.5 h-3.5 text-red-500" title="Bad Connection" />
            )}
            {participant.networkQuality === 'good' && (
              <SignalHigh className="w-3.5 h-3.5 text-brand-green" title="Good Connection" />
            )}
          </div>
        </div>
      </div>

      {/* Hidden audio element for remote participants */}
      {participant.audioTrack && participant.id !== currentUser.id && (
        <audio autoPlay playsInline ref={setAudioRef} />
      )}
    </div>
  );
}
