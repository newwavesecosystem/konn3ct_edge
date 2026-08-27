"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMeeting } from "@/lib/meeting-context";
import { ParticipantTile } from "./ParticipantTile";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/types/meeting";
import { computeDynamicGrid, type GridSolution } from "@/lib/grid-layout";
import {
  MonitorOff,
  MonitorUp,
  Maximize2,
  Minimize2,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
  Users,
  RefreshCw,
  AlertTriangle,
  RotateCw,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useVideoHealth } from "@/hooks/useVideoHealth";

import YouTube from "react-youtube";
import { useVirtualizer } from "@tanstack/react-virtual";

export function StageView() {
  const { participants, layoutMode, isScreenSharing, toggleScreenShare, currentUser, eCinemaLink, webrtcClientRef } =
    useMeeting();

  const screenSharers = participants.filter((p) => p.isScreenSharing);
  const [activeScreenSharerId, setActiveScreenSharerId] = useState<string | null>(null);

  useEffect(() => {
    if (activeScreenSharerId && !screenSharers.find((p) => p.id === activeScreenSharerId)) {
      setActiveScreenSharerId(null);
    }
  }, [screenSharers, activeScreenSharerId]);

  const screenSharer = screenSharers.find(p => p.id === activeScreenSharerId) || screenSharers[0];
  const isSomeoneSharing = !!screenSharer || isScreenSharing;

  // Grid view sorting (no active speaker rearranging)
  const gridSorted = useMemo(() => {
    return [...participants].filter(p => p.role !== 'bot' && p.role !== 'recorder').sort((a, b) => {
      if (a.isCameraOn !== b.isCameraOn) return a.isCameraOn ? -1 : 1;
      return 0;
    });
  }, [participants]);

  // Speaker view sorting (uses active speaker)
  const speakerSorted = useMemo(() => {
    return [...participants].filter(p => p.role !== 'bot' && p.role !== 'recorder').sort((a, b) => {
      if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
      if (a.isCameraOn !== b.isCameraOn) return a.isCameraOn ? -1 : 1;
      return 0;
    });
  }, [participants]);

  if (eCinemaLink) {
    return <ECinemaLayout eCinemaLink={eCinemaLink} participants={gridSorted} />;
  }

  if (isSomeoneSharing) {
    return (
      <ScreenShareLayout
        participants={gridSorted}
        screenSharer={screenSharer}
        screenSharers={screenSharers}
        activeScreenSharerId={activeScreenSharerId || screenSharer?.id}
        setActiveScreenSharerId={setActiveScreenSharerId}
        isCurrentUserSharing={isScreenSharing}
        onStopSharing={toggleScreenShare}
        currentUserId={currentUser.id}
      />
    );
  }

  const activeSpeaker = speakerSorted[0] || gridSorted[0];
  const others = gridSorted; // Keep all participants in the strip to prevent swapping/rearranging

  if (layoutMode === "grid") {
    return <GridLayout participants={gridSorted} />;
  }

  if (layoutMode === "spotlight") {
    return <SpotlightLayout participants={gridSorted} />;
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

  // Hoist hooks for scroll mode to avoid conditional hook call errors
  const { cols, tileH } = computeScrollableGrid(containerSize.w);
  const rowCount = Math.ceil(count / cols);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => tileH + TILE_GAP,
    overscan: 2,
  });

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
  // (Hooks hoisted to top to avoid conditional call errors)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" ref={containerRef}>
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "var(--mt-scrollbar-thumb, rgba(0,0,0,0.15)) transparent",
          paddingRight: 4,
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize() + TILE_PADDING_Y * 2}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const rowStartIndex = virtualRow.index * cols;
            const rowParticipants = participants.slice(rowStartIndex, rowStartIndex + cols);
            
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${tileH}px`,
                  transform: `translateY(${virtualRow.start + TILE_PADDING_Y}px)`,
                  padding: `0 ${TILE_PADDING_X}px`,
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: `${TILE_GAP}px`,
                }}
              >
                {rowParticipants.map((p) => (
                  <MotionTile key={p.id} participant={p} />
                ))}
              </div>
            );
          })}
        </div>

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
  const { currentUser } = useMeeting();
  const count = participants.length;
  const paddingX = TILE_PADDING_X;
  const paddingY = TILE_PADDING_Y;
  const gap = TILE_GAP;

  // Hooks always run.
  const solution = useMemo(
    () => computeDynamicGrid(count, containerW, containerH, paddingX, paddingY, gap),
    [count, containerW, containerH, paddingX, paddingY, gap],
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
        <div className="w-full aspect-video max-h-full flex justify-center">
          <MotionTile participant={participants[0]} isLarge />
        </div>
      </div>
    );
  }

  // ── 2 participants: side-by-side on wide, stacked on narrow ──
  if (count === 2) {
    const isPortrait = containerW < containerH * 1.1;
    return (
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div
          className={cn(
            "w-full flex gap-2.5 sm:gap-3",
            isPortrait ? "flex-col h-full items-center" : "flex-row items-center",
          )}
        >
          <AnimatePresence>
            {participants.map((p) => (
              <div key={p.id} className="flex-1 min-w-0 min-h-0 w-full flex justify-center">
                <div className="w-full max-h-full aspect-video">
                  <MotionTile participant={p} isLarge />
                </div>
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── General case: use computed best grid (4, 6, 7+) ──────
  const { cols, tileW, tileH } = solution;

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ padding: paddingY }}>
      <motion.div
        layout
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${tileW}px)`,
          gridAutoRows: `${tileH}px`,
          gap: `${gap}px`,
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
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence>
          <motion.div
            key={activeSpeaker.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full"
          >
            <ParticipantTile participant={activeSpeaker} isLarge />
          </motion.div>
        </AnimatePresence>
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
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={TILE_TRANSITION}
                    className="shrink-0 w-40 h-24 rounded-xl overflow-hidden shadow-sm"
                  >
                    <ParticipantTile participant={p} fixedAspect />
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
          className="w-full aspect-video max-h-full max-w-6xl"
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
  screenSharers,
  activeScreenSharerId,
  setActiveScreenSharerId,
  isCurrentUserSharing,
  onStopSharing,
  currentUserId,
}: {
  participants: Participant[];
  screenSharer: Participant | undefined;
  screenSharers: Participant[];
  activeScreenSharerId: string | undefined;
  setActiveScreenSharerId: (id: string) => void;
  isCurrentUserSharing: boolean;
  onStopSharing: () => void;
  currentUserId: string;
}) {
  const { webrtcClientRef } = useMeeting();
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [rotation, setRotation] = React.useState<0 | 90 | 180 | 270>(0);
  const contentContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = React.useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Zoom & Pan state (Cross-platform)
  const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3];
  const [zoomIndex, setZoomIndex] = React.useState(0);
  const zoom = ZOOM_STEPS[zoomIndex];
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const handleZoomIn = React.useCallback(() => {
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_STEPS.length - 1));
  }, [ZOOM_STEPS.length]);

  const handleZoomOut = React.useCallback(() => {
    setZoomIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      if (next === 0) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = React.useCallback(() => {
    setZoomIndex(0);
    setPan({ x: 0, y: 0 });
  }, []);

  React.useEffect(() => {
    setRotation(0);
    setZoomIndex(0);
    setPan({ x: 0, y: 0 });
  }, [activeScreenSharerId]);

  React.useEffect(() => {
    const el = contentContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    updateSize();
    const obs = new ResizeObserver(updateSize);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [zoom, pan]);

  const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current || zoom <= 1) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    const maxPanX = ((zoom - 1) * (containerSize.width || 400)) / 2;
    const maxPanY = ((zoom - 1) * (containerSize.height || 300)) / 2;

    const newPanX = Math.max(-maxPanX, Math.min(maxPanX, dragStartRef.current.panX + deltaX));
    const newPanY = Math.max(-maxPanY, Math.min(maxPanY, dragStartRef.current.panY + deltaY));

    setPan({ x: newPanX, y: newPanY });
  }, [isDragging, zoom, containerSize]);

  const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  }, []);

  const sharerName = screenSharer?.name ?? "You";
  const isMe = screenSharer?.id === currentUserId;

  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const { health, remountKey } = useVideoHealth({
    videoRef,
    track: screenSharer?.screenTrack,
    isVisible: true
  });

  const lastVideoElRef = React.useRef<HTMLVideoElement | null>(null);

  const videoCallbackRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el) {
        lastVideoElRef.current = el;
        const attemptPlay = () => {
          if (!el) return;
          el.play().then(() => {
            if (screenSharer && screenSharer.screenStats) {
              screenSharer.screenStats.lastVideoPlayResult = 'success';
              screenSharer.screenStats.lastVideoError = undefined;
            }
          }).catch((e) => {
            if (screenSharer && screenSharer.screenStats) {
              screenSharer.screenStats.lastVideoPlayResult = 'error';
              if (e.name !== 'AbortError') {
                console.warn("Screen share play failed:", e);
                (el as any)._lastError = e.message || e.name;
                screenSharer.screenStats.lastVideoError = e.message || e.name;
              }
            }
          });
        };

        el.onloadedmetadata = attemptPlay;
        el.onloadeddata = () => {
          if (screenSharer && screenSharer.screenStats) {
            screenSharer.screenStats.firstFrameRendered = true;
          }
          attemptPlay();
        };
        el.onplaying = () => {
          if (screenSharer && screenSharer.screenStats) {
            screenSharer.screenStats.firstFrameRendered = true;
          }
        };
        el.oncanplay = attemptPlay;

        if (screenSharer?.screenTrack) {
          if (el.srcObject) {
            const stream = el.srcObject as MediaStream;
            if (stream.getVideoTracks()[0] === screenSharer.screenTrack) {
              attemptPlay();
              return;
            }
            stream.getTracks().forEach(t => stream.removeTrack(t));
            stream.addTrack(screenSharer.screenTrack);
          } else {
            el.srcObject = new MediaStream([screenSharer.screenTrack]);
          }
          attemptPlay();
        } else {
          el.srcObject = null;
        }
      } else {
        if (lastVideoElRef.current) lastVideoElRef.current.srcObject = null;
        lastVideoElRef.current = null;
      }
    },
    [screenSharer?.screenTrack]
  );

  // Auto-retry play on visibility changes
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && videoRef.current && screenSharer?.screenTrack) {
        videoRef.current.play().catch(e => {
          if (e.name !== 'AbortError') console.warn('Safari rebind screen-share play failed', e);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [screenSharer?.screenTrack]);

  // SCREEN-002: Screen share first frame timeout and keyframe request
  const [screenTimeoutState, setScreenTimeoutState] = useState<'normal' | 'recovering' | 'failed'>('normal');
  React.useEffect(() => {
    if (isMe || !screenSharer?.screenConsumerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScreenTimeoutState('normal');
      return;
    }

    if (screenSharer?.screenTrack && screenSharer?.screenStats?.firstFrameRendered) {
      setScreenTimeoutState('normal');
      return;
    }

    webrtcClientRef?.current?.emitTelemetry('screen_first_frame_wait_started');

    const timeout1 = setTimeout(() => {
      // 10 seconds: request keyframe
      if (!screenSharer?.screenStats?.firstFrameRendered) {
        setScreenTimeoutState('recovering');
        webrtcClientRef?.current?.emitTelemetry('screen_keyframe_requested');
        webrtcClientRef?.current?.requestScreenKeyframe(screenSharer.screenConsumerId!);
      }
    }, 10000);

    const timeout2 = setTimeout(() => {
      // 25 seconds: fail
      if (!screenSharer?.screenStats?.firstFrameRendered) {
        setScreenTimeoutState('failed');
        webrtcClientRef?.current?.emitTelemetry('screen_first_frame_timeout');
      }
    }, 25000);

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [isMe, screenSharer?.screenConsumerId, screenSharer?.screenTrack, screenSharer?.screenStats?.firstFrameRendered]);
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const transformParts: string[] = [];
  if (rotation !== 0) transformParts.push(`rotate(${rotation}deg)`);
  if (pan.x !== 0 || pan.y !== 0) transformParts.push(`translate(${pan.x}px, ${pan.y}px)`);
  if (zoom !== 1) transformParts.push(`scale(${zoom})`);
  const transformString = transformParts.length > 0 ? transformParts.join(' ') : undefined;

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
        {screenSharers.length > 1 && (
          <div className="absolute top-4 left-0 right-0 z-30 px-4 flex justify-center pointer-events-none">
            <div className="flex items-center gap-2 p-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-xl overflow-x-auto w-max max-w-full no-scrollbar pointer-events-auto snap-x">
              {screenSharers.map((sharer) => (
                <button
                  key={sharer.id}
                  onClick={() => setActiveScreenSharerId(sharer.id)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-all shrink-0 snap-center max-w-[120px] sm:max-w-[180px]",
                    activeScreenSharerId === sharer.id
                      ? "bg-[var(--color-brand-green)] text-[var(--mt-bg-base)] shadow-md"
                      : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  <span className="truncate block">{sharer.name}&apos;s Screen</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Zoom controls: Out, Reset/Indicator, In (Cross-platform) */}
              <div className="flex items-center bg-black/20 hover:bg-black/40 rounded-lg p-0.5 border border-white/5 transition-colors">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomIndex === 0}
                  className={cn(
                    "p-1 sm:p-1.5 rounded-md transition-colors",
                    zoomIndex === 0 ? "opacity-30 cursor-not-allowed text-gray-400" : "hover:bg-white/10 text-white/80 active:scale-95"
                  )}
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                <button
                  onClick={handleResetZoom}
                  disabled={zoomIndex === 0 && pan.x === 0 && pan.y === 0}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-mono font-medium transition-colors select-none",
                    zoomIndex !== 0 || pan.x !== 0 || pan.y !== 0
                      ? "text-brand-green hover:bg-white/10 font-bold"
                      : "text-white/60"
                  )}
                  title="Click to reset zoom & pan (100%)"
                  aria-label="Reset zoom and pan"
                >
                  {Math.round(zoom * 100)}%
                </button>

                <button
                  onClick={handleZoomIn}
                  disabled={zoomIndex === ZOOM_STEPS.length - 1}
                  className={cn(
                    "p-1 sm:p-1.5 rounded-md transition-colors",
                    zoomIndex === ZOOM_STEPS.length - 1 ? "opacity-30 cursor-not-allowed text-gray-400" : "hover:bg-white/10 text-white/80 active:scale-95"
                  )}
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>

              {/* Mobile-only in-box Rotate button */}
              <button
                onClick={() => setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270)}
                className="md:hidden p-1.5 rounded-lg transition-colors flex items-center justify-center gap-0.5 hover:bg-white/10"
                style={{ color: rotation !== 0 ? "var(--color-brand-green)" : "var(--mt-text-faint)" }}
                title={`Rotate screenshare (${rotation}°)`}
                aria-label="Rotate screenshare"
              >
                <RotateCw className={cn("w-4 h-4 transition-transform duration-300", rotation !== 0 && "text-brand-green")} />
                {rotation !== 0 && (
                  <span className="text-[9px] font-bold text-brand-green leading-none">{rotation}°</span>
                )}
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
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
            ref={contentContainerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="flex-1 relative flex items-center justify-center overflow-hidden touch-none"
            style={{ 
              backgroundColor: "var(--mt-bg-screen)",
              cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default"
            }}
          >
            <div
              className="flex items-center justify-center pointer-events-auto"
              style={
                isRotated90or270 && containerSize.width > 0 && containerSize.height > 0
                  ? {
                      width: `${containerSize.height}px`,
                      height: `${containerSize.width}px`,
                      transform: transformString,
                      transformOrigin: "center center",
                      transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s ease, height 0.3s ease",
                      userSelect: zoom > 1 ? "none" : "auto",
                    }
                  : {
                      width: "100%",
                      height: "100%",
                      transform: transformString,
                      transformOrigin: "center center",
                      transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                      userSelect: zoom > 1 ? "none" : "auto",
                    }
              }
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
                <div className="relative w-full h-full">
                  {(!screenSharer?.screenStats?.consumerExists || !screenSharer?.screenTrack) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
                      <div className="flex flex-col items-center gap-3 text-white">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                        <span className="text-sm font-medium">Connecting screen share...</span>
                      </div>
                    </div>
                  )}
                  {screenSharer?.screenTrack && (health === 'recovering' || screenTimeoutState === 'recovering') && screenTimeoutState !== 'failed' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <div className="flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-md rounded-lg text-white">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                        <span className="text-sm font-medium drop-shadow-md">
                          Recovering screen share...
                        </span>
                      </div>
                    </div>
                  )}
                  {screenSharer?.screenTrack && screenTimeoutState === 'failed' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <div className="flex items-center gap-2 px-4 py-3 bg-red-900/80 backdrop-blur-md rounded-lg text-white border border-red-500/50">
                        <span className="text-sm font-medium drop-shadow-md">
                          Screen share failed to load. Please ask the presenter to restart it.
                        </span>
                      </div>
                    </div>
                  )}

                  <video
                    key={remountKey}
                    ref={videoCallbackRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                      "w-full h-full object-contain",
                      health === 'recovering' && "opacity-50"
                    )}
                  />
                  
                  {health === 'stalled' && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-20">
                      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-900/80 border border-yellow-500/50 rounded-lg text-yellow-100 shadow-lg">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs font-medium">Screen share connection is slow</span>
                      </div>
                    </div>
                  )}
                  
                  {health === 'black' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-black/80">
                      <div className="flex flex-col items-center gap-2 px-6 py-4 bg-red-900/40 rounded-lg text-white border border-red-500/50">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                        <span className="text-sm font-medium drop-shadow-md">
                          Screen share feed failed (Black Screen).
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Participant filmstrip */}
      <div className={cn(
        "shrink-0 overflow-auto no-scrollbar",
        isFullscreen && "hidden",
        "flex lg:flex-col gap-1.5 sm:gap-2",
        "w-full lg:w-44 xl:w-52",
        "py-1 lg:py-0 h-auto lg:h-full"
      )}>
        {participants.map((p) => (
          <div key={p.id} className="w-24 sm:w-32 lg:w-full shrink-0">
            <ParticipantTile participant={p} fixedAspect />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── eCinema Layout (unchanged) ───────────────────────────
// ═══════════════════════════════════════════════════════════

function ECinemaLayout({ eCinemaLink, participants }: { eCinemaLink: string; participants: Participant[] }) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isPlayerReady, setIsPlayerReady] = React.useState(false);
  const { broadcastECinema, currentUser, sendECinemaAction, ecinemaAction } = useMeeting();
  const playerRef = React.useRef<any>(null);

  const extractVideoId = (url: string) => {
    try {
      if (url.includes("youtube.com/watch")) {
        return new URL(url).searchParams.get("v");
      }
      if (url.includes("youtu.be/")) {
        return new URL(url).pathname.slice(1);
      }
      return null;
    } catch {
      return null;
    }
  };

  const videoId = extractVideoId(eCinemaLink);

  // Sync player when receiving actions
  React.useEffect(() => {
    if (isPlayerReady && ecinemaAction && playerRef.current) {
      if (ecinemaAction.action === 'play') {
        playerRef.current.playVideo();
      } else if (ecinemaAction.action === 'pause') {
        playerRef.current.pauseVideo();
      }
      if (ecinemaAction.time !== undefined) {
        // Optional: seekTo if you want to sync time later, but sticking to play/pause for now
        playerRef.current.seekTo(ecinemaAction.time, true);
      }
    }
  }, [ecinemaAction, isPlayerReady]);

  const handlePlay = (e: any) => {
    if (currentUser.role === 'host' || currentUser.role === 'co-host') {
      sendECinemaAction('play', e.target.getCurrentTime());
    }
  };

  const handlePause = (e: any) => {
    if (currentUser.role === 'host' || currentUser.role === 'co-host') {
      sendECinemaAction('pause', e.target.getCurrentTime());
    }
  };

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
          className="flex items-center justify-between px-3 py-2 backdrop-blur-sm shrink-0 z-10 absolute top-0 w-full pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}
        >
          <div className="flex items-center gap-2 pointer-events-auto">
            <span className="text-white text-xs font-semibold drop-shadow-md">eCinema Broadcast</span>
          </div>
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg transition-colors text-white hover:bg-white/20"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            {currentUser.role === 'host' && (
              <button
                onClick={() => broadcastECinema(null)}
                className="px-2 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 w-full h-full bg-black">
          {videoId ? (
            <YouTube
              videoId={videoId}
              opts={{
                width: '100%',
                height: '100%',
                playerVars: {
                  autoplay: 1,
                  controls: currentUser.role === 'host' || currentUser.role === 'co-host' ? 1 : 0, // Only hosts see controls
                  disablekb: currentUser.role === 'host' || currentUser.role === 'co-host' ? 0 : 1, // Disable keyboard for non-hosts
                  rel: 0,
                  modestbranding: 1
                },
              }}
              className="w-full h-full"
              iframeClassName="w-full h-full border-0 pointer-events-auto"
              onReady={(e) => { 
                playerRef.current = e.target; 
                setIsPlayerReady(true);
              }}
              onPlay={handlePlay}
              onPause={handlePause}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              Invalid Video Link
            </div>
          )}
        </div>
      </div>

      <div className={cn(
        "shrink-0 overflow-auto no-scrollbar",
        isFullscreen && "hidden",
        "flex lg:flex-col gap-1.5 sm:gap-2",
        "w-full lg:w-44 xl:w-52",
        "py-1 lg:py-0 h-auto lg:h-full"
      )}>
        {participants.map((p) => (
          <div key={p.id} className="w-24 sm:w-32 lg:w-full shrink-0">
            <ParticipantTile participant={p} fixedAspect />
          </div>
        ))}
      </div>
    </div>
  );
}