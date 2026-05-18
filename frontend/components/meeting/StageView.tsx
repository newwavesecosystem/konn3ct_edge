"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
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

  // Sort: speaking first, then camera-on, then the rest — so active users are always visible
  const sorted = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
      if (a.isCameraOn !== b.isCameraOn) return a.isCameraOn ? -1 : 1;
      return 0;
    });
  }, [participants]);

  const activeSpeaker = sorted[0];
  const others = sorted.filter((p) => p.id !== activeSpeaker.id);

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
// ── GRID LAYOUT — premium adaptive grid ──────────────────
// ═══════════════════════════════════════════════════════════

function GridLayout({ participants }: { participants: Participant[] }) {
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

  // Reset page if participants change
  useEffect(() => { setPage(0); }, [count]);

  // Determine how many tiles per page for pagination (used for 7+ participants)
  const perPage = useMemo(() => {
    if (count <= 6) return count;
    // For 7+, use auto-grid with max 12 per page
    const { w, h } = containerSize;
    const gap = 10;
    const padding = 16;
    const availW = w - padding * 2;
    const availH = h - padding * 2;

    let bestPerPage = 6;
    for (let cols = 2; cols <= 5; cols++) {
      const tileW = (availW - gap * (cols - 1)) / cols;
      let tileH = tileW * (9 / 16);
      const rows = Math.floor((availH + gap) / (tileH + gap));
      const pp = cols * rows;
      if (pp > bestPerPage && tileW >= 120) bestPerPage = pp;
    }
    return Math.min(bestPerPage, 20);
  }, [containerSize, count]);

  const totalPages = count <= 6 ? 1 : Math.ceil(count / perPage);
  const currentPage = Math.min(page, totalPages - 1);
  const visibleParticipants =
    count <= 6
      ? participants
      : participants.slice(currentPage * perPage, currentPage * perPage + perPage);

  const visibleCount = visibleParticipants.length;

  // ── 1 participant: centered hero tile ──
  if (visibleCount === 1) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div
            className="w-full h-full max-w-4xl max-h-full flex items-center justify-center"
          >
            <div
              className="w-full rounded-2xl overflow-hidden shadow-2xl transition-shadow duration-300"
              style={{ maxHeight: '100%', aspectRatio: '16 / 9' }}
            >
              <ParticipantTile participant={visibleParticipants[0]} isLarge />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 2 participants: side-by-side (desktop) / stacked (mobile) ──
  if (visibleCount === 2) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full h-full flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
            {visibleParticipants.map((p) => (
              <div
                key={p.id}
                className="flex-1 min-w-0 min-h-0 flex items-center justify-center max-h-full w-full sm:w-auto"
              >
                <div
                  className="w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
                  style={{ aspectRatio: '16 / 9', maxHeight: '100%' }}
                >
                  <ParticipantTile participant={p} isLarge />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── 3 participants: 2-on-top, 1 centered bottom ──
  if (visibleCount === 3) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full h-full max-w-5xl flex flex-col gap-2.5 sm:gap-3 justify-center">
            {/* Top row: 2 tiles */}
            <div className="flex-1 min-h-0 flex items-center justify-center gap-2.5 sm:gap-3">
              {visibleParticipants.slice(0, 2).map((p) => (
                <div key={p.id} className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
                  <div
                    className="w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
                    style={{ aspectRatio: '16 / 9', maxHeight: '100%' }}
                  >
                    <ParticipantTile participant={p} />
                  </div>
                </div>
              ))}
            </div>
            {/* Bottom row: 1 centered tile */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="w-[calc(50%-6px)] min-w-0 flex items-center justify-center">
                <div
                  className="w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
                  style={{ aspectRatio: '16 / 9', maxHeight: '100%' }}
                >
                  <ParticipantTile participant={visibleParticipants[2]} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 4 participants: 2×2 grid ──
  if (visibleCount === 4) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full h-full max-w-5xl flex flex-col gap-2.5 sm:gap-3 justify-center">
            {[0, 1].map((row) => (
              <div key={row} className="flex-1 min-h-0 flex items-center justify-center gap-2.5 sm:gap-3">
                {visibleParticipants.slice(row * 2, row * 2 + 2).map((p) => (
                  <div key={p.id} className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
                    <div
                      className="w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
                      style={{ aspectRatio: '16 / 9', maxHeight: '100%' }}
                    >
                      <ParticipantTile participant={p} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── 5 participants: 3-on-top, 2 centered bottom ──
  if (visibleCount === 5) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full h-full max-w-6xl flex flex-col gap-2.5 sm:gap-3 justify-center">
            {/* Top row: 3 tiles */}
            <div className="flex-1 min-h-0 flex items-center justify-center gap-2.5 sm:gap-3">
              {visibleParticipants.slice(0, 3).map((p) => (
                <div key={p.id} className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
                  <div
                    className="w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
                    style={{ aspectRatio: '16 / 9', maxHeight: '100%' }}
                  >
                    <ParticipantTile participant={p} />
                  </div>
                </div>
              ))}
            </div>
            {/* Bottom row: 2 centered tiles */}
            <div className="flex-1 min-h-0 flex items-center justify-center gap-2.5 sm:gap-3">
              {visibleParticipants.slice(3, 5).map((p) => (
                <div key={p.id} className="w-[calc(33.333%-6px)] min-w-0 flex items-center justify-center">
                  <div
                    className="w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
                    style={{ aspectRatio: '16 / 9', maxHeight: '100%' }}
                  >
                    <ParticipantTile participant={p} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 6 participants: 3×2 grid ──
  if (visibleCount === 6) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full h-full max-w-6xl flex flex-col gap-2.5 sm:gap-3 justify-center">
            {[0, 1].map((row) => (
              <div key={row} className="flex-1 min-h-0 flex items-center justify-center gap-2.5 sm:gap-3">
                {visibleParticipants.slice(row * 3, row * 3 + 3).map((p) => (
                  <div key={p.id} className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
                    <div
                      className="w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
                      style={{ aspectRatio: '16 / 9', maxHeight: '100%' }}
                    >
                      <ParticipantTile participant={p} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── 7+ participants: auto-computed optimal grid with pagination ──
  const autoGrid = useMemo(() => {
    const padding = 16;
    const gap = 10;
    const w = containerSize.w - padding * 2;
    const h = containerSize.h - padding * 2;

    let bestCols = 1;
    let bestTileW = 0;
    let bestTileH = 0;
    let bestRows = 1;
    const maxCols = Math.min(visibleCount, 6);

    for (let c = 1; c <= maxCols; c++) {
      const r = Math.ceil(visibleCount / c);
      const availW = (w - gap * (c - 1)) / c;
      const availH = (h - gap * (r - 1)) / r;

      let tileW = availW;
      let tileH = tileW * (9 / 16);
      if (tileH > availH) {
        tileH = availH;
        tileW = tileH * (16 / 9);
      }

      const area = tileW * tileH;
      if (area > bestTileW * bestTileH && tileW >= 100) {
        bestCols = c;
        bestRows = r;
        bestTileW = tileW;
        bestTileH = tileH;
      }
    }

    return {
      cols: bestCols,
      rows: bestRows,
      tileW: Math.floor(bestTileW),
      tileH: Math.floor(bestTileH),
    };
  }, [containerSize, visibleCount]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
      <div className="flex-1 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${autoGrid.cols}, ${autoGrid.tileW}px)`,
            gridAutoRows: `${autoGrid.tileH}px`,
            gap: '10px',
          }}
        >
          {visibleParticipants.map((p) => (
            <div
              key={p.id}
              className="w-full h-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
            >
              <ParticipantTile participant={p} />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination controls — only show when needed */}
      {totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-3 py-2 px-4">
          <button
            onClick={() => setPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: "var(--mt-text-muted)", backgroundColor: "var(--mt-bg-control)" }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={cn(
                  "rounded-full transition-all duration-200",
                  i === currentPage
                    ? "w-6 h-2 bg-brand-green"
                    : "w-2 h-2"
                )}
                style={i !== currentPage ? { backgroundColor: "var(--mt-text-ghost)" } : undefined}
              />
            ))}
          </div>

          <button
            onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
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
    return () => { el.removeEventListener("scroll", updateScrollState); obs.disconnect(); };
  }, [updateScrollState, others.length]);

  const scroll = (dir: "left" | "right") => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" });
  };

  return (
    <div className="flex-1 flex flex-col gap-2 p-2 sm:p-3 overflow-hidden">
      {/* Main speaker — takes most of the space */}
      <div className="flex-1 min-h-0">
        <ParticipantTile
          participant={activeSpeaker}
          isLarge
          className="w-full h-full"
        />
      </div>

      {/* Filmstrip — scrollable with nav arrows */}
      {others.length > 0 && (
        <div className="shrink-0 relative group">
          {/* Scroll left arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-opacity opacity-0 group-hover:opacity-100"
              style={{ backgroundColor: "var(--mt-bg-elevated)", color: "var(--mt-text)", border: "1px solid var(--mt-border)" }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Scrollable strip */}
          <div
            ref={stripRef}
            className="flex gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
          >
            {others.map((p) => (
              <div key={p.id} className="w-28 sm:w-36 lg:w-44 shrink-0">
                <ParticipantTile participant={p} />
              </div>
            ))}
          </div>

          {/* Scroll right arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-opacity opacity-0 group-hover:opacity-100"
              style={{ backgroundColor: "var(--mt-bg-elevated)", color: "var(--mt-text)", border: "1px solid var(--mt-border)" }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Participant count badge */}
          {others.length > 5 && (
            <div
              className="absolute -top-1 -right-1 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: "var(--mt-bg-elevated)", color: "var(--mt-text-muted)", border: "1px solid var(--mt-border)" }}
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
// ── SPOTLIGHT LAYOUT — single focus + prev/next nav ──────
// ═══════════════════════════════════════════════════════════

function SpotlightLayout({ participants }: { participants: Participant[] }) {
  const [focusIndex, setFocusIndex] = useState(0);
  const count = participants.length;

  // Keep index in bounds
  const idx = Math.min(focusIndex, count - 1);
  const focused = participants[idx];

  const prev = () => setFocusIndex((i) => (i - 1 + count) % count);
  const next = () => setFocusIndex((i) => (i + 1) % count);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [count]);

  if (!focused) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Focused participant — fills the stage */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 relative min-h-0">
        <ParticipantTile
          participant={focused}
          isLarge
          className="w-full h-full max-w-6xl"
        />

        {/* Navigation arrows — overlaid */}
        {count > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-10"
              style={{ backgroundColor: "var(--mt-bg-elevated)", color: "var(--mt-text)", border: "1px solid var(--mt-border)" }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-10"
              style={{ backgroundColor: "var(--mt-bg-elevated)", color: "var(--mt-text)", border: "1px solid var(--mt-border)" }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Mini thumbnail strip */}
      {count > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
          {participants.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setFocusIndex(i)}
              className={cn(
                "shrink-0 rounded-xl overflow-hidden transition-all duration-200 border-2",
                i === idx
                  ? "border-brand-green w-20 sm:w-24"
                  : "border-transparent w-14 sm:w-16 opacity-60 hover:opacity-100"
              )}
            >
              <ParticipantTile participant={p} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── SCREEN SHARE LAYOUT ──────────────────────────────────
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
  const isMe =
    isCurrentUserSharing || screenSharer?.id === currentUserId;

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-1.5 sm:gap-2 p-1.5 sm:p-3 overflow-hidden">
      {/* ── Shared screen area ──────────────────────── */}
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden transition-all duration-300",
          isFullscreen
            ? "fixed inset-2 z-50"
            : "flex-1 min-h-0 min-w-0"
        )}
        style={{
          backgroundColor: "var(--mt-bg-screen)",
          border: "1px solid var(--mt-border)",
        }}
      >
        {/* Mock shared screen content */}
        <div className="absolute inset-0 flex flex-col">
          {/* Top bar */}
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
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
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

          {/* Screen content mock */}
          <div
            className="flex-1 flex items-center justify-center"
            style={{
              background: `linear-gradient(to bottom right, var(--mt-bg-screen-grad1), var(--mt-bg-screen), var(--mt-bg-screen-grad2))`,
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
                  <div
                    className="ml-2 sm:ml-3 h-3 sm:h-4 w-24 sm:w-40 rounded"
                    style={{ backgroundColor: "var(--mt-bg-control)" }}
                  />
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
                  {isMe
                    ? "Your screen is being shared"
                    : "Viewing shared screen"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Participant filmstrip ── */}
      <div
        className={cn(
          "shrink-0 overflow-hidden no-scrollbar",
          isFullscreen && "hidden"
        )}
      >
        <div className="flex lg:hidden gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {participants.map((p) => (
            <div key={p.id} className="w-24 sm:w-32 shrink-0">
              <ParticipantTile participant={p} />
            </div>
          ))}
        </div>
        <div className="hidden lg:flex flex-col gap-2 w-44 xl:w-52 overflow-y-auto no-scrollbar h-full">
          {participants.map((p) => (
            <div key={p.id} className="w-full shrink-0">
              <ParticipantTile participant={p} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── eCinema Layout ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function ECinemaLayout({ eCinemaLink, participants }: { eCinemaLink: string; participants: Participant[] }) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const { setECinemaLink } = useMeeting();

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
          isFullscreen
            ? "fixed inset-2 z-50"
            : "min-h-0 min-w-0"
        )}
        style={{
          backgroundColor: "black",
          border: "1px solid var(--mt-border)",
        }}
      >
        <div
          className="flex items-center justify-between px-3 py-2 backdrop-blur-sm shrink-0 z-10 absolute top-0 w-full"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
          }}
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
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setECinemaLink(null)}
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

      <div
        className={cn(
          "shrink-0 overflow-hidden no-scrollbar",
          isFullscreen && "hidden"
        )}
      >
        <div className="flex lg:hidden gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {participants.map((p) => (
            <div key={p.id} className="w-24 sm:w-32 shrink-0">
              <ParticipantTile participant={p} />
            </div>
          ))}
        </div>
        <div className="hidden lg:flex flex-col gap-2 w-44 xl:w-52 overflow-y-auto no-scrollbar h-full">
          {participants.map((p) => (
            <div key={p.id} className="w-full shrink-0">
              <ParticipantTile participant={p} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
