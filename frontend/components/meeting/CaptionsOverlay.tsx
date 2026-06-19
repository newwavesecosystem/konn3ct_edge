"use client";

import React, { useRef, useEffect } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { cn } from "@/lib/utils";

import { motion } from "framer-motion";

export function CaptionsOverlay() {
  const { captions, isCaptionsEnabled, captionSize } = useMeeting();
  const scrollRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [captions]);

  if (!isCaptionsEnabled || captions.length === 0) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-50 flex items-end justify-center pb-8">
      <motion.div 
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        dragElastic={0.1}
        style={{ scale: captionSize, transformOrigin: "bottom center" }}
        className="flex flex-col gap-1.5 bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl overflow-y-auto pointer-events-auto max-h-[160px] no-scrollbar shadow-2xl border border-white/10 w-fit max-w-[calc(100%-2rem)] md:max-w-2xl cursor-grab active:cursor-grabbing"
        ref={scrollRef as any}
      >
        {captions.map((caption, idx) => (
          <div 
            key={`${caption.userId}-${caption.timestamp}-${idx}`}
            className="flex items-start gap-2 text-white text-sm sm:text-base md:text-lg"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
          >
            <span className="font-semibold text-brand-green whitespace-nowrap shrink-0">
              {caption.name}:
            </span>
            <span className={cn(
              "leading-tight font-medium",
              !caption.isFinal && "text-white/70 italic"
            )}>
              {caption.text}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
