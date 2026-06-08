"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { REACTION_EMOJIS } from "@/lib/mock/meeting";
import { motion, AnimatePresence } from "framer-motion";

export function ReactionsLayer() {
  const { reactions, showReactionPicker, sendReaction, setShowReactionPicker } =
    useMeeting();

  return (
    <>
      {/* Floating reactions */}
      <div className="fixed bottom-32 left-4 z-50 pointer-events-none">
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: -450,
                x: Math.random() * 80 - 40,
                scale: [0.5, 1.2, 1.2, 1],
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 6.0, 
                ease: "easeOut",
                opacity: { times: [0, 0.1, 0.8, 1] }
              }}
              className="absolute bottom-0 left-0"
            >
              <div className="flex flex-col items-center drop-shadow-xl">
                <span className="text-4xl drop-shadow-md" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))" }}>{r.emoji}</span>
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full mt-1 shadow-md border border-white/10 whitespace-nowrap"
                  style={{
                    color: "#ffffff",
                    backgroundColor: "rgba(0, 0, 0, 0.65)",
                    backdropFilter: "blur(4px)"
                  }}
                >
                  {r.senderName.split(" ")[0]}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Reaction picker */}
      <AnimatePresence>
        {showReactionPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 backdrop-blur-xl rounded-2xl p-3 shadow-2xl"
            style={{
              backgroundColor: "var(--mt-reaction-picker)",
              border: "1px solid var(--mt-border-strong)",
            }}
          >
            <div className="grid grid-cols-6 gap-1">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    sendReaction(emoji);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl active:scale-90 transition-all text-xl"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--mt-bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close picker */}
      {showReactionPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowReactionPicker(false)}
        />
      )}
    </>
  );
}
