"use client";

import React, { useState, useRef, useEffect } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface AIMessage {
  role: "user" | "ai";
  content: string;
}

const COMMON_QUESTIONS = [
  "Summarize the meeting so far",
  "Has my name been mentioned?",
  "What are the action items?",
  "What was the last decision made?",
];

export function Konn3ctAIPanel() {
  const { captions, currentUser, meetingInfo } = useMeeting();
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: "ai", content: "Hi! I am Konn3ct AI. I am actively reading the live meeting transcript. Ask me anything about what has been discussed!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const askKonn3ctAI = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMsg = question;
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsLoading(true);

    try {
      const sessionToken = typeof window !== "undefined" ? sessionStorage.getItem("conn3ct_session_token") : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://edge.konn3ct.net";
      const res = await fetch(`${apiUrl}/api/ai/chat/${meetingInfo.roomSlug}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(sessionToken && { "Authorization": `Bearer ${sessionToken}` })
        },
        body: JSON.stringify({ question: userMsg })
      });

      const data = await res.json();
      if (data.answer) {
        setMessages(prev => [...prev, { role: "ai", content: data.answer }]);
      } else {
        setMessages(prev => [...prev, { role: "ai", content: "Sorry, I encountered an error." }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: "ai", content: "Sorry, I am unable to process your request right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askKonn3ctAI(input);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--mt-surface)]">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-[var(--mt-border-strong)]">
        <div className="w-8 h-8 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-green">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--mt-text)]">Konn3ct AI</h3>
          <p className="text-xs text-[var(--mt-text-muted)]">Your in-meeting assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              msg.role === "user" ? "bg-[var(--mt-bg-hover)]" : "bg-brand-green/10 text-brand-green"
            )}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={cn(
              "px-4 py-2.5 rounded-2xl max-w-[85%] text-sm",
              msg.role === "user" 
                ? "bg-[var(--mt-bg-hover)] text-[var(--mt-text)] rounded-tr-sm" 
                : "bg-brand-green/10 text-[var(--mt-text)] rounded-tl-sm prose prose-sm prose-invert max-w-none"
            )}>
              {msg.role === "ai" ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-brand-green/10 text-brand-green/70 rounded-tl-sm text-sm flex items-center gap-2">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--mt-border-strong)] bg-[var(--mt-surface)]">
        <div className="flex flex-wrap gap-2 mb-3">
          {COMMON_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => askKonn3ctAI(q)}
              disabled={isLoading}
              className="text-[11px] px-3 py-1.5 rounded-full border border-[var(--mt-border-strong)] text-[var(--mt-text-muted)] hover:text-[var(--mt-text)] hover:bg-[var(--mt-bg-hover)] hover:border-brand-green/50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask Konn3ct AI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-[var(--mt-bg-hover)] text-[var(--mt-text)] border border-[var(--mt-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-green"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-brand-green flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-green/90 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
