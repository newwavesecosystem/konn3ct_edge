"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { useMeetingTheme } from "@/lib/meeting-theme-context";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  Users,
  BarChart3,
  FileText,
  Hand,
  SmilePlus,
  Settings,
  Info,
  LogOut,
  Circle,
  LayoutGrid,
  Presentation,
  Focus,
  Sun,
  Moon,
  Leaf,
} from "lucide-react";

export function MeetingControls() {
  const {
    isMuted,
    isCameraOn,
    isScreenSharing,
    isRecording,
    isHandRaised,
    activePanel,
    layoutMode,
    meetingDuration,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
    toggleHandRaise,
    setActivePanel,
    setLayoutMode,
    setShowLeaveDialog,
    setShowReactionPicker,
    showReactionPicker,
  } = useMeeting();

  const { theme, toggleTheme } = useMeetingTheme();

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const layoutModes: { mode: typeof layoutMode; icon: React.ReactNode; label: string }[] = [
    { mode: "speaker", icon: <Presentation className="w-4 h-4" />, label: "Speaker" },
    { mode: "grid", icon: <LayoutGrid className="w-4 h-4" />, label: "Grid" },
    { mode: "spotlight", icon: <Focus className="w-4 h-4" />, label: "Spotlight" },
  ];

  return (
    <div
      className="relative shrink-0"
      style={{
        backgroundColor: "var(--mt-bg)",
        borderTop: "1px solid var(--mt-border)",
      }}
    >
      {/* Duration bar */}
      <div className="flex items-center justify-center py-1">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--mt-text-muted)" }}>
          {isRecording && (
            <span className="flex items-center gap-1 text-red-400">
              <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
              REC
            </span>
          )}
          <span className="font-mono">{formatDuration(meetingDuration)}</span>
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 pb-3 flex-wrap">
        {/* Media controls */}
        <ControlButton
          active={!isMuted}
          danger={isMuted}
          onClick={toggleMute}
          label={isMuted ? "Unmute" : "Mute"}
          icon={isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        />
        <ControlButton
          active={isCameraOn}
          danger={!isCameraOn}
          onClick={toggleCamera}
          label={isCameraOn ? "Camera off" : "Camera on"}
          icon={isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        />
        <ControlButton
          active={isScreenSharing}
          onClick={toggleScreenShare}
          label="Share screen"
          icon={isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
          className="hidden sm:flex"
        />

        <div className="w-px h-8 mx-1 hidden sm:block" style={{ backgroundColor: "var(--mt-border-strong)" }} />

        {/* Interaction controls */}
        <ControlButton
          active={isHandRaised}
          onClick={toggleHandRaise}
          label="Raise hand"
          icon={<Hand className="w-5 h-5" />}
          highlight={isHandRaised}
        />
        <ControlButton
          active={showReactionPicker}
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          label="React"
          icon={<SmilePlus className="w-5 h-5" />}
        />

        <div className="w-px h-8 mx-1 hidden sm:block" style={{ backgroundColor: "var(--mt-border-strong)" }} />

        {/* Panel toggles */}
        <ControlButton
          active={activePanel === "chat"}
          onClick={() => setActivePanel("chat")}
          label="Chat"
          icon={<MessageSquare className="w-5 h-5" />}
        />
        <ControlButton
          active={activePanel === "participants"}
          onClick={() => setActivePanel("participants")}
          label="People"
          icon={<Users className="w-5 h-5" />}
        />
        <ControlButton
          active={activePanel === "polls"}
          onClick={() => setActivePanel("polls")}
          label="Polls"
          icon={<BarChart3 className="w-5 h-5" />}
          className="hidden sm:flex"
        />
        <ControlButton
          active={activePanel === "docs"}
          onClick={() => setActivePanel("docs")}
          label="Docs"
          icon={<FileText className="w-5 h-5" />}
          className="hidden sm:flex"
        />
        <ControlButton
          active={activePanel === "info"}
          onClick={() => setActivePanel("info")}
          label="Info"
          icon={<Info className="w-5 h-5" />}
          className="hidden lg:flex"
        />
        <ControlButton
          active={activePanel === "settings"}
          onClick={() => setActivePanel("settings")}
          label="Settings"
          icon={<Settings className="w-5 h-5" />}
          className="hidden lg:flex"
        />

        <div className="w-px h-8 mx-1 hidden sm:block" style={{ backgroundColor: "var(--mt-border-strong)" }} />

        {/* Theme cycle */}
        <ControlButton
          active={false}
          onClick={toggleTheme}
          label={
            theme === "emerald" ? "Switch to Konn3ct" :
            theme === "konn3ct" ? "Switch to Dark" : "Switch to Emerald"
          }
          icon={
            theme === "emerald" ? <Sun className="w-5 h-5" /> :
            theme === "konn3ct" ? <Moon className="w-5 h-5" /> :
            <Leaf className="w-5 h-5" />
          }
          className="hidden sm:flex"
        />

        {/* Recording */}
        <ControlButton
          active={isRecording}
          danger={isRecording}
          onClick={toggleRecording}
          label={isRecording ? "Stop recording" : "Record"}
          icon={<Circle className={cn("w-5 h-5", isRecording && "fill-red-400 text-red-400")} />}
          className="hidden sm:flex"
        />

        {/* Leave */}
        <button
          onClick={() => setShowLeaveDialog(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20 active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>

      {/* Layout switcher — small strip above controls on desktop */}
      <div
        className="hidden md:flex items-center justify-center gap-1 absolute -top-9 left-1/2 -translate-x-1/2 backdrop-blur-sm rounded-full px-1 py-1"
        style={{
          backgroundColor:
            theme === "konn3ct" ? "rgba(255,255,255,0.90)" :
            theme === "emerald" ? "rgba(11,43,30,0.90)" :
            "rgba(26,26,46,0.90)",
          border: "1px solid var(--mt-border)",
        }}
      >
        {layoutModes.map((l) => (
          <button
            key={l.mode}
            onClick={() => setLayoutMode(l.mode)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
              layoutMode === l.mode
                ? "bg-brand-green text-white"
                : ""
            )}
            style={layoutMode !== l.mode ? { color: "var(--mt-text-muted)" } : undefined}
            title={l.label}
          >
            {l.icon}
            <span>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Control Button ─────────────────────────────────────
function ControlButton({
  active,
  danger,
  highlight,
  onClick,
  label,
  icon,
  className,
}: {
  active?: boolean;
  danger?: boolean;
  highlight?: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all duration-200 active:scale-90",
        danger
          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
          : "",
        highlight && "ring-2 ring-yellow-400/50",
        className
      )}
      style={
        !danger
          ? {
              backgroundColor: active ? "var(--mt-bg-active)" : "var(--mt-bg-control)",
              color: active ? "var(--mt-text)" : "var(--mt-text-muted)",
            }
          : undefined
      }
    >
      {icon}
    </button>
  );
}
