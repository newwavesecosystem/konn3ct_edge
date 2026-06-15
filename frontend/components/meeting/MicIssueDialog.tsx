"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { AlertCircle } from "lucide-react";

export function MicIssueDialog() {
  const { micError, setMicError, toggleMute } = useMeeting();

  if (!micError) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="max-w-sm w-full p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200"
        style={{ backgroundColor: "var(--mt-dialog-bg)", border: "1px solid var(--mt-border-strong)" }}
      >
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        
        <h3 className="text-xl font-bold mb-2" style={{ color: "var(--mt-text)" }}>Microphone Issue</h3>
        <p className="text-sm mb-6" style={{ color: "var(--mt-text-alt)" }}>
          We couldn't access your microphone. Please check your browser permissions, ensure it's plugged in, and not being used by another application.
          <br /><br />
          <span className="text-xs opacity-75 break-words block text-red-400 font-mono">
            {micError.name}: {micError.message}
          </span>
        </p>

        <div className="flex gap-3 w-full">
          <button
            onClick={() => setMicError(null)}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--mt-bg-tile)", color: "var(--mt-text)" }}
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              setMicError(null);
              // Attempt to unmute again
              toggleMute(false);
            }}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors bg-brand-green hover:bg-green-600 text-white shadow-lg shadow-green-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
