"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function MeetingErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log complete error details to the browser console
    console.error("[Meeting Error Boundary]", {
      message: error?.message,
      stack: error?.stack,
      digest: error?.digest,
      time: new Date().toISOString(),
    });
  }, [error]);

  const handleReload = () => {
    window.location.reload();
  };

  const handleReturnToJoin = () => {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const roomId = segments[segments.length - 1] || "";
    window.location.href = roomId ? `/join/${roomId}` : "/";
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 text-center select-none"
      style={{ backgroundColor: "#0d0d1a", color: "#f3f4f6" }}
    >
      <div
        className="max-w-md w-full p-6 sm:p-8 rounded-3xl flex flex-col items-center shadow-2xl"
        style={{
          backgroundColor: "#16162a",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 ring-8 ring-amber-500/5">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h2 className="text-lg sm:text-xl font-bold mb-2 text-white">
          Meeting Encountered an Issue
        </h2>

        <p className="text-xs sm:text-sm text-gray-400 mb-6 leading-relaxed">
          {error?.message || "An unexpected error interrupted your meeting view."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 text-white"
            style={{ backgroundColor: "#10b981" }}
          >
            <RefreshCw className="w-4 h-4" />
            Try Recovering
          </button>

          <button
            onClick={handleReload}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 text-gray-200"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
          >
            Reload Page
          </button>
        </div>

        <button
          onClick={handleReturnToJoin}
          className="mt-4 text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5 transition-colors py-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to Pre-Room / Join Screen
        </button>
      </div>
    </div>
  );
}
