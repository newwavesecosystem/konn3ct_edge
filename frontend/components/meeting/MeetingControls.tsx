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
  Film,
  X,
  Play,
  ChevronUp,
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

  const [showECinemaDialog, setShowECinemaDialog] = React.useState(false);

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
          chevronNode={
            <div className="relative">
              <ChevronUp className="w-3 h-3 text-white/70 hover:text-white" />
              <select
                value={useMeeting().selectedDevices.audioInput}
                onChange={(e) => useMeeting().switchDevice('audioInput', e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title="Select Microphone"
              >
                {useMeeting().devices.audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Mic'}</option>
                ))}
              </select>
            </div>
          }
        />
        <ControlButton
          active={isCameraOn}
          danger={!isCameraOn}
          onClick={toggleCamera}
          label={isCameraOn ? "Camera off" : "Camera on"}
          icon={isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          chevronNode={
            <div className="relative">
              <ChevronUp className="w-3 h-3 text-white/70 hover:text-white" />
              <select
                value={useMeeting().selectedDevices.videoInput}
                onChange={(e) => useMeeting().switchDevice('videoInput', e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title="Select Camera"
              >
                {useMeeting().devices.videoInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Camera'}</option>
                ))}
              </select>
            </div>
          }
        />
        <ControlButton
          active={isScreenSharing}
          onClick={toggleScreenShare}
          label="Share screen"
          icon={isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
          className="hidden sm:flex"
        />

        {/* eCinema control */}
        <ControlButton
          active={!!useMeeting().eCinemaLink}
          onClick={() => setShowECinemaDialog(true)}
          label="eCinema"
          icon={<Film className="w-5 h-5" />}
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

      <ECinemaDialog 
        isOpen={showECinemaDialog} 
        onClose={() => setShowECinemaDialog(false)} 
      />
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
  chevronNode,
}: {
  active?: boolean;
  danger?: boolean;
  highlight?: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  className?: string;
  chevronNode?: React.ReactNode;
}) {
  return (
    <div className={cn("relative flex items-center rounded-xl transition-all duration-200", className)}
      style={
        !danger
          ? {
            backgroundColor: active ? "var(--mt-bg-active)" : "var(--mt-bg-control)",
            border: active ? "1px solid var(--mt-border-active)" : "1px solid var(--mt-border)",
            color: active ? "var(--mt-text)" : "var(--mt-text-muted)",
          }
          : undefined
      }>
      <button
        onClick={onClick}
        title={label}
        className={cn(
          "flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-l-xl transition-all duration-200 active:scale-90",
          danger
            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl border border-red-500/30"
            : "",
          highlight && "ring-2 ring-yellow-400/50",
          !chevronNode && "rounded-r-xl" // If no chevron, full rounded
        )}
      >
        {icon}
      </button>

      {/* Optional Chevron Split Button */}
      {chevronNode && (
        <div className="flex items-center justify-center w-4 h-full border-l border-white/10 hover:bg-white/10 rounded-r-xl cursor-pointer">
          {chevronNode}
        </div>
      )}
    </div>
  );
}

// ── eCinema Dialog ─────────────────────────────────────
function ECinemaDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { eCinemaLink, setECinemaLink } = useMeeting();
  const [linkInput, setLinkInput] = React.useState(eCinemaLink || "");

  React.useEffect(() => {
    if (isOpen) {
      setLinkInput(eCinemaLink || "");
    }
  }, [isOpen, eCinemaLink]);

  if (!isOpen) return null;

  const handleBroadcast = () => {
    if (linkInput.trim()) {
      setECinemaLink(linkInput.trim());
      onClose();
    }
  };

  const handleStop = () => {
    setECinemaLink(null);
    setLinkInput("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "var(--mt-overlay)" }}>
      <div 
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl" 
        style={{ backgroundColor: "var(--mt-bg-elevated)", border: "1px solid var(--mt-border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ color: "var(--mt-text)" }}>eCinema Broadcast</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--mt-text-faint)" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--mt-bg-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--mt-text)" }}>
            Add link
          </label>
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-2.5 rounded-xl text-sm"
            style={{
              backgroundColor: "var(--mt-bg)",
              color: "var(--mt-text)",
              border: "1px solid var(--mt-border)",
            }}
          />
          <p className="mt-2 text-xs" style={{ color: "var(--mt-text-faint)" }}>
            Paste a supported video link to broadcast it to all meeting participants.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          {eCinemaLink && (
            <button
              onClick={handleStop}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: "var(--mt-bg-control)", color: "var(--mt-text)" }}
            >
              Stop Broadcast
            </button>
          )}
          <button
            onClick={handleBroadcast}
            disabled={!linkInput.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-green text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-green/90"
          >
            <Play className="w-4 h-4 fill-current" />
            Broadcast
          </button>
        </div>
      </div>
    </div>
  );
}
