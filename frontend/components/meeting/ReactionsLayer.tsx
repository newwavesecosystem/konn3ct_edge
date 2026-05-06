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
              initial={{ opacity: 1, y: 0, x: 0, scale: 0.5 }}
              animate={{
                opacity: 0,
                y: -180,
                x: Math.random() * 60 - 30,
                scale: 1.2,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              className="absolute bottom-0 left-0"
            >
              <div className="flex flex-col items-center">
                <span className="text-3xl">{r.emoji}</span>
                <span className="text-[10px] text-white/60 font-medium bg-black/40 px-2 py-0.5 rounded-full mt-0.5">
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
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl"
          >
            <div className="grid grid-cols-6 gap-1">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    sendReaction(emoji);
                    setShowReactionPicker(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-90 transition-all text-xl"
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
