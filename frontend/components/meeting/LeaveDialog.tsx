"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function LeaveDialog() {
  const { currentUser, showLeaveDialog, setShowLeaveDialog, endMeetingForAll, leaveMeeting, logoutUrl, meetingInfo } = useMeeting();
  const router = useRouter();

  const navigateAway = () => {
    const params = new URLSearchParams();
    if (currentUser.role) params.set("role", currentUser.role);
    if (logoutUrl) params.set("logoutUrl", logoutUrl);
    
    router.push(`/post-meeting/${meetingInfo.roomSlug}?${params.toString()}`);
  };

  const handleLeave = () => {
    leaveMeeting();
    setShowLeaveDialog(false);
    navigateAway();
  };

  const handleEndForAll = () => {
    endMeetingForAll();
    setShowLeaveDialog(false);
    navigateAway();
  };

  const isHost = currentUser.role === 'host' || currentUser.role === 'co-host';

  return (
    <AnimatePresence>
      {showLeaveDialog && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] backdrop-blur-sm"
            style={{ backgroundColor: "var(--mt-overlay)" }}
            onClick={() => setShowLeaveDialog(false)}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring" as const, damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
              style={{
                backgroundColor: "var(--mt-dialog-bg)",
                border: "1px solid var(--mt-border-strong)",
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-2xl bg-red-500/10">
                  <LogOut className="w-6 h-6 text-red-400" />
                </div>
                <button
                  onClick={() => setShowLeaveDialog(false)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: "var(--mt-text-faint)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-lg font-bold mb-1" style={{ color: "var(--mt-text)" }}>
                Leave meeting?
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--mt-text-muted)" }}>
                Are you sure you want to leave this meeting? You can rejoin anytime using the meeting link.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleLeave}
                  className="w-full px-4 py-3 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-medium text-sm transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.98]"
                >
                  Leave Meeting
                </button>
                {isHost && (
                  <button
                    onClick={handleEndForAll}
                    className="w-full px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium text-sm transition-all duration-200 active:scale-[0.98]"
                  >
                    End Meeting for All
                  </button>
                )}
                <button
                  onClick={() => setShowLeaveDialog(false)}
                  className="w-full px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--mt-bg-control)",
                    color: "var(--mt-text-muted)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
