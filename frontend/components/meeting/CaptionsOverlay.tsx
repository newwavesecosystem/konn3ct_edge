"use client";

import React from "react";
import { useMeeting } from "@/lib/meeting-context";
import { cn } from "@/lib/utils";

export function CaptionsOverlay() {
  const { captions, isCaptionsEnabled } = useMeeting();

  if (!isCaptionsEnabled || captions.length === 0) return null;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 pointer-events-none z-50">
      <div className="flex flex-col gap-1 items-center justify-end h-full min-h-[100px]">
        {captions.map((caption, idx) => (
          <div 
            key={`${caption.userId}-${caption.timestamp}-${idx}`}
            className="flex items-start gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-white text-sm sm:text-base md:text-lg animate-in fade-in slide-in-from-bottom-2 duration-300"
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
