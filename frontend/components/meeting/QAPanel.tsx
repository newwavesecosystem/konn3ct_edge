"use client";

import React, { useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { ThumbsUp, MessageSquare, Trash2, CheckCircle2, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export function QAPanel() {
  const { qaMessages, askQuestion, upvoteQuestion, answerQuestion, deleteQuestion, currentUser } = useMeeting();
  const [newQuestion, setNewQuestion] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  const isHost = currentUser.role === "host" || currentUser.role === "co-host";

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    askQuestion(newQuestion.trim(), isAnonymous);
    setNewQuestion("");
    setIsAnonymous(false);
  };

  const handleAnswerSubmit = (qId: string) => {
    if (!answerText.trim()) return;
    answerQuestion(qId, answerText.trim());
    setAnsweringId(null);
    setAnswerText("");
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 flex items-center justify-between shadow-sm z-10"
        style={{ backgroundColor: "var(--mt-bg)", borderBottom: "1px solid var(--mt-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--mt-text)" }}>
          Q&A <span style={{ color: "var(--mt-text-faint)" }} className="font-normal">({qaMessages.length})</span>
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {qaMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60 mt-10">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--mt-bg-hover)" }}>
              <MessageSquare className="w-6 h-6" style={{ color: "var(--mt-text-muted)" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--mt-text-secondary)" }}>
              No questions yet.<br />Be the first to ask!
            </p>
          </div>
        ) : (
          qaMessages.map((q) => (
            <div key={q.id} className="p-3 rounded-xl border transition-all" style={{ backgroundColor: "var(--mt-bg-hover)", borderColor: "var(--mt-border)" }}>
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="flex items-center gap-2">
                  <Avatar
                    fallback={q.isAnonymous ? "AN" : q.authorName.slice(0, 2).toUpperCase()}
                    className="w-7 h-7 text-[10px]"
                  />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--mt-text)" }}>
                      {q.isAnonymous ? "Anonymous" : q.authorName}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--mt-text-faint)" }}>
                      {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {q.isAnswered ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green">
                      <CheckCircle2 className="w-3 h-3" /> Answered
                    </span>
                  ) : (
                    <button
                      onClick={() => upvoteQuestion(q.id)}
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors",
                        q.voterIds?.includes(currentUser.id) 
                          ? "bg-brand-accent/20 text-brand-accent"
                          : "hover:bg-white/10"
                      )}
                      style={!q.voterIds?.includes(currentUser.id) ? { color: "var(--mt-text-secondary)" } : undefined}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span className="font-medium">{q.upvotes}</span>
                    </button>
                  )}
                  {isHost && (
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors ml-1"
                      title="Delete Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              
              <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--mt-text)" }}>
                {q.question}
              </p>

              {q.isAnswered && q.answerText ? (
                <div className="mt-3 p-2.5 rounded-lg border bg-white/5" style={{ borderColor: "var(--mt-border)" }}>
                  <p className="text-[11px] font-semibold mb-1 text-brand-accent flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Answered by {q.answeredBy || 'Host'}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--mt-text-secondary)" }}>{q.answerText}</p>
                </div>
              ) : isHost && !q.isAnswered ? (
                <div className="mt-3">
                  {answeringId === q.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Type your answer..."
                        className="w-full text-xs p-2 rounded-lg bg-black/20 border text-white placeholder-gray-500 resize-none outline-none focus:border-brand-accent"
                        style={{ borderColor: "var(--mt-border)" }}
                        rows={2}
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setAnsweringId(null)}
                          className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                          style={{ color: "var(--mt-text-secondary)" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAnswerSubmit(q.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-brand-accent text-white font-medium hover:brightness-110 transition-all"
                        >
                          Send Answer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAnsweringId(q.id);
                        setAnswerText("");
                      }}
                      className="text-[11px] font-medium text-brand-accent hover:underline"
                    >
                      Answer Live or Type
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="p-4 z-10" style={{ backgroundColor: "var(--mt-bg)", borderTop: "1px solid var(--mt-border)" }}>
        <form onSubmit={handleAsk} className="flex flex-col gap-2">
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="w-full text-sm p-3 rounded-xl bg-black/20 border text-white placeholder-gray-500 resize-none outline-none focus:border-brand-accent transition-colors"
            style={{ borderColor: "var(--mt-border)" }}
            rows={2}
          />
          <div className="flex items-center justify-between mt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-gray-600 text-brand-accent focus:ring-brand-accent bg-transparent"
              />
              <span className="text-xs group-hover:text-white transition-colors" style={{ color: "var(--mt-text-secondary)" }}>
                Ask anonymously
              </span>
            </label>
            <button
              type="submit"
              disabled={!newQuestion.trim()}
              className="text-xs px-4 py-2 rounded-lg bg-brand-accent text-white font-medium hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ask
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
