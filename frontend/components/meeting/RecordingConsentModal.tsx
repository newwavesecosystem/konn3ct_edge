"use client";

import React, { useEffect, useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

export function RecordingConsentModal() {
  const { isRecording, currentUser, leaveMeeting, logoutUrl, meetingInfo } = useMeeting();
  const router = useRouter();
  
  const [showModal, setShowModal] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  useEffect(() => {
    // If recording stops, reset consent so it can trigger again if restarted
    if (!isRecording) {
      setHasConsented(false);
      setShowModal(false);
      return;
    }

    // Host implicitly consents by starting it. Bot doesn't need to consent.
    if (currentUser.role === 'host' || currentUser.role === 'co-host' || currentUser.role === 'bot') {
      setHasConsented(true);
      return;
    }

    if (isRecording && !hasConsented) {
      setShowModal(true);
    }
  }, [isRecording, currentUser.role, hasConsented]);

  const handleConsent = () => {
    setHasConsented(true);
    setShowModal(false);
  };

  const handleLeave = () => {
    leaveMeeting();
    setShowModal(false);
    
    // Route to post-meeting page
    const params = new URLSearchParams();
    if (currentUser.role) params.set("role", currentUser.role);
    if (logoutUrl) params.set("logoutUrl", logoutUrl);
    
    router.push(`/post-meeting/${meetingInfo.roomSlug}?${params.toString()}`);
  };

  return (
    <AnimatePresence>
      {showModal && (
        <>
          {/* Backdrop - higher z-index to block interactions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] backdrop-blur-md"
            style={{ backgroundColor: "var(--mt-overlay)" }}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring" as const, damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
              style={{
                backgroundColor: "var(--mt-dialog-bg)",
                border: "1px solid var(--mt-border-strong)",
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-2xl bg-blue-500/10">
                  <ShieldAlert className="w-6 h-6 text-blue-400" />
                </div>
              </div>

              <h3 className="text-lg font-bold mb-1" style={{ color: "var(--mt-text)" }}>
                This meeting is being recorded
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--mt-text-muted)" }}>
                By continuing to participate in this meeting, you consent to being recorded.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleConsent}
                  className="w-full px-4 py-3 rounded-xl bg-blue-500/90 hover:bg-blue-500 text-white font-medium text-sm transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98]"
                >
                  Got it
                </button>
                <button
                  onClick={handleLeave}
                  className="w-full px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium text-sm transition-all duration-200 active:scale-[0.98]"
                >
                  Leave Meeting
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
