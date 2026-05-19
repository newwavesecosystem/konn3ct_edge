"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMeeting } from "@/lib/meeting-context";
import { ParticipantTile } from "./ParticipantTile";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/types/meeting";
import {
  MonitorOff,
  MonitorUp,
  Maximize2,
  Minimize2,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";

export function StageView() {
  const { participants, layoutMode, isScreenSharing, toggleScreenShare, currentUser, eCinemaLink } =
    useMeeting();

  const screenSharer = participants.find((p) => p.isScreenSharing);
  const isSomeoneSharing = !!screenSharer || isScreenSharing;

  // Hooks must be called before any early returns — sort participants here.
  const sorted = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
      if (a.isCameraOn !== b.isCameraOn) return a.isCameraOn ? -1 : 1;
      return 0;
    });
  }, [participants]);

  if (eCinemaLink) {
    return <ECinemaLayout eCinemaLink={eCinemaLink} participants={participants} />;
  }

  if (isSomeoneSharing) {
    return (
      <ScreenShareLayout
        participants={participants}
        screenSharer={screenSharer}
        isCurrentUserSharing={isScreenSharing}
        onStopSharing={toggleScreenShare}
        currentUserId={currentUser.id}
      />
    );
  }

  const activeSpeaker = sorted[0];
  const others = sorted.filter((p) => p.id !== activeSpeaker?.id);

  if (layoutMode === "grid") {
    return <GridLayout participants={sorted} />;
  }

  if (layoutMode === "spotlight") {
    return <SpotlightLayout participants={sorted} />;
  }

  // Default: speaker layout
  return <SpeakerLayout activeSpeaker={activeSpeaker} others={others} />;
}

// ═══════════════════════════════════════════════════════════
// ── Tile motion shell — handles join / leave / reflow ──────
// ═══════════════════════════════════════════════════════════

const TILE_TRANSITION = {
  layout: { type: "spring" as const, stiffness: 300, damping: 32, mass: 0.8 },
  opacity: { duration: 0.18 },
  scale: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
};

function MotionTile({
  participant,
  isLarge,
  fixedAspect,
}: {
  participant: Participant;
  isLarge?: boolean;
  fixedAspect?: boolean;
}) {
  return (
    <motion.div
      layout
      layoutId={`tile-${participant.id}`}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={TILE_TRANSITION}
      className="w-full h-full min-h-0 min-w-0 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
    >
      <ParticipantTile
        participant={participant}
        isLarge={isLarge}
        fixedAspect={fixedAspect}
      />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── ADAPTIVE GRID — scrollable tiles with fixed min size ──
// ═══════════════════════════════════════════════════════════
//
// Strategy:
//   - For ≤6 participants, use bespoke "feature" layouts (hero, 2-col, 3-col,
//     3+2, etc.) that fill the viewport without scrolling.
//   - For 7+ participants, tiles maintain a comfortable minimum size and the
//     grid scrolls vertically with a themed scrollbar — just like the
//     reference image. No pagination, no shrinking tiles to unreadable sizes.
//   - Column count is computed from container width ÷ ideal tile width.

const TILE_GAP = 10;
const TILE_PADDING_X = 16;
const TILE_PADDING_Y = 16;
const IDEAL_TILE_WIDTH = 220;
const IDEAL_TILE_HEIGHT = 160;

interface GridSolution {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
}

function computeBestGrid(
  count: number,
  containerW: number,
  containerH: number,
): GridSolution {
  const availW = Math.max(0, containerW - TILE_PADDING_X * 2);
  const availH = Math.max(0, containerH - TILE_PADDING_Y * 2);

  let best: GridSolution = { cols: 1, rows: count, tileW: 0, tileH: 0 };
  let bestScore = -Infinity;

  const maxCols = Math.min(count, 6);

  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(count / cols);
    const tileW = (availW - TILE_GAP * (cols - 1)) / cols;
    const tileH = (availH - TILE_GAP * (rows - 1)) / rows;

    if (tileW < 80 || tileH < 60) continue;

    const area = tileW * tileH;
    const aspect = tileW / tileH;
    const targetAspect = 16 / 9;
    const aspectPenalty = Math.abs(Math.log(aspect / targetAspect));
    const score = area - aspectPenalty * 8000;

    if (score > bestScore) {
      bestScore = score;
      best = { cols, rows, tileW, tileH };
    }
  }

  return best;
}

/**
 * Compute optimal columns for the scrollable grid.
 * Tiles stay at a comfortable width; grid scrolls vertically.
 * On narrow mobile screens, drops to 1 column for readability.
 */
function computeScrollableGrid(containerW: number) {
  const availW = Math.max(0, containerW - TILE_PADDING_X * 2 - 12); // 12 = scrollbar space
  const minCols = containerW < 400 ? 1 : 2; // single column on very narrow phones
  const cols = Math.max(minCols, Math.min(6, Math.floor((availW + TILE_GAP) / (IDEAL_TILE_WIDTH + TILE_GAP))));
  const tileW = (availW - TILE_GAP * (cols - 1)) / cols;
  // Shorter tiles on mobile for better scrollability
  const tileH = containerW < 500 ? 130 : IDEAL_TILE_HEIGHT;
  return { cols, tileW, tileH };
}

const MIN_TILE_WIDTH = 160;
const MIN_TILE_HEIGHT = 110;
const MAX_TILES_PER_PAGE = 25;

function GridLayout({ participants }: { participants: Participant[] }) {
  const { gridOverflowMode } = useMeeting();
  const count = participants.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [containerSize, setContainerSize] = useState({ w: 960, h: 540 });

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Reset page when count or mode changes
  useEffect(() => {
    setPage(0);
  }, [count, gridOverflowMode]);

  // Can everything fit without scrolling/paging? (≤6 always fits; 7+ depends)
  const fitsInViewport = useMemo(() => {
    if (count <= 6) return true;
    const solution = computeBestGrid(count, containerSize.w, containerSize.h);
    return solution.tileW >= IDEAL_TILE_WIDTH * 0.75 && solution.tileH >= IDEAL_TILE_HEIGHT * 0.75;
  }, [count, containerSize]);

  // ── Bespoke layout for small counts ──
  if (fitsInViewport) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" ref={containerRef}>
        <div className="flex-1 min-h-0 relative">
          <GridInner
            participants={participants}
            containerW={containerSize.w}
            containerH={containerSize.h}
          />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ── PAGINATE mode ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════
  if (gridOverflowMode === "paginate") {
    const perPage = (() => {
      const fullSolution = computeBestGrid(count, containerSize.w, containerSize.h);
      if (
        fullSolution.tileW >= MIN_TILE_WIDTH &&
        fullSolution.tileH >= MIN_TILE_HEIGHT &&
        count <= MAX_TILES_PER_PAGE
      ) {
        return count;
      }
      for (let pp = MAX_TILES_PER_PAGE; pp >= 4; pp--) {
        const s = computeBestGrid(pp, containerSize.w, containerSize.h);
        if (s.tileW >= MIN_TILE_WIDTH && s.tileH >= MIN_TILE_HEIGHT) return pp;
      }
      return Math.min(count, 9);
    })();

    const totalPages = Math.max(1, Math.ceil(count / perPage));
    const currentPage = Math.min(page, totalPages - 1);
    const visibleParticipants = participants.slice(
      currentPage * perPage,
      currentPage * perPage + perPage,
    );

    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" ref={containerRef}>
        <div className="flex-1 min-h-0 relative">
          <GridInner
            participants={visibleParticipants}
            containerW={containerSize.w}
            containerH={containerSize.h - (totalPages > 1 ? 48 : 0)}
          />
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-center gap-3 py-2 px-4">
            <button
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30 hover:bg-[var(--mt-bg-hover)]"
              style={{ color: "var(--mt-text-muted)", backgroundColor: "var(--mt-bg-control)" }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    i === currentPage ? "w-6 h-2 bg-brand-green" : "w-2 h-2",
                  )}
                  style={i !== currentPage ? { backgroundColor: "var(--mt-text-ghost)" } : undefined}
                />
              ))}
            </div>

            <button
              onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30 hover:bg-[var(--mt-bg-hover)]"
              style={{ color: "var(--mt-text-muted)", backgroundColor: "var(--mt-bg-control)" }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-[11px] ml-2" style={{ color: "var(--mt-text-faint)" }}>
              {currentPage * perPage + 1}–{Math.min((currentPage + 1) * perPage, count)} of {count}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ── SCROLL mode (default) ─────────────────────────────
  // ═══════════════════════════════════════════════════════
  const { cols, tileH } = computeScrollableGrid(containerSize.w);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" ref={containerRef}>
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "var(--mt-scrollbar-thumb, rgba(0,0,0,0.15)) transparent",
          paddingRight: 4,
        }}
      >
        <motion.div
          layout
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridAutoRows: `${tileH}px`,
            gap: `${TILE_GAP}px`,
            padding: `${TILE_PADDING_Y}px ${TILE_PADDING_X}px`,
          }}
        >
          <AnimatePresence>
            {participants.map((p) => (
              <MotionTile key={p.id} participant={p} />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Bottom breathing room */}
        <div className="h-2 shrink-0" />
      </div>

      {/* Participant count badge */}
      {count > 12 && (
        <div
          className="shrink-0 flex items-center justify-center gap-2 py-1.5 px-4"
          style={{ color: "var(--mt-text-faint)" }}
        >
          <Users className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">{count} participants</span>
        </div>
      )}
    </div>
  );
}

/** Picks the right inner layout for small participant counts (≤ ~12). */
function GridInner({
  participants,
  containerW,
  containerH,
}: {
  participants: Participant[];
  containerW: number;
  containerH: number;
}) {
  const count = participants.length;

  // Hooks always run.
  const solution = useMemo(
    () => computeBestGrid(count, containerW, containerH),
    [count, containerW, containerH],
  );

  if (count === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" />
    );
  }

  // ── 1 participant: hero ─────────────────────────────────
  if (count === 1) {
    return (
      <div className="absolute inset-0 p-3 sm:p-4 flex items-center justify-center">
        <div className="w-full h-full max-w-5xl">
          <MotionTile participant={participants[0]} isLarge />
        </div>
      </div>
    );
  }

  // ── 2 participants: side-by-side on wide, stacked on narrow ──
  if (count === 2) {
    const isPortrait = containerW < containerH * 1.1;
    return (
      <div className="absolute inset-0 p-3 sm:p-4">
        <div
          className={cn(
            "w-full h-full flex gap-2.5 sm:gap-3",
            isPortrait ? "flex-col" : "flex-row",
          )}
        >
          <AnimatePresence>
            {participants.map((p) => (
              <div key={p.id} className="flex-1 min-w-0 min-h-0">
                <MotionTile participant={p} isLarge />
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── 3 participants: 3 tall columns (Google Meet's signature) ──
  if (count === 3 && containerW > containerH * 0.9) {
    return (
      <div className="absolute inset-0 p-3 sm:p-4">
        <div className="w-full h-full flex gap-2.5 sm:gap-3">
          <AnimatePresence>
            {participants.map((p) => (
              <div key={p.id} className="flex-1 min-w-0 min-h-0">
                <MotionTile participant={p} />
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── 5 participants: 3 top + 2 bottom, both rows equal height ──
  if (count === 5 && containerW > containerH) {
    return (
      <div className="absolute inset-0 p-3 sm:p-4">
        <div className="w-full h-full flex flex-col gap-2.5 sm:gap-3">
          <AnimatePresence>
            <div className="flex-1 min-h-0 flex gap-2.5 sm:gap-3">
              {participants.slice(0, 3).map((p) => (
                <div key={p.id} className="flex-1 min-w-0 min-h-0">
                  <MotionTile participant={p} />
                </div>
              ))}
            </div>
            <div className="flex-1 min-h-0 flex gap-2.5 sm:gap-3 justify-center">
              {participants.slice(3, 5).map((p) => (
                <div key={p.id} className="flex-1 min-w-0 min-h-0 max-w-[calc(33.333%-7px)]">
                  <MotionTile participant={p} />
                </div>
              ))}
            </div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── General case: use computed best grid (4, 6, 7+) ──────
  const { cols, tileW, tileH } = solution;

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ padding: TILE_PADDING_Y }}>
      <motion.div
        layout
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${tileW}px)`,
          gridAutoRows: `${tileH}px`,
          gap: `${TILE_GAP}px`,
        }}
      >
        <AnimatePresence>
          {participants.map((p) => (
            <MotionTile key={p.id} participant={p} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── SPEAKER LAYOUT — dominant speaker + scrollable strip ─
// ═══════════════════════════════════════════════════════════

function SpeakerLayout({
  activeSpeaker,
  others,
}: {
  activeSpeaker: Participant;
  others: Participant[];
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const obs = new ResizeObserver(updateScrollState);
    obs.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      obs.disconnect();
    };
  }, [updateScrollState, others.length]);

  const scroll = (dir: "left" | "right") => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" });
  };

  return (
    <div className="flex-1 flex flex-col gap-2 p-2 sm:p-3 overflow-hidden">
      {/* Main speaker */}
      <div className="flex-1 min-h-0">
        <motion.div
          layout
          layoutId={`tile-${activeSpeaker.id}`}
          className="w-full h-full"
        >
          <ParticipantTile participant={activeSpeaker} isLarge />
        </motion.div>
      </div>

      {/* Filmstrip — clean avatar cards */}
      {others.length > 0 && (
        <div className="shrink-0 relative group">
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-opacity opacity-0 group-hover:opacity-100"
              style={{
                backgroundColor: "var(--mt-bg-elevated)",
                color: "var(--mt-text)",
                border: "1px solid var(--mt-border)",
              }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          <div ref={stripRef} className="flex gap-2.5 overflow-x-auto no-scrollbar py-1.5 px-1 scroll-smooth">
            <AnimatePresence>
              {others.map((p) => {
                const initials = p.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <motion.div
                    key={p.id}
                    layout
                    layoutId={`tile-${p.id}`}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={TILE_TRANSITION}
                    className="shrink-0 flex items-center gap-2 px-2.5 py-2 rounded-xl transition-shadow hover:shadow-md"
                    style={{
                      backgroundColor: "var(--mt-bg-tile)",
                      border: "1px solid var(--mt-border)",
                    }}
                  >
                    {/* Avatar circle */}
                    <div
                      className="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{
                        backgroundColor: "var(--mt-avatar-bg, var(--mt-bg-tile-alt))",
                        color: "var(--mt-avatar-text, var(--mt-text))",
                      }}
                    >
                      {initials}
                      {/* Speaking ring */}
                      {p.isSpeaking && (
                        <span className="absolute inset-0 rounded-full ring-2 ring-brand-green animate-pulse" />
                      )}
                    </div>
                    {/* Name + status */}
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-[11px] font-medium truncate max-w-[72px]"
                        style={{ color: "var(--mt-text)" }}
                      >
                        {p.name.split(" ")[0]}
                      </span>
                      <span
                        className="text-[9px] truncate"
                        style={{ color: p.isMuted ? "var(--mt-text-faint)" : "var(--color-brand-green)" }}
                      >
                        {p.isMuted ? "Muted" : "Speaking"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-opacity opacity-0 group-hover:opacity-100"
              style={{
                backgroundColor: "var(--mt-bg-elevated)",
                color: "var(--mt-text)",
                border: "1px solid var(--mt-border)",
              }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {others.length > 5 && (
            <div
              className="absolute -top-2 -right-1 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-sm"
              style={{
                backgroundColor: "var(--mt-bg-elevated)",
                color: "var(--mt-text-muted)",
                border: "1px solid var(--mt-border)",
              }}
            >
              <Users className="w-3 h-3" />
              {others.length + 1}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── SPOTLIGHT LAYOUT ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function SpotlightLayout({ participants }: { participants: Participant[] }) {
  const [focusIndex, setFocusIndex] = useState(0);
  const count = participants.length;
  const idx = Math.min(focusIndex, count - 1);
  const focused = participants[idx];

  const prev = useCallback(() => setFocusIndex((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setFocusIndex((i) => (i + 1) % count), [count]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next]);

  if (!focused) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 relative min-h-0">
        <motion.div
          layout
          layoutId={`tile-${focused.id}`}
          className="w-full h-full max-w-6xl"
        >
          <ParticipantTile participant={focused} isLarge />
        </motion.div>

        {count > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-10"
              style={{
                backgroundColor: "var(--mt-bg-elevated)",
                color: "var(--mt-text)",
                border: "1px solid var(--mt-border)",
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-10"
              style={{
                backgroundColor: "var(--mt-bg-elevated)",
                color: "var(--mt-text)",
                border: "1px solid var(--mt-border)",
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-3 overflow-x-auto no-scrollbar">
          {participants.map((p, i) => {
            const initials = p.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const isActive = i === idx;
            return (
              <button
                key={p.id}
                onClick={() => setFocusIndex(i)}
                className={cn(
                  "shrink-0 flex flex-col items-center gap-1.5 transition-all duration-200",
                  isActive ? "opacity-100 scale-105" : "opacity-50 hover:opacity-80",
                )}
              >
                {/* Circular avatar */}
                <div
                  className={cn(
                    "relative rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200",
                    isActive ? "w-12 h-12 ring-2 ring-brand-green ring-offset-2" : "w-10 h-10",
                  )}
                  style={{
                    backgroundColor: "var(--mt-avatar-bg, var(--mt-bg-tile-alt))",
                    color: "var(--mt-avatar-text, var(--mt-text))",
                    ["--tw-ring-offset-color" as string]: "var(--mt-bg)",
                  }}
                >
                  {initials}
                  {/* Mute indicator dot */}
                  {p.isMuted && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "var(--mt-bg-elevated)", border: "1.5px solid var(--mt-border)" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    </span>
                  )}
                </div>
                {/* Name */}
                <span
                  className={cn(
                    "text-[10px] font-medium truncate max-w-[56px]",
                    isActive ? "font-semibold" : "",
                  )}
                  style={{ color: isActive ? "var(--mt-text)" : "var(--mt-text-muted)" }}
                >
                  {p.name.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── SCREEN SHARE LAYOUT (unchanged behaviour, polished tiles) ─
// ═══════════════════════════════════════════════════════════

function ScreenShareLayout({
  participants,
  screenSharer,
  isCurrentUserSharing,
  onStopSharing,
  currentUserId,
}: {
  participants: Participant[];
  screenSharer: Participant | undefined;
  isCurrentUserSharing: boolean;
  onStopSharing: () => void;
  currentUserId: string;
}) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const sharerName = screenSharer?.name ?? "You";
  const isMe = isCurrentUserSharing || screenSharer?.id === currentUserId;

  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current && screenSharer?.screenTrack) {
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream.getVideoTracks()[0] === screenSharer.screenTrack) return;
      }
      videoRef.current.srcObject = new MediaStream([screenSharer.screenTrack]);
      videoRef.current.play().catch((e) => {
        if (e.name !== 'AbortError') console.warn("Screen share play failed:", e);
      });
    }
  }, [screenSharer?.screenTrack]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-1.5 sm:gap-2 p-1.5 sm:p-3 overflow-hidden">
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden transition-all duration-300",
          isFullscreen ? "fixed inset-2 z-50" : "flex-1 min-h-0 min-w-0",
        )}
        style={{
          backgroundColor: "var(--mt-bg-screen)",
          border: "1px solid var(--mt-border)",
        }}
      >
        <div className="absolute inset-0 flex flex-col">
          <div
            className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 backdrop-blur-sm shrink-0 z-10"
            style={{
              backgroundColor: "var(--mt-bg-screen)",
              borderBottom: "1px solid var(--mt-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-blue-500/15 text-blue-400 px-2 sm:px-2.5 py-1 rounded-lg">
                <MonitorUp className="w-3.5 h-3.5" />
                <span className="text-[11px] sm:text-xs font-semibold">
                  {isMe ? "You are sharing" : `${sharerName} is sharing`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--mt-text-faint)" }}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              {isMe && (
                <button
                  onClick={onStopSharing}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-xs font-semibold transition-all duration-200 active:scale-95"
                >
                  <MonitorOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Stop Sharing</span>
                  <span className="sm:hidden">Stop</span>
                </button>
              )}
            </div>
          </div>

          {/* Screen content */}
          <div
            className="flex-1 relative flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: "var(--mt-bg-screen)" }}
          >
            {isMe ? (
              // Show mock UI for the person sharing (to avoid infinity mirror effect)
              <div
                className="flex-1 flex items-center justify-center w-full h-full"
                style={{
                  background:
                    "linear-gradient(to bottom right, var(--mt-bg-screen-grad1), var(--mt-bg-screen), var(--mt-bg-screen-grad2))",
                }}
              >
                <div className="flex flex-col items-center gap-3 sm:gap-4 text-center px-4 sm:px-6 max-w-lg">
                  <div
                    className="w-full max-w-md aspect-[16/10] rounded-xl p-4 sm:p-6 flex flex-col gap-2 sm:gap-3 shadow-2xl"
                    style={{
                      backgroundColor: "var(--mt-bg-screen-content)",
                      border: "1px solid var(--mt-border)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-400/60" />
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-400/60" />
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-400/60" />
                      <div className="ml-2 sm:ml-3 h-3 sm:h-4 w-24 sm:w-40 rounded" style={{ backgroundColor: "var(--mt-bg-control)" }} />
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5 sm:gap-2 pt-1 sm:pt-2">
                      <div className="h-4 sm:h-5 w-3/4 rounded" style={{ backgroundColor: "var(--mt-text-whisper)" }} />
                      <div className="h-2.5 sm:h-3 w-full rounded" style={{ backgroundColor: "var(--mt-bg-control)" }} />
                      <div className="h-2.5 sm:h-3 w-5/6 rounded" style={{ backgroundColor: "var(--mt-bg-control)" }} />
                      <div className="h-2.5 sm:h-3 w-2/3 rounded" style={{ backgroundColor: "var(--mt-bg-control)" }} />
                      <div className="mt-2 sm:mt-3 flex gap-1.5 sm:gap-2">
                        <div className="h-10 sm:h-16 flex-1 rounded-lg bg-blue-500/10 border border-blue-500/10" />
                        <div className="h-10 sm:h-16 flex-1 rounded-lg bg-green-500/10 border border-green-500/10" />
                        <div className="h-10 sm:h-16 flex-1 rounded-lg bg-purple-500/10 border border-purple-500/10" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" style={{ color: "var(--mt-text-ghost)" }}>
                    <MousePointerClick className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-[11px] sm:text-xs">
                      Your screen is being shared to the room
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Show actual video feed for viewers
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      </div>

      {/* Participant filmstrip */}
      <div className={cn("shrink-0 overflow-hidden no-scrollbar", isFullscreen && "hidden")}>
        <div className="flex lg:hidden gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {participants.map((p) => (
            <div key={p.id} className="w-24 sm:w-32 shrink-0">
              <ParticipantTile participant={p} fixedAspect />
            </div>
          ))}
        </div>
        <div className="hidden lg:flex flex-col gap-2 w-44 xl:w-52 overflow-y-auto no-scrollbar h-full">
          {participants.map((p) => (
            <div key={p.id} className="w-full shrink-0">
              <ParticipantTile participant={p} fixedAspect />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── eCinema Layout (unchanged) ───────────────────────────
// ═══════════════════════════════════════════════════════════

function ECinemaLayout({ eCinemaLink, participants }: { eCinemaLink: string; participants: Participant[] }) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const { broadcastECinema } = useMeeting();

  const getEmbedUrl = (url: string) => {
    try {
      if (url.includes("youtube.com/watch")) {
        const videoId = new URL(url).searchParams.get("v");
        if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      }
      if (url.includes("youtu.be/")) {
        const videoId = new URL(url).pathname.slice(1);
        if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      }
      return url;
    } catch {
      return url;
    }
  };

  const embedUrl = getEmbedUrl(eCinemaLink);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-1.5 sm:gap-2 p-1.5 sm:p-3 overflow-hidden">
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden transition-all duration-300 flex-1 flex flex-col",
          isFullscreen ? "fixed inset-2 z-50" : "min-h-0 min-w-0",
        )}
        style={{
          backgroundColor: "black",
          border: "1px solid var(--mt-border)",
        }}
      >
        <div
          className="flex items-center justify-between px-3 py-2 backdrop-blur-sm shrink-0 z-10 absolute top-0 w-full"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-semibold drop-shadow-md">eCinema Broadcast</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg transition-colors text-white hover:bg-white/20"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => broadcastECinema(null)}
              className="px-2 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors"
            >
              Stop
            </button>
          </div>
        </div>

        <div className="flex-1 w-full h-full bg-black">
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      <div className={cn("shrink-0 overflow-hidden no-scrollbar", isFullscreen && "hidden")}>
        <div className="flex lg:hidden gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {participants.map((p) => (
            <div key={p.id} className="w-24 sm:w-32 shrink-0">
              <ParticipantTile participant={p} fixedAspect />
            </div>
          ))}
        </div>
        <div className="hidden lg:flex flex-col gap-2 w-44 xl:w-52 overflow-y-auto no-scrollbar h-full">
          {participants.map((p) => (
            <div key={p.id} className="w-full shrink-0">
              <ParticipantTile participant={p} fixedAspect />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}