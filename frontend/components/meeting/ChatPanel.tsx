"use client";

import React, { useState, useRef, useEffect } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { cn } from "@/lib/utils";
import { Send, Crown, Shield, User } from "lucide-react";

const roleBadge: Record<string, { icon: React.ReactNode; color: string }> = {
  host: { icon: <Crown className="w-3 h-3" />, color: "text-yellow-400" },
  "co-host": { icon: <Shield className="w-3 h-3" />, color: "text-blue-400" },
  presenter: { icon: <User className="w-3 h-3" />, color: "text-purple-400" },
};

export function ChatPanel() {
  const { chatMessages, sendMessage, currentUser } = useMeeting();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput("");
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
        {chatMessages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-[11px] text-white/30 bg-white/5 px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }
          const isMe = msg.senderId === currentUser.id;
          const badge = roleBadge[msg.senderRole];
          return (
            <div
              key={msg.id}
              className={cn("flex flex-col gap-0.5", isMe && "items-end")}
            >
              <div className="flex items-center gap-1.5">
                {badge && <span className={badge.color}>{badge.icon}</span>}
                <span className="text-[11px] font-medium text-white/50">
                  {isMe ? "You" : msg.senderName}
                </span>
                <span className="text-[10px] text-white/25">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div
                className={cn(
                  "max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
                  isMe
                    ? "bg-brand-green/80 text-white rounded-br-md"
                    : "bg-white/5 text-white/90 rounded-bl-md"
                )}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 py-2 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-1.5 rounded-lg bg-brand-green/80 text-white disabled:opacity-30 hover:bg-brand-green transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
