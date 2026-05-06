"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { StageView } from "./StageView";
import { MeetingControls } from "./MeetingControls";
import { ChatPanel } from "./ChatPanel";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { PollsPanel } from "./PollsPanel";
import { DocsPanel } from "./DocsPanel";
import { MeetingInfoPanel } from "./MeetingInfoPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ReactionsLayer } from "./ReactionsLayer";
import { LeaveDialog } from "./LeaveDialog";
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
    isRecording,
  } = useMeeting();

  const panelContent: Record<string, React.ReactNode> = {
    chat: <ChatPanel />,
    participants: <ParticipantsPanel />,
    polls: <PollsPanel />,
    docs: <DocsPanel />,
    info: <MeetingInfoPanel />,
    settings: <SettingsPanel />,
  };

  return (
    <div className="flex flex-col h-screen bg-[#0d0d1a] overflow-hidden">
      {/* Top bar — minimal */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 bg-[#0d0d1a] border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-green/20 flex items-center justify-center">
              <span className="text-brand-green font-bold text-xs">K</span>
            </div>
            <span className="text-sm font-semibold text-white truncate max-w-[120px] sm:max-w-[200px] lg:max-w-none">
              {meetingInfo.roomName}
            </span>
          </div>
          {isRecording && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
              <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
              Recording
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/30 hidden sm:block">
            {meetingInfo.roomType === "webinar" ? "Webinar" : "Meeting"} ·{" "}
            {meetingInfo.participantCount} participants
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Video stage */}
        <div className="flex-1 flex flex-col min-w-0">
          <StageView />
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
              className="hidden md:flex flex-col shrink-0 border-l border-white/5 bg-[#111128] overflow-hidden"
            >
              <div className="flex items-center justify-end p-2">
                <button
                  onClick={() => setActivePanel(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {panelContent[activePanel]}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile bottom sheet panel */}
      <AnimatePresence>
        {activePanel && isMobilePanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => {
                setIsMobilePanelOpen(false);
                setActivePanel(null);
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#111128] rounded-t-3xl border-t border-white/10 max-h-[75vh] flex flex-col"
            >
              {/* Handle bar */}
              <div className="flex items-center justify-center py-2">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              {/* Close */}
              <div className="flex items-center justify-end px-4">
                <button
                  onClick={() => {
                    setIsMobilePanelOpen(false);
                    setActivePanel(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
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

      {/* Meeting controls */}
      <MeetingControls />

      {/* Floating layers */}
      <ReactionsLayer />
      <LeaveDialog />
    </div>
  );
}
