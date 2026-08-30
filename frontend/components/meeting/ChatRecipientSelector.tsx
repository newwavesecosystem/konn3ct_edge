"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Participant } from "@/lib/types/meeting";
import { cn } from "@/lib/utils";
import {
  Globe,
  Lock,
  Search,
  Check,
  ChevronDown,
  Crown,
  Shield,
  User,
  X,
  Users
} from "lucide-react";

interface ChatRecipientSelectorProps {
  targetUserId: string;
  onSelectTarget: (targetId: string) => void;
  participants: Participant[];
  currentUserId: string;
  disabled?: boolean;
}

const roleBadgeMap: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  host: { icon: <Crown className="w-2.5 h-2.5" />, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", label: "Host" },
  "co-host": { icon: <Shield className="w-2.5 h-2.5" />, color: "text-blue-400 bg-blue-400/10 border-blue-400/20", label: "Co-host" },
  presenter: { icon: <User className="w-2.5 h-2.5" />, color: "text-purple-400 bg-purple-400/10 border-purple-400/20", label: "Presenter" },
};

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ChatRecipientSelector({
  targetUserId,
  onSelectTarget,
  participants,
  currentUserId,
  disabled = false,
}: ChatRecipientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter out current user and automated bots
  const eligibleParticipants = useMemo(() => {
    return participants
      .filter((p) => p.id !== currentUserId && p.role !== "bot" && p.role !== "recorder")
      .sort((a, b) => {
        // Sort priority: host -> co-host -> presenter -> alphabetical
        const roleScore = (r: string) => (r === "host" ? 3 : r === "co-host" ? 2 : r === "presenter" ? 1 : 0);
        const scoreDiff = roleScore(b.role) - roleScore(a.role);
        if (scoreDiff !== 0) return scoreDiff;
        return a.name.localeCompare(b.name);
      });
  }, [participants, currentUserId]);

  // Filtered by search query
  const filteredParticipants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleParticipants;
    return eligibleParticipants.filter(
      (p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)
    );
  }, [eligibleParticipants, searchQuery]);

  const selectedParticipant = useMemo(() => {
    if (targetUserId === "everyone") return null;
    return participants.find((p) => p.id === targetUserId) || null;
  }, [targetUserId, participants]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleSelect = (userId: string) => {
    onSelectTarget(userId);
    setIsOpen(false);
  };

  const handleClearToEveryone = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectTarget("everyone");
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          id="chat-recipient-trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={cn(
            "group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 outline-none select-none",
            "hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            targetUserId === "everyone"
              ? "bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
              : "bg-brand-green/20 hover:bg-brand-green/30 text-brand-green-soft border border-brand-green/40 shadow-sm"
          )}
          style={{
            backgroundColor: targetUserId === "everyone" ? "var(--mt-bg-control)" : undefined,
            borderColor: targetUserId === "everyone" ? "var(--mt-border)" : undefined,
            color: targetUserId === "everyone" ? "var(--mt-text-secondary)" : undefined,
          }}
        >
          {targetUserId === "everyone" ? (
            <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}

          <span className="truncate max-w-[140px] text-[11px] font-semibold">
            {targetUserId === "everyone" ? (
              "To: Everyone"
            ) : (
              `To: ${selectedParticipant ? selectedParticipant.name : "Direct"}`
            )}
          </span>

          {targetUserId !== "everyone" && selectedParticipant && roleBadgeMap[selectedParticipant.role] && (
            <span className={cn("text-[9px] px-1 py-0.2 rounded border shrink-0", roleBadgeMap[selectedParticipant.role].color)}>
              {roleBadgeMap[selectedParticipant.role].label}
            </span>
          )}

          <ChevronDown
            className={cn(
              "w-3 h-3 opacity-60 transition-transform duration-200 shrink-0 ml-0.5",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {/* Quick Reset to Everyone shortcut when in private mode */}
        {targetUserId !== "everyone" && (
          <button
            type="button"
            onClick={handleClearToEveryone}
            title="Switch back to Everyone (Public)"
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            style={{ color: "var(--mt-text-muted)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          id="chat-recipient-dropdown"
          className="absolute bottom-full mb-2 left-0 z-50 w-72 rounded-xl shadow-2xl overflow-hidden border backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          style={{
            backgroundColor: "var(--mt-dialog-bg, #1a1e26)",
            borderColor: "var(--mt-border, rgba(255, 255, 255, 0.12))",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
          }}
        >
          {/* Header & Sticky Search Box */}
          <div className="p-2.5 border-b" style={{ borderColor: "var(--mt-border, rgba(255,255,255,0.08))" }}>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: "var(--mt-text-muted, #94a3b8)" }}>
                Send Message To
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/60 font-mono" style={{ color: "var(--mt-text-faint)" }}>
                {eligibleParticipants.length + 1} options
              </span>
            </div>

            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--mt-text-muted, #94a3b8)" }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user by name or role..."
                id="chat-recipient-search-input"
                className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs outline-none transition-all"
                style={{
                  backgroundColor: "var(--mt-bg-input, rgba(255,255,255,0.06))",
                  color: "var(--mt-text, #f8fafc)",
                  border: "1px solid var(--mt-border, rgba(255,255,255,0.1))"
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 p-0.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Recipient List with Modern Stylish Scrollbar */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto chat-menu-scrollbar p-1.5 space-y-1"
          >
            {/* Option 1: Everyone (Public) */}
            {(!searchQuery || "everyone".includes(searchQuery.toLowerCase()) || "public".includes(searchQuery.toLowerCase())) && (
              <button
                type="button"
                role="option"
                aria-selected={targetUserId === "everyone"}
                onClick={() => handleSelect("everyone")}
                id="recipient-option-everyone"
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer group",
                  targetUserId === "everyone"
                    ? "bg-brand-green/20 text-white"
                    : "hover:bg-white/5 text-white/80"
                )}
                style={
                  targetUserId !== "everyone"
                    ? { color: "var(--mt-text-secondary)" }
                    : undefined
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate" style={{ color: "var(--mt-text, #f8fafc)" }}>
                        Everyone
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                        Public
                      </span>
                    </div>
                    <p className="text-[10px] truncate" style={{ color: "var(--mt-text-faint, #64748b)" }}>
                      Visible to all participants
                    </p>
                  </div>
                </div>

                {targetUserId === "everyone" && (
                  <Check className="w-4 h-4 text-brand-green-soft shrink-0 ml-2" />
                )}
              </button>
            )}

            {/* Divider if Everyone is shown and there are participant results */}
            {(!searchQuery || "everyone".includes(searchQuery.toLowerCase())) && filteredParticipants.length > 0 && (
              <div className="my-1 border-t" style={{ borderColor: "var(--mt-border, rgba(255,255,255,0.06))" }} />
            )}

            {/* Individual Participants */}
            {filteredParticipants.map((p) => {
              const isSelected = targetUserId === p.id;
              const badge = roleBadgeMap[p.role];

              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(p.id)}
                  id={`recipient-option-${p.id}`}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer group",
                    isSelected
                      ? "bg-brand-green/20 text-white"
                      : "hover:bg-white/5 text-white/80"
                  )}
                  style={
                    !isSelected
                      ? { color: "var(--mt-text-secondary)" }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Participant Avatar / Initials */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 border"
                      style={{
                        backgroundColor: isSelected ? "var(--color-brand-green, #207450)" : "var(--mt-bg-control, rgba(255,255,255,0.08))",
                        borderColor: isSelected ? "var(--color-brand-green-soft, #3c8464)" : "var(--mt-border, rgba(255,255,255,0.1))",
                        color: "var(--mt-text, #f8fafc)"
                      }}
                    >
                      {getInitials(p.name)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate" style={{ color: "var(--mt-text, #f8fafc)" }}>
                          {p.name}
                        </span>
                        {badge && (
                          <span className={cn("text-[9px] px-1.5 py-0.2 rounded border font-medium flex items-center gap-0.5", badge.color)}>
                            {badge.icon}
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] flex items-center gap-1 truncate text-emerald-400/80">
                        <Lock className="w-2.5 h-2.5 shrink-0" /> Private message
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-brand-green-soft shrink-0 ml-2" />
                  )}
                </button>
              );
            })}

            {/* Empty Search Result State */}
            {filteredParticipants.length === 0 && (!searchQuery || !"everyone".includes(searchQuery.toLowerCase())) && (
              <div className="py-6 px-3 text-center">
                <Users className="w-8 h-8 mx-auto mb-1.5 opacity-30" style={{ color: "var(--mt-text-muted)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--mt-text-muted)" }}>
                  No participants found
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--mt-text-faint)" }}>
                  No matching user for &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
