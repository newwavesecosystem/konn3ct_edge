"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { MicOff, VideoOff, MessageSquareOff, Unlock, Shield } from "lucide-react";

export function SecurityPanel() {
  const { forceMuteUser, roomSettings, updateRoomSettings } = useMeeting();

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--mt-border)" }}
      >
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--mt-text)" }}>
          <Shield className="w-4 h-4 text-brand-green" />
          Security & Controls
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        <p className="text-xs mb-4" style={{ color: "var(--mt-text-secondary)" }}>
          Manage room security and participant permissions.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => forceMuteUser(undefined, 'all_except_hosts')}
            className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors border"
            style={{ borderColor: "var(--mt-border)", color: "var(--mt-text-secondary)" }}
          >
            <MicOff className="w-5 h-5 mb-2" />
            <span className="text-xs text-center leading-tight">Mute<br/>Attendees</span>
          </button>
          <button
            onClick={() => forceMuteUser(undefined, 'all_except_presenters')}
            className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors border"
            style={{ borderColor: "var(--mt-border)", color: "var(--mt-text-secondary)" }}
          >
            <MicOff className="w-5 h-5 mb-2 text-purple-400" />
            <span className="text-xs text-center leading-tight">Mute Except<br/>Presenters</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer border" style={{ borderColor: "var(--mt-border)" }}>
            <div className="flex items-center gap-3">
              <MicOff className="w-4 h-4" style={{ color: roomSettings.micLocked ? "#f87171" : "var(--mt-text-muted)" }} />
              <div className="flex flex-col">
                <span className="text-sm font-medium" style={{ color: "var(--mt-text)" }}>Lock Microphones</span>
                <span className="text-xs" style={{ color: "var(--mt-text-faint)" }}>Prevent attendees from unmuting</span>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={roomSettings.micLocked}
              onChange={(e) => updateRoomSettings({ micLocked: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 text-brand-green focus:ring-brand-green bg-transparent"
            />
          </label>
          
          <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer border" style={{ borderColor: "var(--mt-border)" }}>
            <div className="flex items-center gap-3">
              <VideoOff className="w-4 h-4" style={{ color: roomSettings.videoLocked ? "#f87171" : "var(--mt-text-muted)" }} />
              <div className="flex flex-col">
                <span className="text-sm font-medium" style={{ color: "var(--mt-text)" }}>Lock Cameras</span>
                <span className="text-xs" style={{ color: "var(--mt-text-faint)" }}>Prevent attendees from sharing video</span>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={roomSettings.videoLocked}
              onChange={(e) => updateRoomSettings({ videoLocked: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 text-brand-green focus:ring-brand-green bg-transparent"
            />
          </label>
          
          <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer border" style={{ borderColor: "var(--mt-border)" }}>
            <div className="flex items-center gap-3">
              <MessageSquareOff className="w-4 h-4" style={{ color: roomSettings.chatLocked ? "#f87171" : "var(--mt-text-muted)" }} />
              <div className="flex flex-col">
                <span className="text-sm font-medium" style={{ color: "var(--mt-text)" }}>Lock Chat</span>
                <span className="text-xs" style={{ color: "var(--mt-text-faint)" }}>Disable text chat for attendees</span>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={roomSettings.chatLocked}
              onChange={(e) => updateRoomSettings({ chatLocked: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 text-brand-green focus:ring-brand-green bg-transparent"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer border mt-2" style={{ borderColor: "var(--mt-border)" }}>
            <div className="flex items-center gap-3">
              <Unlock className="w-4 h-4" style={{ color: roomSettings.bypassWaitingRoom ? "var(--brand-green)" : "var(--mt-text-muted)" }} />
              <div className="flex flex-col">
                <span className="text-sm font-medium" style={{ color: "var(--mt-text)" }}>Bypass Waiting Room</span>
                <span className="text-xs" style={{ color: "var(--mt-text-faint)" }}>Allow direct entry</span>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={roomSettings.bypassWaitingRoom || false}
              onChange={(e) => updateRoomSettings({ bypassWaitingRoom: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 text-brand-green focus:ring-brand-green bg-transparent"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
