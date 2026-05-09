"use client";

import React, { useState, useRef, useEffect } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { cn } from "@/lib/utils";
import { Send, Crown, Shield, User, Paperclip, Smile, Lock } from "lucide-react";
import { toast } from "sonner";
import { REACTION_EMOJIS } from "@/lib/mock/meeting";

const CHAT_EMOJIS = [...REACTION_EMOJIS, "😭", "😍", "😅", "🙏", "👀", "🚀", "💡", "✨", "🎈", "🎵", "☕"];

const roleBadge: Record<string, { icon: React.ReactNode; color: string }> = {
  host: { icon: <Crown className="w-3 h-3" />, color: "text-yellow-400" },
  "co-host": { icon: <Shield className="w-3 h-3" />, color: "text-blue-400" },
  presenter: { icon: <User className="w-3 h-3" />, color: "text-purple-400" },
};

export function ChatPanel() {
  const { chatMessages, sendMessage, currentUser, participants } = useMeeting();
  const [input, setInput] = useState("");
  const [targetUserId, setTargetUserId] = useState<string>("everyone");
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed, targetUserId !== "everyone" ? targetUserId : undefined);
    setInput("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1073741824) { // 1GB
      toast.error("File exceeds 1GB limit.");
      return;
    }

    try {
      setIsUploading(true);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, fileSize: file.size })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetch(data.presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-amz-acl": "public-read" },
        body: file,
      });

      sendMessage(`Shared a file: ${file.name}`, targetUserId !== "everyone" ? targetUserId : undefined, data.publicUrl);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const insertEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--mt-border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--mt-text)" }}>Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
        {chatMessages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span
                  className="text-[11px] px-3 py-1 rounded-full"
                  style={{
                    color: "var(--mt-text-faint)",
                    backgroundColor: "var(--mt-bg-control)",
                  }}
                >
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
                <span className="text-[11px] font-medium" style={{ color: "var(--mt-text-muted)" }}>
                  {isMe ? "You" : msg.senderName}
                </span>
                {msg.isPrivate && (
                  <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                    <Lock className="w-2.5 h-2.5" /> Private
                  </span>
                )}
                <span className="text-[10px]" style={{ color: "var(--mt-text-ghost)" }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div
                className={cn(
                  "max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
                  isMe
                    ? "bg-brand-green/80 text-white rounded-br-md"
                    : "rounded-bl-md"
                )}
                style={!isMe ? {
                  backgroundColor: "var(--mt-bg-control)",
                  color: "var(--mt-text-secondary)",
                } : undefined}
              >
                {/* Basic Mention Highlighting */}
                <span dangerouslySetInnerHTML={{ 
                  __html: msg.content.replace(/(@\w+)/g, '<span class="text-brand-green-soft font-semibold">$1</span>') 
                }} />
                
                {msg.fileUrl && (
                  <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10">
                    {msg.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                      <a href={msg.fileUrl} target="_blank" rel="noreferrer">
                        <img src={msg.fileUrl} alt="attachment" className="max-w-full rounded-lg max-h-48 object-cover" />
                      </a>
                    ) : (
                      <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs underline opacity-80 hover:opacity-100">
                        <Paperclip className="w-3.5 h-3.5" /> Download File
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3" style={{ borderTop: "1px solid var(--mt-border)" }}>
        <div className="mb-2 flex items-center justify-between">
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="text-[10px] bg-transparent outline-none px-1 py-0.5 rounded"
            style={{ color: "var(--mt-text-muted)" }}
          >
            <option value="everyone">To: Everyone</option>
            {participants.filter(p => p.id !== currentUser.id).map(p => (
              <option key={p.id} value={p.id}>To: {p.name}</option>
            ))}
          </select>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-xl px-2 py-1"
          style={{ backgroundColor: "var(--mt-bg-input)" }}
        >
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-brand-green-soft hover:bg-brand-green/10 disabled:opacity-50 transition-colors shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          
          <div className="relative" ref={emojiPickerRef}>
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 rounded-lg text-brand-green-soft hover:bg-brand-green/10 transition-colors shrink-0"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showEmojiPicker && (
              <div 
                className="absolute bottom-full mb-2 left-0 w-48 p-2 rounded-xl shadow-lg grid grid-cols-6 gap-1"
                style={{ backgroundColor: "var(--mt-bg-panel)", border: "1px solid var(--mt-border)" }}
              >
                {CHAT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    className="text-lg hover:bg-black/5 dark:hover:bg-white/5 rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={isUploading ? "Uploading..." : "Type a message..."}
            disabled={isUploading}
            className="flex-1 bg-transparent text-sm py-2 px-1 outline-none min-w-0"
            style={{ color: "var(--mt-text)" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isUploading}
            className="p-1.5 rounded-lg bg-brand-green/80 text-white disabled:opacity-30 hover:bg-brand-green transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
