"use client";

import React, { useMemo } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { REACTION_EMOJIS } from "@/lib/mock/meeting";
import { motion, AnimatePresence } from "framer-motion";

const FLOAT_DURATION_SECONDS = 30;
const MAX_VISIBLE_REACTIONS = 15;
const LANE_COUNT = 4;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getReactionLane(id: string): number {
  return hashString(id) % LANE_COUNT;
}

function getReactionXOffset(id: string): number {
  // Stable, small left-side spread. Do not use Math.random() in render.
  const spread = [-6, 18, 42, 66];
  return spread[getReactionLane(id)] ?? 0;
}

export function ReactionsLayer() {
  const { reactions, showReactionPicker, sendReaction, setShowReactionPicker } =
    useMeeting();

  const visibleReactions = useMemo(
    () => reactions.slice(-MAX_VISIBLE_REACTIONS),
    [reactions]
  );

  return (
    <>
      {/*
        Floating reactions only.
        User requirement:
        - left-hand side
        - smaller emoji
        - slow upward movement
        - about 30 seconds before removal/fade
        - no participant tile badge

        IMPORTANT: meeting-context.tsx must keep reactions alive for 30 seconds too.
        If the context still removes reactions after 5s/8s, update REACTION_DURATION there to 30000.
      */}
      <div className="fixed bottom-32 left-3 md:bottom-28 md:left-8 z-50 pointer-events-none h-[72vh] w-32 overflow-visible">
        <AnimatePresence initial={false}>
          {visibleReactions.map((r) => {
            const xOffset = getReactionXOffset(r.id);

            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 0, x: xOffset, scale: 0.85 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [0, -520],
                  x: xOffset,
                  scale: [0.85, 1, 1, 0.9],
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  duration: FLOAT_DURATION_SECONDS,
                  ease: "linear",
                  opacity: { times: [0, 0.01, 0.83, 1] },
                  scale: { times: [0, 0.01, 0.83, 1] },
                }}
                className="absolute bottom-0 left-0"
              >
                <div className="flex flex-col items-center">
                  <span
                    className="text-2xl md:text-3xl leading-none select-none drop-shadow-md"
                    style={{
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.38))",
                    }}
                  >
                    {r.emoji}
                  </span>
                  <span
                    className="mt-1 max-w-20 truncate rounded-full border border-white/10 px-2 py-0.5 text-[9px] md:text-[10px] font-semibold shadow-sm whitespace-nowrap"
                    style={{
                      color: "#ffffff",
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                      backdropFilter: "blur(3px)",
                    }}
                  >
                    {r.senderName?.split(" ")[0] ?? ""}
                  </span>
                </div>
              </motion.div>
            );
          })}
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
                    setShowReactionPicker(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl active:scale-90 transition-all text-xl"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "var(--mt-bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
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
