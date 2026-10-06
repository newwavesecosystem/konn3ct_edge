"use client";

import React, { useRef, useEffect, useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Globe } from "lucide-react";

export function CaptionsOverlay() {
  const { captions, isCaptionsEnabled, captionSize, translationLanguage } = useMeeting();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to latest caption
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    // Reset auto-fade timer on every caption update (8 seconds of silence)
    setIsVisible(true);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 8000);

    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [captions]);

  if (!isCaptionsEnabled || captions.length === 0) return null;

  const isTranslated = translationLanguage && translationLanguage !== 'original' && translationLanguage !== 'en';

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-50 flex items-end justify-center pb-8">
      <AnimatePresence>
        {isVisible && (
          <motion.div 
            drag
            dragConstraints={containerRef}
            dragMomentum={false}
            dragElastic={0.1}
            initial={{ opacity: 0, y: 10, scale: captionSize * 0.95 }}
            animate={{ opacity: 1, y: 0, scale: captionSize }}
            exit={{ opacity: 0, y: 10, scale: captionSize * 0.95 }}
            transition={{ duration: 0.25 }}
            style={{ scale: captionSize, transformOrigin: "bottom center" }}
            className="bg-black/75 backdrop-blur-md px-6 py-4 rounded-2xl pointer-events-auto shadow-2xl border border-white/10 w-fit max-w-[calc(100%-2rem)] md:max-w-2xl cursor-grab active:cursor-grabbing"
          >
            {isTranslated && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-green/90 mb-2 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-brand-green" />
                <span>Live Translation ({translationLanguage.toUpperCase()})</span>
              </div>
            )}
            
            <div 
              className="flex flex-col gap-2 overflow-y-auto max-h-[160px] no-scrollbar"
              ref={scrollRef as any}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onWheelCapture={(e) => e.stopPropagation()}
              onTouchStartCapture={(e) => e.stopPropagation()}
            >
              {captions.map((caption, idx) => (
                <div 
                  key={`${caption.userId}-${caption.timestamp}-${idx}`}
                  className="flex items-start gap-2 text-white text-sm sm:text-base md:text-lg transition-all duration-150"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                >
                  <span className="font-semibold text-brand-green whitespace-nowrap shrink-0">
                    {caption.name}:
                  </span>
                  <span className={cn(
                    "leading-snug font-medium transition-colors",
                    !caption.isFinal ? "text-white/75 italic" : "text-white"
                  )}>
                    {caption.text}
                    {!caption.isFinal && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-green ml-1.5 animate-pulse" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
