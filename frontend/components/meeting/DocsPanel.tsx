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
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Docs & Notes</h3>
        <button className="text-xs text-brand-green-soft hover:text-white transition-colors font-medium">
          + Add Note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-4">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <FileText className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-sm text-white/40">No documents shared</p>
            <p className="text-xs text-white/20 mt-1">
              Share notes or documents with participants
            </p>
          </div>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-brand-green-soft shrink-0" />
                  <span className="text-sm font-medium text-white truncate">
                    {doc.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Rendered content */}
              <div className="px-4 py-3 text-xs text-white/60 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto no-scrollbar">
                {doc.content}
              </div>

              <div className="px-4 py-2 border-t border-white/5 text-[10px] text-white/25">
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
