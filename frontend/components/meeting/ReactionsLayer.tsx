"use client";

import React, { useMemo } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { REACTION_EMOJIS } from "@/lib/mock/meeting";
import { motion, AnimatePresence } from "framer-motion";

const FLOAT_DURATION_SECONDS = 10;
const MAX_VISIBLE_REACTIONS = 30; // Increased since they float faster
const LANE_COUNT = 5;

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

function getReactionPath(id: string): { x: number[]; y: number[]; scale: number[] } {
  const lane = getReactionLane(id);
  const spread = [-12, 12, 36, 60, 84];
  const baseX = spread[lane] ?? 0;
  
  // Create organic wobble based on hash
  const hash = hashString(id);
  const wobble1 = (hash % 20) - 10;
  const wobble2 = ((hash >> 2) % 30) - 15;
  const wobble3 = ((hash >> 4) % 20) - 10;

  return {
    x: [baseX, baseX + wobble1, baseX + wobble2, baseX + wobble3, baseX],
    y: [0, -100, -250, -400, -550], // Accelerate slightly upward
    scale: [0.3, 1.2, 1.0, 1.05, 0.9], // Pop in, stabilize, shrink at end
  };
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
            const path = getReactionPath(r.id);

            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 0, x: path.x[0], scale: 0.3 }}
                animate={{
                  opacity: [0, 1, 1, 0.8, 0],
                  y: path.y,
                  x: path.x,
                  scale: path.scale,
                  rotate: [0, (hashString(r.id) % 20) - 10, ((hashString(r.id) >> 1) % 20) - 10, 0]
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  duration: FLOAT_DURATION_SECONDS,
                  ease: "easeOut",
                  times: [0, 0.1, 0.5, 0.8, 1]
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
            initial={{ opacity: 0, y: 20, scale: 0.8, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 20, scale: 0.8, filter: "blur(10px)" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl p-3 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
            style={{
              backgroundColor: "rgba(30, 30, 30, 0.65)", // Glassmorphic background
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderTop: "1px solid rgba(255, 255, 255, 0.25)",
            }}
          >
            <div className="grid grid-cols-6 gap-2">
              {REACTION_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.35, y: -4 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => {
                    sendReaction(emoji);
                    setShowReactionPicker(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-2xl transition-colors"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  style={{
                    filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.2))",
                  }}
                >
                  {emoji}
                </motion.button>
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
