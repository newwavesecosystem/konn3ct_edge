"use client";

import React, { useState, useEffect } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { AlertCircle, VideoOff } from "lucide-react";
import { PermissionHelpSteps } from "./PermissionHelpSteps";

export function CamIssueDialog() {
  const { camError, setCamError, toggleCamera } = useMeeting();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!camError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowHelp(false);
    }
  }, [camError]);

  if (!camError) return null;

  const isPermissionBlocked = camError.name === "NotAllowedError" || camError.message.includes("Permission denied");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="max-w-md w-full p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200"
        style={{ backgroundColor: "var(--mt-dialog-bg)", border: "1px solid var(--mt-border-strong)" }}
      >
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          {isPermissionBlocked ? (
            <VideoOff className="w-8 h-8 text-red-500" />
          ) : (
            <AlertCircle className="w-8 h-8 text-red-500" />
          )}
        </div>
        
        <h3 className="text-xl font-bold mb-2" style={{ color: "var(--mt-text)" }}>
          {isPermissionBlocked ? "Camera Blocked" : "Camera Issue"}
        </h3>
        
        {!showHelp ? (
          <p className="text-sm mb-6" style={{ color: "var(--mt-text-alt)" }}>
            {isPermissionBlocked 
              ? "Your browser has blocked camera access for this site. You will need to allow it in your browser settings to share video."
              : "We couldn't access your camera. Please check your browser permissions, ensure it's plugged in, and not being used by another application."}
            <br /><br />
            <span className="text-xs opacity-75 break-words block text-red-400 font-mono">
              {camError.name}: {camError.message}
            </span>
          </p>
        ) : (
          <PermissionHelpSteps deviceType="camera" />
        )}

        <div className="flex gap-3 w-full">
          {!showHelp ? (
            <>
              <button
                onClick={() => setCamError(null)}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors hover:opacity-80"
                style={{ backgroundColor: "var(--mt-bg-tile)", color: "var(--mt-text)" }}
              >
                Dismiss
              </button>
              {isPermissionBlocked ? (
                <button
                  onClick={() => setShowHelp(true)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors bg-brand-blue hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                >
                  How to fix this
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCamError(null);
                    // Attempt to start camera again
                    toggleCamera();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors bg-brand-green hover:bg-green-600 text-white shadow-lg shadow-green-500/20"
                >
                  Retry
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setShowHelp(false)}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors hover:opacity-80"
                style={{ backgroundColor: "var(--mt-bg-tile)", color: "var(--mt-text)" }}
              >
                Back
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors bg-brand-green hover:bg-green-600 text-white shadow-lg shadow-green-500/20"
              >
                Reload Page
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
