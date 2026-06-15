"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { useSearchParams, useRouter } from "next/navigation";
import { StageView } from "./StageView";
import { MeetingControls } from "./MeetingControls";
import { ChatPanel } from "./ChatPanel";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { PollsPanel } from "./PollsPanel";
import { DocsPanel } from "./DocsPanel";
import { MeetingInfoPanel } from "./MeetingInfoPanel";
import { SettingsPanel } from "./SettingsPanel";
import { Konn3ctAIPanel } from "./panels/Konn3ctAIPanel";
import StreamingPanel from "./StreamingPanel";
import { ReactionsLayer } from "./ReactionsLayer";
import { LeaveDialog } from "./LeaveDialog";
import { MicIssueDialog } from "./MicIssueDialog";
import { CaptionsOverlay } from "./CaptionsOverlay";
import { QAPanel } from "./QAPanel";
import { SecurityPanel } from "./SecurityPanel";
import dynamic from "next/dynamic";

const DonationModal = dynamic(() => import("./DonationModal").then(mod => mod.DonationModal), { ssr: false });
import { motion, AnimatePresence } from "framer-motion";
import { X, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function MeetingShell() {
  const {
    activePanel,
    setActivePanel,
    isMobilePanelOpen,
    setIsMobilePanelOpen,
    meetingInfo,
    participants,
    isRecording,
    meetingDuration,
    webrtcStatus,
    showDonationModal,
    setShowDonationModal,
  } = useMeeting();

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const searchParams = useSearchParams();
  const router = useRouter();
  const isBot = searchParams?.get('bot') === 'true';

  const panelContent: Record<string, React.ReactNode> = {
    chat: <ChatPanel />,
    participants: <ParticipantsPanel />,
    polls: <PollsPanel />,
    docs: <DocsPanel />,
    info: <MeetingInfoPanel />,
    settings: <SettingsPanel />,
    ai: <Konn3ctAIPanel />,
    streaming: <StreamingPanel />,
    qa: <QAPanel />,
    security: <SecurityPanel />,
  };

  if (webrtcStatus === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ backgroundColor: "var(--mt-bg)", color: "var(--mt-text)" }}>
        <div className="p-8 rounded-2xl max-w-md w-full text-center" style={{ backgroundColor: "var(--mt-bg-elevated)", border: "1px solid var(--mt-border)" }}>
          <div className="w-16 h-16 rounded-full bg-brand-green/20 text-brand-green flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl font-bold">K</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Waiting for the host to let you in</h2>
          <p style={{ color: "var(--mt-text-faint)" }} className="mb-6">
            You will join the meeting automatically once the host admits you.
          </p>
          <div className="flex justify-center">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-brand-green animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-brand-green animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-brand-green animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (['denied', 'kicked', 'failed', 'ended', 'invalid-session'].includes(webrtcStatus)) {
    const errorDetails = {
      denied: { title: "Entry Denied", desc: "The host has declined your request to join this meeting." },
      kicked: { title: "Removed from Meeting", desc: "You have been removed from this meeting by the host." },
      failed: { title: "Connection Failed", desc: "We couldn't connect you to the meeting. Please try again." },
      ended:  { title: "Meeting Ended", desc: "The host has ended this meeting for everyone." },
      'invalid-session': { title: "Invalid Session", desc: "Your join session is invalid or expired. Please start over from the join page." },
    }[webrtcStatus as 'denied' | 'kicked' | 'failed' | 'ended' | 'invalid-session'];

    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ backgroundColor: "var(--mt-bg)", color: "var(--mt-text)" }}>
        <div className="p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl flex flex-col items-center" style={{ backgroundColor: "var(--mt-dialog-bg)", border: "1px solid var(--mt-border-strong)" }}>
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-5 ring-8 ring-red-500/5">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--mt-text)" }}>{errorDetails.title}</h2>
          <p className="text-sm mb-8" style={{ color: "var(--mt-text-muted)" }}>
            {errorDetails.desc}
          </p>
          <button
            onClick={() => {
              if (webrtcStatus === 'invalid-session') {
                const slug = window.location.pathname.split('/').pop();
                router.push(`/join/${slug}`);
              } else {
                router.push('/dashboard');
              }
            }}
            className="w-full px-5 py-3 rounded-xl bg-brand-green hover:bg-brand-green/90 text-white font-medium transition-all duration-200 active:scale-95 shadow-lg shadow-brand-green/20"
          >
            {webrtcStatus === 'invalid-session' ? 'Return to Join Page' : 'Return to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: "var(--mt-bg)", color: "var(--mt-text)" }}
    >
      {/* Top bar — minimal */}
      {!isBot && (
      <div
        className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2"
        style={{
          backgroundColor: "var(--mt-bg)",
          borderBottom: "1px solid var(--mt-border)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-green/20 flex items-center justify-center">
              <span className="text-brand-green font-bold text-xs">K</span>
            </div>
            <span
              className="text-sm font-semibold truncate max-w-[120px] sm:max-w-[200px] lg:max-w-none"
              style={{ color: "var(--mt-text)" }}
            >
              {meetingInfo.roomName}
            </span>
          </div>

          {/* Mobile-only timer badge — shown here to avoid overlap in bottom bar */}
          <span
            className="flex sm:hidden items-center gap-1.5 text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-full shrink-0"
            style={{
              color: "var(--mt-text-muted)",
              backgroundColor: "var(--mt-bg-control, rgba(255,255,255,0.06))",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
            {formatDuration(meetingDuration)}
          </span>
          {isRecording && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full shrink-0">
              <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
              <span className="hidden sm:inline">Recording</span>
              <span className="sm:hidden">Rec</span>
            </span>
          )}

          {/* WebRTC Connection Status Badge */}
          <div className={cn(
            "hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
            webrtcStatus === 'connected' ? "bg-brand-green/10 text-brand-green border-brand-green/20" :
              webrtcStatus === 'connecting' ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/20" :
                "bg-red-400/10 text-red-400 border-red-400/20"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              webrtcStatus === 'connected' ? "bg-brand-green" :
                webrtcStatus === 'connecting' ? "bg-yellow-400 animate-pulse" :
                  "bg-red-400"
            )} />
            {webrtcStatus === 'connected' ? 'Connected' :
              webrtcStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </div>

        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-[11px] hidden sm:block"
            style={{ color: "var(--mt-text-faint)" }}
          >
            {meetingInfo.roomType === "webinar" ? "Webinar" : "Meeting"} ·{" "}
            {participants.filter(p => p.role !== 'bot').length} participants
          </span>
        </div>
      </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Video stage */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <StageView />
          <CaptionsOverlay />
        </div>

        {/* Desktop side panel */}
        <AnimatePresence mode="wait">
          {activePanel && (
            <motion.div
              key={activePanel}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="hidden md:flex flex-col shrink-0 overflow-hidden"
              style={{
                backgroundColor: "var(--mt-bg-elevated)",
                borderLeft: "1px solid var(--mt-border)",
              }}
            >
              {!isBot && (
              <div className="flex items-center justify-end p-2">
                <button
                  onClick={() => setActivePanel(null)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--mt-text-faint)" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--mt-bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              )}
              <div className="flex-1 overflow-hidden">
                {panelContent[activePanel]}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile bottom sheet panel */}
      {!isBot && (
      <AnimatePresence>
        {activePanel && isMobilePanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ backgroundColor: "var(--mt-overlay)" }}
              onClick={() => {
                setIsMobilePanelOpen(false);
                setActivePanel(null);
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring" as const, damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-3xl max-h-[75vh] flex flex-col"
              style={{
                backgroundColor: "var(--mt-bg-elevated)",
                borderTop: "1px solid var(--mt-border-strong)",
              }}
            >
              {/* Handle bar */}
              <div className="flex items-center justify-center py-2">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: "var(--mt-text-ghost)" }}
                />
              </div>
              {/* Close */}
              <div className="flex items-center justify-end px-4">
                <button
                  onClick={() => {
                    setIsMobilePanelOpen(false);
                    setActivePanel(null);
                  }}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--mt-text-faint)" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--mt-bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Panel content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {panelContent[activePanel]}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      )}

      {/* Meeting controls */}
      {!isBot && <MeetingControls />}

      {/* Floating layers */}
      <ReactionsLayer />
      <LeaveDialog />
      <MicIssueDialog />
      {showDonationModal && <DonationModal onClose={() => setShowDonationModal(false)} />}
    </div>
  );
}
