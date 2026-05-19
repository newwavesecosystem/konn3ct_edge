"use client";

import React, { useState, useRef, useEffect } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { useMeetingTheme, type MeetingTheme } from "@/lib/meeting-theme-context";
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

  return (
    <>
      <div
        className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 gap-3"
        style={{
          backgroundColor: "var(--mt-control-bar)",
          borderTop: "1px solid var(--mt-border)",
        }}
      >
        {/* ── Left: Meeting info ────────────────────── */}
        <div className="flex items-center gap-2.5 min-w-0 shrink">
          <span
            className="text-xs font-mono tabular-nums shrink-0"
            style={{ color: "var(--mt-text-muted)" }}
          >
            {formatDuration(meetingDuration)}
          </span>
          {isRecording && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-400/15 px-2 py-0.5 rounded-full shrink-0">
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
        </div>

        {/* ── Center: Controls pill ─────────────────── */}
        <div
          className="flex items-center gap-0.5 rounded-2xl px-1.5 py-1"
          style={{
            backgroundColor: "var(--mt-control-pill)",
            border: "1px solid var(--mt-border)",
          }}
        >
          {/* Mic */}
          <ControlBtn
            icon={isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            danger={isMuted}
            onClick={toggleMute}
            tooltip={isMuted ? "Unmute" : "Mute"}
          />
          {/* Camera */}
          <ControlBtn
            icon={isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            danger={!isCameraOn}
            onClick={toggleCamera}
            tooltip={isCameraOn ? "Camera off" : "Camera on"}
          />

          <PillDivider />

          {/* Screen share — desktop */}
          <ControlBtn
            icon={isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            active={isScreenSharing}
            onClick={toggleScreenShare}
            tooltip="Share screen"
            className="hidden sm:flex"
          />
          {/* React */}
          <ControlBtn
            icon={<SmilePlus className="w-5 h-5" />}
            active={showReactionPicker}
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            tooltip="React"
          />
          {/* Hand */}
          <ControlBtn
            icon={<Hand className="w-5 h-5" />}
            highlight={isHandRaised}
            onClick={toggleHandRaise}
            tooltip={isHandRaised ? "Lower hand" : "Raise hand"}
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
                className="absolute bottom-full mb-2 right-0 w-56 rounded-xl py-1.5 shadow-2xl z-50 overflow-hidden"
                style={{
                  backgroundColor: "var(--mt-dialog-bg)",
                  border: "1px solid var(--mt-border-strong)",
                }}
              >
                <MoreMenuItem
                  icon={<BarChart3 className="w-4 h-4" />}
                  label="Polls"
                  onClick={() => { setActivePanel("polls"); setShowMoreMenu(false); }}
                />
                <MoreMenuItem
                  icon={<FileText className="w-4 h-4" />}
                  label="Workspace"
                  onClick={() => { setActivePanel("docs"); setShowMoreMenu(false); }}
                />
                <MoreMenuItem
                  icon={<Film className="w-4 h-4" />}
                  label="eCinema Broadcast"
                  badge={eCinemaLink ? "Live" : undefined}
                  onClick={() => { setShowECinemaDialog(true); setShowMoreMenu(false); }}
                />
                <div className="my-1" style={{ borderTop: "1px solid var(--mt-border)" }} />
                <MoreMenuItem
                  icon={<Circle className={cn("w-4 h-4", isRecording && "fill-red-400 text-red-400")} />}
                  label={isRecording ? "Stop Recording" : "Record Meeting"}
                  danger={isRecording}
                  onClick={() => { toggleRecording(); setShowMoreMenu(false); }}
                />
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
            className="flex items-center gap-1.5 ml-1 px-3.5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25 active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">End</span>
          </button>
        </div>

        {/* ── Right: Panel toggles + Layout ─────────── */}
        <div className="flex items-center gap-1 shrink">
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

          <PanelBtn
            icon={<MessageSquare className="w-[18px] h-[18px]" />}
            active={activePanel === "chat"}
            onClick={() => setActivePanel("chat")}
            tooltip="Chat"
          />
          <PanelBtn
            icon={<Users className="w-[18px] h-[18px]" />}
            active={activePanel === "participants"}
            onClick={() => setActivePanel("participants")}
            tooltip="People"
          />
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
                value={selectedDevices.audioInput}
                onChange={(e) => switchDevice('audioInput', e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title="Select Microphone"
              >
                {devices.audioInputs.map((d) => (
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
                value={selectedDevices.videoInput}
                onChange={(e) => switchDevice('videoInput', e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title="Select Camera"
              >
                {devices.videoInputs.map((d) => (
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
          active={!!eCinemaLink}
          onClick={() => setShowECinemaDialog(true)}
          label="eCinema"
          icon={<Film className="w-5 h-5" />}
          className="hidden sm:flex"
        />

        <div className="w-px h-8 mx-1 hidden sm:block" style={{ backgroundColor: "var(--mt-border-strong)" }} />

        {/* Interaction controls */}
        {(currentUser.role === 'host' || currentUser.role === 'co-host') && (
          <ControlButton
            active={isDonationActive}
            onClick={() => toggleDonation()}
            label={isDonationActive ? "Stop Offering" : "Start Offering"}
            icon={<Gift className={cn("w-5 h-5", isDonationActive && "text-brand-green")} />}
          />
        )}

        {isDonationActive && (
          <ControlButton
            active={false}
            onClick={() => setShowDonationModal(true)}
            label="Donate"
            icon={<Gift className="w-5 h-5" />}
            highlight={true}
          />
        )}
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
        <div className="flex items-center">
          <ControlButton
            active={isCaptionsEnabled}
            onClick={toggleCaptions}
            label="Captions"
            icon={<Subtitles className="w-5 h-5" />}
          />
          {isCaptionsEnabled && (
            <div className="flex flex-col ml-1 gap-1">
              <select
                className="bg-transparent border border-[var(--mt-border-strong)] rounded-lg text-[10px] px-1 py-0.5 outline-none cursor-pointer hover:bg-[var(--mt-bg-hover)] transition-colors"
                style={{ color: "var(--mt-text)" }}
                value={captionLanguage}
                onChange={(e) => setCaptionLanguage(e.target.value)}
                title="Your Spoken Language"
              >
                <option value="en-US" className="bg-[#1a1a2e]">🗣️ English</option>
                <option value="fr-FR" className="bg-[#1a1a2e]">🗣️ French</option>
                <option value="es-ES" className="bg-[#1a1a2e]">🗣️ Spanish</option>
                <option value="yo-NG" className="bg-[#1a1a2e]">🗣️ Yoruba</option>
                <option value="ar-SA" className="bg-[#1a1a2e]">🗣️ Arabic</option>
                <option value="zh-CN" className="bg-[#1a1a2e]">🗣️ Chinese</option>
              </select>
              <select
                className="bg-transparent border border-[var(--mt-border-strong)] rounded-lg text-[10px] px-1 py-0.5 outline-none cursor-pointer hover:bg-[var(--mt-bg-hover)] transition-colors"
                style={{ color: "var(--mt-text)" }}
                value={translationLanguage}
                onChange={(e) => setTranslationLanguage(e.target.value)}
                title="Translate to"
              >
                <option value="original" className="bg-[#1a1a2e]">🌐 Original (No Translation)</option>
                <option value="en" className="bg-[#1a1a2e]">🌐 English</option>
                <option value="fr" className="bg-[#1a1a2e]">🌐 French</option>
                <option value="es" className="bg-[#1a1a2e]">🌐 Spanish</option>
                <option value="yo" className="bg-[#1a1a2e]">🌐 Yoruba</option>
                <option value="ar" className="bg-[#1a1a2e]">🌐 Arabic</option>
                <option value="zh" className="bg-[#1a1a2e]">🌐 Chinese</option>
              </select>
            </div>
          )}
        </div>

        <div className="w-px h-8 mx-1 hidden sm:block" style={{ backgroundColor: "var(--mt-border-strong)" }} />

        {/* Panel toggles */}
        <ControlButton
          active={activePanel === "ai"}
          onClick={() => setActivePanel("ai")}
          label="Konn3ct AI"
          icon={<Sparkles className="w-5 h-5 text-brand-green" />}
          highlight={activePanel === "ai"}
        />
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
            theme === "midnight" ? "Switch to Soft Light" :
              theme === "soft" ? "Switch to Slate" : "Switch to Midnight"
          }
          icon={
            theme === "midnight" ? <Moon className="w-5 h-5" /> :
              theme === "soft" ? <Sun className="w-5 h-5" /> :
                <Cloudy className="w-5 h-5" />
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
            theme === "soft" ? "rgba(255,255,255,0.90)" :
              theme === "slate" ? "rgba(11,43,30,0.90)" :
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
    </>
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

/* ── Control Button (center pill) ──────────────────── */
function ControlBtn({
  icon, danger, active, highlight, onClick, tooltip, className,
}: {
  icon: React.ReactNode; danger?: boolean; active?: boolean;
  highlight?: boolean; onClick: () => void; tooltip: string; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={cn(
        "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 active:scale-90",
        danger && "bg-red-500/20 text-red-400 hover:bg-red-500/30",
        highlight && "ring-2 ring-yellow-400/50",
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
      onMouseEnter={(e) => { if (!danger) e.currentTarget.style.backgroundColor = "var(--mt-bg-hover)"; }}
      onMouseLeave={(e) => { if (!danger) e.currentTarget.style.backgroundColor = active ? "var(--mt-bg-active)" : "transparent"; }}
    >
      {icon}
    </button>
  );
}

/* ── Panel toggle button (right zone) ──────────────── */
function PanelBtn({
  icon, active, onClick, tooltip,
}: {
  icon: React.ReactNode; active: boolean; onClick: () => void; tooltip: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={cn(
        "flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 active:scale-90",
      )}
      style={{
        backgroundColor: active ? "var(--mt-bg-active)" : "var(--mt-bg-control)",
        color: active ? "var(--mt-text)" : "var(--mt-text-muted)",
      }}
    >
      {icon}
    </button>
  );
}

/* ── Pill divider ──────────────────────────────────── */
function PillDivider() {
  return <div className="w-px h-6 mx-0.5 shrink-0" style={{ backgroundColor: "var(--mt-border-strong)" }} />;
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
