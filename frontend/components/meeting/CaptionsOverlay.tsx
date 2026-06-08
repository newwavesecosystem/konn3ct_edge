"use client";

import React, { useRef, useEffect } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { cn } from "@/lib/utils";

export function CaptionsOverlay() {
  const { captions, isCaptionsEnabled, captionSize } = useMeeting();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [captions]);

  if (!isCaptionsEnabled || captions.length === 0) return null;

  return (
    <div 
      className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 pointer-events-none z-50 flex justify-center"
      style={{ 
        transform: `translateX(-50%) scale(${captionSize})`, 
        transformOrigin: "bottom center" 
      }}
    >
      <div 
        ref={scrollRef}
        className="flex flex-col gap-1.5 bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl overflow-y-auto pointer-events-auto max-h-[160px] no-scrollbar shadow-2xl border border-white/10 w-fit"
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
      </div>
    </div>
  );
}
