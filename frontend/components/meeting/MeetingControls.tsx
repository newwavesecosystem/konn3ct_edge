"use client";

import React, { useState, useRef, useEffect } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { useMeetingTheme, type MeetingTheme } from "@/lib/meeting-theme-context";
import { toast } from "sonner";
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
  Radio,
  Presentation,
  Sparkles,
  Focus,
  Sun,
  Moon,
  Leaf,
  Film,
  X,
  Play,
  ChevronUp,
  Subtitles,
  Gift,
  MoreVertical,
  Cloudy,
  PhoneOff,
  HelpCircle,
  Shield,
} from "lucide-react";

export function MeetingControls() {
  const {
    isMuted,
    isCameraOn,
    isScreenSharing,
    isRecording,
    recordingStatus,
    isHandRaised,
    activePanel,
    layoutMode,
    meetingDuration,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
    toggleHandRaise,
    isCaptionsEnabled,
    toggleCaptions,
    captionLanguage,
    setCaptionLanguage,
    translationLanguage,
    setTranslationLanguage,
    setActivePanel,
    setLayoutMode,
    setShowLeaveDialog,
    setShowReactionPicker,
    showReactionPicker,
    isDonationActive,
    toggleDonation,
    setShowDonationModal,
    currentUser,
    selectedDevices,
    devices,
    switchDevice,
    meetingInfo,
    eCinemaLink,
    hasUnreadChat,
    roomSettings,
  } = useMeeting();

  const { theme, toggleTheme } = useMeetingTheme();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showECinemaDialog, setShowECinemaDialog] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const layoutModes: { mode: typeof layoutMode; icon: React.ReactNode; label: string }[] = [
    { mode: "speaker", icon: <Presentation className="w-3.5 h-3.5" />, label: "Speaker" },
    { mode: "grid", icon: <LayoutGrid className="w-3.5 h-3.5" />, label: "Grid" },
    { mode: "spotlight", icon: <Focus className="w-3.5 h-3.5" />, label: "Spotlight" },
  ];

  const themeIcon =
    theme === "midnight" ? <Moon className="w-4 h-4" /> :
    theme === "soft" ? <Sun className="w-4 h-4" /> :
    <Cloudy className="w-4 h-4" />;

  const themeLabel =
    theme === "midnight" ? "Midnight" :
    theme === "soft" ? "Soft Light" : "Slate";

  const isHost = currentUser.role === 'host' || currentUser.role === 'co-host';

  return (
    <>
      <div
        className="shrink-0 flex items-center justify-center sm:justify-between px-2 sm:px-4 py-1.5 sm:py-2 gap-1.5 sm:gap-3"
        style={{
          backgroundColor: "var(--mt-control-bar)",
          borderTop: "1px solid var(--mt-border)",
        }}
      >
        {/* ── Left: Meeting info + quick toggles (hidden on mobile — timer is in top bar) ── */}
        <div className="hidden sm:flex items-center gap-2.5 min-w-0 shrink">
          <span
            className="text-xs font-mono tabular-nums shrink-0"
            style={{ color: "var(--mt-text-muted)" }}
          >
            {formatDuration(meetingDuration)}
          </span>
          {isRecording && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-400/15 px-2 py-0.5 rounded-full shrink-0">
              <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
              REC
            </span>
          )}
          <span
            className="hidden lg:block text-[11px] truncate max-w-[160px]"
            style={{ color: "var(--mt-text-faint)" }}
          >
            {meetingInfo.roomName}
          </span>

          <ControlBtn
            icon={<Subtitles className="w-5 h-5" />}
            active={isCaptionsEnabled}
            onClick={toggleCaptions}
            tooltip={isCaptionsEnabled ? "Disable Captions" : "Enable Captions"}
          />

          {isDonationActive && (
            <ControlBtn
              icon={<Gift className="w-5 h-5" />}
              highlight
              onClick={() => setShowDonationModal(true)}
              tooltip="Donate"
            />
          )}
        </div>

        {/* ── Center: Controls pill ─────────────────── */}
        <div
          className="flex items-center gap-0.5 rounded-2xl px-1 sm:px-1.5 py-1"
          style={{
            backgroundColor: "var(--mt-control-pill)",
            border: "1px solid var(--mt-border)",
          }}
        >
          {/* Mic */}
          <ControlBtn
            icon={isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            danger={isMuted}
            disabled={roomSettings.micLocked && !isHost}
            onClick={() => {
              if (roomSettings.micLocked && !isHost) {
                toast.error("Microphones are locked by the host.");
                return;
              }
              toggleMute();
            }}
            tooltip={isMuted ? "Unmute" : "Mute"}
            className={(!isMuted && currentUser.isSpeaking) ? "shadow-[0_0_12px_rgba(34,197,94,0.6)] ring-2 ring-brand-green/50 bg-brand-green/10 text-brand-green transition-all duration-75" : ""}
          />
          {/* Camera */}
          <ControlBtn
            icon={isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            danger={!isCameraOn}
            disabled={roomSettings.videoLocked && !isHost}
            onClick={() => {
              if (roomSettings.videoLocked && !isHost) {
                toast.error("Cameras are locked by the host.");
                return;
              }
              toggleCamera();
            }}
            tooltip={isCameraOn ? "Camera off" : "Camera on"}
          />

          <PillDivider className="hidden sm:block" />

          {/* Screen share */}
          <ControlBtn
            icon={isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            active={isScreenSharing}
            onClick={() => {
              if (currentUser.isMobile) {
                toast.error("Screen sharing is not supported on mobile. Please join with a PC to share your screen.");
                return;
              }
              toggleScreenShare();
            }}
            tooltip="Share screen"
            className="hidden sm:flex"
          />
          {/* React */}
          <ControlBtn
            icon={<SmilePlus className="w-5 h-5" />}
            active={showReactionPicker}
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            tooltip="React"
            className="hidden sm:flex"
          />
          {/* Hand */}
          <ControlBtn
            icon={<Hand className="w-5 h-5" />}
            highlight={isHandRaised}
            onClick={toggleHandRaise}
            tooltip={isHandRaised ? "Lower hand" : "Raise hand"}
            className="hidden sm:flex"
          />

          <PillDivider />

          {/* More menu */}
          <div ref={moreRef} className="relative">
            <ControlBtn
              icon={<MoreVertical className="w-5 h-5" />}
              active={showMoreMenu}
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              tooltip="More"
            />
            {showMoreMenu && (
              <div
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-0 w-56 rounded-xl py-1.5 shadow-2xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto"
                style={{
                  backgroundColor: "var(--mt-dialog-bg)",
                  border: "1px solid var(--mt-border-strong)",
                }}
              >
                {/* Mobile-only actions (hidden on desktop where they have dedicated buttons) */}
                <div className="sm:hidden">
                  <MoreMenuItem
                    icon={<SmilePlus className="w-4 h-4" />}
                    label="React"
                    onClick={() => { setShowReactionPicker(!showReactionPicker); setShowMoreMenu(false); }}
                  />
                  <MoreMenuItem
                    icon={<Hand className="w-4 h-4" />}
                    label={isHandRaised ? "Lower Hand" : "Raise Hand"}
                    onClick={() => { toggleHandRaise(); setShowMoreMenu(false); }}
                  />
                  <MoreMenuItem
                    icon={isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <MonitorUp className="w-4 h-4" />}
                    label={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                    onClick={() => { toggleScreenShare(); setShowMoreMenu(false); }}
                  />
                  <MoreMenuItem
                    icon={<Subtitles className="w-4 h-4" />}
                    label={isCaptionsEnabled ? "Disable Captions" : "Enable Captions"}
                    onClick={() => { toggleCaptions(); setShowMoreMenu(false); }}
                  />
                  {isHost && (
                    <MoreMenuItem
                      icon={<Gift className="w-4 h-4" />}
                      label={isDonationActive ? "Stop Donation" : "Start Donation"}
                      onClick={() => { toggleDonation(); setShowMoreMenu(false); }}
                    />
                  )}
                  {isDonationActive && (
                    <MoreMenuItem
                      icon={<Gift className="w-4 h-4" />}
                      label="Donate"
                      onClick={() => { setShowDonationModal(true); setShowMoreMenu(false); }}
                    />
                  )}
                  <div className="my-1" style={{ borderTop: "1px solid var(--mt-border)" }} />
                </div>

                <MoreMenuItem
                  icon={<BarChart3 className="w-4 h-4" />}
                  label="Polls"
                  onClick={() => { setActivePanel("polls"); setShowMoreMenu(false); }}
                />
                {/* 
                <MoreMenuItem
                  icon={<FileText className="w-4 h-4" />}
                  label="Workspace"
                  onClick={() => { setActivePanel("docs"); setShowMoreMenu(false); }}
                /> 
                */}
                {isHost && (
                  <MoreMenuItem
                    icon={<Film className="w-4 h-4" />}
                    label="eCinema Broadcast"
                    badge={eCinemaLink ? "Live" : undefined}
                    onClick={() => { setShowECinemaDialog(true); setShowMoreMenu(false); }}
                  />
                )}
                {/* {isHost && (
                  <MoreMenuItem
                    icon={<Radio className="w-4 h-4" />}
                    label="Live Streaming"
                    onClick={() => { setActivePanel("streaming"); setShowMoreMenu(false); }}
                  />
                )} */}
                <div className="my-1" style={{ borderTop: "1px solid var(--mt-border)" }} />
                {isHost && (
                  <MoreMenuItem
                    icon={<Circle className={cn("w-4 h-4", (recordingStatus === 'recording' || recordingStatus === 'starting' || recordingStatus === 'processing') && "fill-red-400 text-red-400")} />}
                    label={
                      recordingStatus === 'starting' ? "Starting recording..." :
                      recordingStatus === 'recording' ? "Stop Recording" :
                      recordingStatus === 'processing' ? "Processing recording..." :
                      "Record Meeting"
                    }
                    danger={recordingStatus === 'recording'}
                    onClick={() => { toggleRecording(); setShowMoreMenu(false); }}
                  />
                )}
                {/* Desktop-only: captions & donation already shown above on mobile */}
                <div className="hidden sm:block">
                  <MoreMenuItem
                    icon={<Subtitles className="w-4 h-4" />}
                    label={isCaptionsEnabled ? "Disable Captions" : "Enable Captions"}
                    onClick={() => { toggleCaptions(); setShowMoreMenu(false); }}
                  />
                  {isHost && (
                    <MoreMenuItem
                      icon={<Gift className="w-4 h-4" />}
                      label={isDonationActive ? "Stop Donation" : "Start Donation"}
                      onClick={() => { toggleDonation(); setShowMoreMenu(false); }}
                    />
                  )}
                </div>
                <div className="my-1" style={{ borderTop: "1px solid var(--mt-border)" }} />
                <MoreMenuItem
                  icon={<Info className="w-4 h-4" />}
                  label="Meeting Info"
                  onClick={() => { setActivePanel("info"); setShowMoreMenu(false); }}
                />
                <MoreMenuItem
                  icon={<Settings className="w-4 h-4" />}
                  label="Settings"
                  onClick={() => { setActivePanel("settings"); setShowMoreMenu(false); }}
                />
                <MoreMenuItem
                  icon={themeIcon}
                  label={`Theme: ${themeLabel}`}
                  onClick={() => { toggleTheme(); }}
                />
              </div>
            )}
          </div>

          {/* End call pill */}
          <button
            onClick={() => setShowLeaveDialog(true)}
            className="flex items-center gap-1.5 ml-0.5 sm:ml-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25 active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">End</span>
          </button>
        </div>

        {/* ── Right: Panel toggles + Layout ─────────── */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {/* Layout switcher — desktop */}
          <div
            className="hidden md:flex items-center gap-0.5 rounded-xl px-1 py-1 mr-1"
            style={{ backgroundColor: "var(--mt-bg-control)" }}
          >
            {layoutModes.map((l) => (
              <button
                key={l.mode}
                onClick={() => setLayoutMode(l.mode)}
                className={cn(
                  "p-1.5 rounded-lg transition-all duration-200",
                  layoutMode === l.mode ? "bg-brand-green text-white" : ""
                )}
                style={layoutMode !== l.mode ? { color: "var(--mt-text-faint)" } : undefined}
                title={l.label}
              >
                {l.icon}
              </button>
            ))}
          </div>

          {/* Konn3ct AI panel toggle */}
          <PanelBtn
            icon={<Sparkles className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-brand-green" />}
            active={activePanel === "ai"}
            onClick={() => setActivePanel("ai")}
            tooltip="Konn3ct AI"
          />
          <PanelBtn
            icon={<MessageSquare className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
            active={activePanel === "chat"}
            onClick={() => setActivePanel("chat")}
            tooltip="Chat"
            hasNotification={hasUnreadChat}
          />
          {meetingInfo.roomType === "webinar" && (
            <PanelBtn
              icon={<HelpCircle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
              active={activePanel === "qa"}
              onClick={() => setActivePanel("qa")}
              tooltip="Q&A"
            />
          )}
          <PanelBtn
            icon={<Users className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
            active={activePanel === "participants"}
            onClick={() => setActivePanel("participants")}
            tooltip="People"
          />
          {isHost && (
            <PanelBtn
              icon={<Shield className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
              active={activePanel === "security"}
              onClick={() => setActivePanel("security")}
              tooltip="Security"
            />
          )}
        </div>
      </div>

      <ECinemaDialog isOpen={showECinemaDialog} onClose={() => setShowECinemaDialog(false)} />
    </>
  );
}

/* ── Control Button (center pill) ──────────────────── */
function ControlBtn({
  icon, danger, active, highlight, onClick, tooltip, className, disabled
}: {
  icon: React.ReactNode; danger?: boolean; active?: boolean;
  highlight?: boolean; onClick: () => void; tooltip: string; className?: string; disabled?: boolean;
}) {
  // Derive a stable data-testid from the tooltip text (lowercase, hyphened)
  const testId = `ctrl-${tooltip.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <button
      onClick={onClick}
      title={tooltip}
      data-testid={testId}
      className={cn(
        "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 active:scale-90",
        danger && !disabled && "bg-red-500/20 text-red-400 hover:bg-red-500/30",
        highlight && !disabled && "ring-2 ring-yellow-400/50",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={
        !danger
          ? {
              backgroundColor: active ? "var(--mt-bg-active)" : "transparent",
              color: active ? "var(--mt-text)" : "var(--mt-text-muted)",
            }
          : undefined
      }
      onMouseEnter={(e) => { if (!danger && !disabled) e.currentTarget.style.backgroundColor = "var(--mt-bg-hover)"; }}
      onMouseLeave={(e) => { if (!danger && !disabled) e.currentTarget.style.backgroundColor = active ? "var(--mt-bg-active)" : "transparent"; }}
    >
      {icon}
    </button>
  );
}

/* ── Panel toggle button (right zone) ──────────────── */
function PanelBtn({
  icon, active, onClick, tooltip, hasNotification
}: {
  icon: React.ReactNode; active: boolean; onClick: () => void; tooltip: string; hasNotification?: boolean;
}) {
  const testId = `panel-${tooltip.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <button
      onClick={onClick}
      title={tooltip}
      data-testid={testId}
      className={cn(
        "relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl transition-all duration-200 active:scale-90",
      )}
      style={{
        backgroundColor: active ? "var(--mt-bg-active)" : "var(--mt-bg-control)",
        color: active ? "var(--mt-text)" : "var(--mt-text-muted)",
      }}
    >
      {icon}
      {hasNotification && (
        <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      )}
    </button>
  );
}

/* ── Pill divider ──────────────────────────────── */
function PillDivider({ className }: { className?: string }) {
  return <div className={cn("w-px h-6 mx-0.5 shrink-0", className)} style={{ backgroundColor: "var(--mt-border-strong)" }} />;
}

/* ── More menu item ────────────────────────────────── */
function MoreMenuItem({
  icon, label, onClick, danger, badge,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors text-left"
      style={{ color: danger ? "#f87171" : "var(--mt-text-secondary)" }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--mt-bg-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
    >
      <span className="shrink-0" style={{ color: danger ? "#f87171" : "var(--mt-text-faint)" }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ── eCinema Dialog ────────────────────────────────── */
function ECinemaDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { eCinemaLink, broadcastECinema } = useMeeting();
  const [linkInput, setLinkInput] = React.useState(eCinemaLink || "");

  React.useEffect(() => {
    if (isOpen) setLinkInput(eCinemaLink || "");
  }, [isOpen, eCinemaLink]);

  if (!isOpen) return null;

  const handleBroadcast = () => {
    if (linkInput.trim()) {
      broadcastECinema(linkInput.trim());
      onClose();
    }
  };

  const handleStop = () => {
    broadcastECinema(null);
    setLinkInput("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "var(--mt-overlay)" }}>
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: "var(--mt-dialog-bg)", border: "1px solid var(--mt-border-strong)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--mt-text)" }}>eCinema Broadcast</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--mt-text-faint)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--mt-text)" }}>Video link</label>
          <input
            type="text" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ backgroundColor: "var(--mt-bg-input)", color: "var(--mt-text)", border: "1px solid var(--mt-border)" }}
          />
          <p className="mt-2 text-xs" style={{ color: "var(--mt-text-faint)" }}>
            Paste a YouTube or video link to broadcast to all participants.
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
            onClick={handleBroadcast} disabled={!linkInput.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-green text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-green/90"
          >
            <Play className="w-4 h-4 fill-current" /> Broadcast
          </button>
        </div>
      </div>
    </div>
  );
}
