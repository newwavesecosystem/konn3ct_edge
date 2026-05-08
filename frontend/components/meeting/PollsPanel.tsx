"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { cn } from "@/lib/utils";
import { CheckCircle2, BarChart3 } from "lucide-react";

export function PollsPanel() {
  const { polls, votePoll, createPoll } = useMeeting();

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--mt-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--mt-text)" }}>Polls</h3>
        <button 
          onClick={() => {
            const question = window.prompt("Enter poll question:");
            if (!question) return;
            const options = window.prompt("Enter options separated by commas (e.g. Yes, No):");
            if (!options) return;
            createPoll(question, options.split(',').map(s => s.trim()));
          }}
          className="text-xs text-brand-green-soft hover:text-brand-green transition-colors font-medium"
        >
          + Create Poll
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-4">
        {polls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <BarChart3 className="w-10 h-10 mb-3" style={{ color: "var(--mt-text-whisper)" }} />
            <p className="text-sm" style={{ color: "var(--mt-text-faint)" }}>No polls yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--mt-text-ghost)" }}>
              Create a poll to gather feedback
            </p>
          </div>
        ) : (
          polls.map((poll) => (
            <div
              key={poll.id}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: "var(--mt-bg-control)",
                border: "1px solid var(--mt-border)",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium leading-tight pr-2" style={{ color: "var(--mt-text)" }}>
                  {poll.question}
                </p>
                {poll.isActive ? (
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-green/20 text-brand-green-soft">
                    Live
                  </span>
                ) : (
                  <span
                    className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "var(--mt-bg-control)",
                      color: "var(--mt-text-faint)",
                    }}
                  >
                    Ended
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {poll.options.map((option) => {
                  const pct =
                    poll.totalVotes > 0
                      ? Math.round((option.votes / poll.totalVotes) * 100)
                      : 0;
                  const isMyVote = poll.myVote === option.id;

                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (poll.isActive && !poll.myVote) {
                          votePoll(poll.id, option.id);
                        }
                      }}
                      disabled={!poll.isActive || !!poll.myVote}
                      className={cn(
                        "relative w-full text-left rounded-xl overflow-hidden transition-all duration-200",
                        poll.isActive && !poll.myVote
                          ? "cursor-pointer"
                          : "cursor-default"
                      )}
                    >
                      {/* Progress bar */}
                      <div
                        className={cn(
                          "absolute inset-0 transition-all duration-500",
                          isMyVote ? "bg-brand-green/20" : ""
                        )}
                        style={!isMyVote ? { backgroundColor: "var(--mt-bg-control)" } : undefined}
                      />
                      <div className="relative flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2">
                          {isMyVote && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-brand-green-soft shrink-0" />
                          )}
                          <span className="text-xs" style={{ color: "var(--mt-text-secondary)" }}>
                            {option.text}
                          </span>
                        </div>
                        <span
                          className="text-[11px] font-mono shrink-0 ml-2"
                          style={{ color: "var(--mt-text-faint)" }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] mt-2" style={{ color: "var(--mt-text-ghost)" }}>
                {poll.totalVotes} vote{poll.totalVotes !== 1 && "s"} · by{" "}
                {poll.createdBy}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
