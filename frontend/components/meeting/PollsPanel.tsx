"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { cn } from "@/lib/utils";
import { CheckCircle2, BarChart3 } from "lucide-react";

export function PollsPanel() {
  const { polls, votePoll, createPoll } = useMeeting();
  const [isCreating, setIsCreating] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState(["", ""]);

  const handleCreate = () => {
    if (!question.trim()) return;
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (validOptions.length < 2) return;
    createPoll(question.trim(), validOptions);
    setIsCreating(false);
    setQuestion("");
    setOptions(["", ""]);
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--mt-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--mt-text)" }}>Polls</h3>
        <button 
          onClick={() => setIsCreating(true)}
          className="text-xs text-brand-green-soft hover:text-brand-green transition-colors font-medium"
        >
          + Create Poll
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-4">
        {isCreating ? (
          <div className="rounded-2xl p-4 space-y-4" style={{ backgroundColor: "var(--mt-bg-control)", border: "1px solid var(--mt-border)" }}>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--mt-text-secondary)" }}>Question</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask something..."
                className="w-full text-sm rounded-lg px-3 py-2 bg-transparent focus:outline-none"
                style={{ border: "1px solid var(--mt-border)", color: "var(--mt-text)" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--mt-text-secondary)" }}>Options</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[i] = e.target.value;
                      setOptions(newOpts);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="w-full text-sm rounded-lg px-3 py-2 bg-transparent focus:outline-none"
                    style={{ border: "1px solid var(--mt-border)", color: "var(--mt-text)" }}
                  />
                ))}
                {options.length < 5 && (
                  <button
                    onClick={() => setOptions([...options, ""])}
                    className="text-xs text-brand-green-soft hover:text-brand-green font-medium"
                  >
                    + Add option
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCreating(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{ color: "var(--mt-text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
                className="text-xs px-3 py-1.5 rounded-lg bg-brand-green hover:bg-[#287854] text-white font-medium disabled:opacity-50 transition-colors"
              >
                Post Poll
              </button>
            </div>
          </div>
        ) : polls.length === 0 ? (
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
                      {/* Progress bar fill */}
                      <div
                        className="absolute inset-0 transition-all duration-700 rounded-xl"
                        style={{
                          backgroundColor: "var(--mt-bg-control)",
                        }}
                      />
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 transition-all duration-700 rounded-xl",
                          isMyVote ? "bg-brand-green/25" : ""
                        )}
                        style={{
                          width: `${pct}%`,
                          ...(!isMyVote ? { backgroundColor: "var(--mt-bg-active)" } : {}),
                        }}
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
