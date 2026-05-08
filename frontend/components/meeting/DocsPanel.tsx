"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { FileText, Download, ExternalLink } from "lucide-react";

export function DocsPanel() {
  const { docs } = useMeeting();

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--mt-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--mt-text)" }}>Docs & Notes</h3>
        <button className="text-xs text-brand-green-soft hover:text-brand-green transition-colors font-medium">
          + Add Note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-4">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <FileText className="w-10 h-10 mb-3" style={{ color: "var(--mt-text-whisper)" }} />
            <p className="text-sm" style={{ color: "var(--mt-text-faint)" }}>No documents shared</p>
            <p className="text-xs mt-1" style={{ color: "var(--mt-text-ghost)" }}>
              Share notes or documents with participants
            </p>
          </div>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: "var(--mt-bg-control)",
                border: "1px solid var(--mt-border)",
              }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--mt-border)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-brand-green-soft shrink-0" />
                  <span className="text-sm font-medium truncate" style={{ color: "var(--mt-text)" }}>
                    {doc.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--mt-text-faint)" }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--mt-text-faint)" }}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Rendered content */}
              <div
                className="px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto no-scrollbar"
                style={{ color: "var(--mt-text-muted)" }}
              >
                {doc.content}
              </div>

              <div
                className="px-4 py-2 text-[10px]"
                style={{
                  borderTop: "1px solid var(--mt-border)",
                  color: "var(--mt-text-ghost)",
                }}
              >
                Last edited by {doc.lastEditedBy} at{" "}
                {formatTime(doc.lastEditedAt)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
