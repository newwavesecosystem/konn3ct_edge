import { useEffect, useState, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Assessed quality of the WebRTC connection. */
export type NetworkQuality = 'good' | 'poor' | 'bad' | 'unknown';

/** Options accepted by {@link useNetworkQuality}. */
export interface NetworkQualityOptions {
  /**
   * The `MediasoupService` instance that owns the send transport.
   * Typed as `any` because the service is a plain class — not a Zustand
   * store — and we access internal mediasoup-client properties defensively.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any | null;

  /** Whether the meeting session is currently connected (active). */
  isConnected: boolean;

  /** Fired when quality transitions *to* `'bad'`. */
  onQualityBad?: () => void;

  /** Fired when quality recovers to `'good'` from `'bad'` or `'poor'`. */
  onQualityGood?: () => void;

  /**
   * How often (in ms) to fetch WebRTC stats.
   * @default 5000
   */
  pollIntervalMs?: number;
}

/** Return value of {@link useNetworkQuality}. */
export interface NetworkQualityResult {
  /** Current assessed quality. */
  quality: NetworkQuality;
  /** Latest round-trip time in milliseconds, or `null` if unavailable. */
  rtt: number | null;
  /** Latest outbound packet-loss percentage (0–100), or `null` if unavailable. */
  packetLoss: number | null;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** RTT below this (ms) AND packet-loss below `PL_GOOD` → good. */
const RTT_GOOD = 800;
/** RTT above this (ms) → bad. */
const RTT_BAD = 1500;

/** Packet-loss below this (%) AND RTT below `RTT_GOOD` → good. */
const PL_GOOD = 15;
/** Packet-loss above this (%) → bad. */
const PL_BAD = 25;

/** Number of consecutive "bad" readings before we report `'bad'`. */
const BAD_STREAK_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to reach the underlying `RTCPeerConnection` from a mediasoup
 * `Transport`.  mediasoup-client stores it on the handler; the exact
 * property name has varied between versions and RN-specific handlers.
 */
function getPeerConnection(transport: any): any | null {
  if (!transport) return null;

  const handler = transport._handler ?? transport.handler;
  if (!handler) return null;

  // Try the documented property first, then the underscore-prefixed variant
  // used by some react-native-webrtc handler implementations.
  return handler._pc ?? handler.pc ?? null;
}

/**
 * Classify a single measurement into a raw quality bucket.
 * This does NOT apply the "consecutive bad" rule — that lives in the hook.
 */
function classify(rtt: number | null, packetLoss: number | null): NetworkQuality {
  if (rtt === null && packetLoss === null) return 'unknown';

  const rttBad = rtt !== null && rtt > RTT_BAD;
  const plBad = packetLoss !== null && packetLoss > PL_BAD;

  if (rttBad || plBad) return 'bad';

  const rttPoor = rtt !== null && rtt >= RTT_GOOD;
  const plPoor = packetLoss !== null && packetLoss >= PL_GOOD;

  if (rttPoor || plPoor) return 'poor';

  return 'good';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Polls the send transport's `RTCPeerConnection.getStats()` to monitor
 * round-trip time and packet loss, then maps them to a human-readable
 * {@link NetworkQuality} label.
 *
 * ### Graceful degradation
 * If the service, transport, or peer connection is not (yet) available the
 * hook simply returns `'unknown'` quality and `null` metrics — it never
 * throws.
 *
 * ### Transition callbacks
 * * `onQualityBad` fires when quality first enters `'bad'` (after
 *   {@link BAD_STREAK_THRESHOLD} consecutive bad readings).
 * * `onQualityGood` fires when quality returns to `'good'` from either
 *   `'bad'` or `'poor'`.
 *
 * @example
 * ```tsx
 * const { quality, rtt, packetLoss } = useNetworkQuality({
 *   service: mediasoupService,
 *   isConnected: true,
 *   onQualityBad: () => showToast('Unstable connection'),
 *   onQualityGood: () => showToast('Connection recovered'),
 * });
 * ```
 */
export function useNetworkQuality(options: NetworkQualityOptions): NetworkQualityResult {
  const {
    service,
    isConnected,
    onQualityBad,
    onQualityGood,
    pollIntervalMs = 5000,
  } = options;

  // ---- Render-triggering state -------------------------------------------
  const [quality, setQuality] = useState<NetworkQuality>('unknown');
  const [rtt, setRtt] = useState<number | null>(null);
  const [packetLoss, setPacketLoss] = useState<number | null>(null);

  // ---- Mutable refs (no re-renders) --------------------------------------
  /** Consecutive bad readings. */
  const badStreak = useRef(0);
  /** Previous quality so we can detect transitions. */
  const prevQuality = useRef<NetworkQuality>('unknown');
  /** Cumulative packets-sent as of last poll (for delta calculation). */
  const prevPacketsSent = useRef<number | null>(null);
  /** Cumulative packets-lost as of last poll. */
  const prevPacketsLost = useRef<number | null>(null);

  // Keep callbacks fresh.
  const onQualityBadRef = useRef(onQualityBad);
  const onQualityGoodRef = useRef(onQualityGood);
  useEffect(() => { onQualityBadRef.current = onQualityBad; }, [onQualityBad]);
  useEffect(() => { onQualityGoodRef.current = onQualityGood; }, [onQualityGood]);

  // ---- Reset when service/connection changes -----------------------------
  useEffect(() => {
    badStreak.current = 0;
    prevQuality.current = 'unknown';
    prevPacketsSent.current = null;
    prevPacketsLost.current = null;
    setQuality('unknown');
    setRtt(null);
    setPacketLoss(null);
  }, [service, isConnected]);

  // ---- Core stats-polling callback ---------------------------------------
  const pollStats = useCallback(async () => {
    if (!service || !isConnected) return;

    try {
      // Reach into the mediasoup send transport's underlying RTCPeerConnection.
      // Prefer the public accessor if available, fall back to direct property
      // access for backward compatibility.
      const transport =
        (typeof service.getSendTransport === 'function'
          ? service.getSendTransport()
          : null) ??
        service.sendTransport ??
        (service as any)._sendTransport ??
        null;

      const pc = getPeerConnection(transport);
      if (!pc || typeof pc.getStats !== 'function') {
        // Stats not available yet — don't override a previously-known quality.
        return;
      }

      const stats: RTCStatsReport = await pc.getStats();

      let measuredRtt: number | null = null;
      let totalPacketsSent: number | null = null;
      let totalPacketsLost: number | null = null;

      // Iterate over the stats report.  The shape follows the W3C spec but
      // react-native-webrtc returns a Map-like object.
      stats.forEach((report: any) => {
        // ---- RTT from the nominated ICE candidate pair -------------------
        if (
          report.type === 'candidate-pair' &&
          report.nominated === true &&
          typeof report.currentRoundTripTime === 'number'
        ) {
          // `currentRoundTripTime` is in seconds — convert to ms.
          measuredRtt = report.currentRoundTripTime * 1000;
        }

        // ---- Packet loss from outbound RTP ------------------------------
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          if (typeof report.packetsSent === 'number') {
            totalPacketsSent = (totalPacketsSent ?? 0) + report.packetsSent;
          }
        }

        // `remote-inbound-rtp` carries `packetsLost` for the corresponding
        // outbound stream (reported by the remote peer via RTCP RR).
        if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
          if (typeof report.packetsLost === 'number') {
            totalPacketsLost = (totalPacketsLost ?? 0) + report.packetsLost;
          }
          // Some RN builds surface RTT here as well — use as fallback.
          if (measuredRtt === null && typeof report.roundTripTime === 'number') {
            measuredRtt = report.roundTripTime * 1000;
          }
        }
      });

      // ---- Compute delta packet loss % ----------------------------------
      let lossPercent: number | null = null;

      if (
        totalPacketsSent !== null &&
        totalPacketsLost !== null &&
        prevPacketsSent.current !== null &&
        prevPacketsLost.current !== null
      ) {
        const deltaSent = totalPacketsSent - prevPacketsSent.current;
        const deltaLost = totalPacketsLost - prevPacketsLost.current;

        if (deltaSent > 0) {
          // Total "attempted" = sent + lost-in-delta
          lossPercent = (deltaLost / (deltaSent + deltaLost)) * 100;
          // Clamp to [0, 100] in case of RTCP reporting quirks.
          lossPercent = Math.max(0, Math.min(100, lossPercent));
        }
      }

      prevPacketsSent.current = totalPacketsSent;
      prevPacketsLost.current = totalPacketsLost;

      // ---- Update exposed metrics ---------------------------------------
      setRtt(measuredRtt !== null ? Math.round(measuredRtt) : null);
      setPacketLoss(lossPercent !== null ? Math.round(lossPercent * 10) / 10 : null);

      // ---- Classify ------------------------------------------------------
      const raw = classify(measuredRtt, lossPercent);

      if (raw === 'bad') {
        badStreak.current += 1;
      } else {
        badStreak.current = 0;
      }

      // Only promote to 'bad' after consecutive readings.
      const effective: NetworkQuality =
        raw === 'bad' && badStreak.current < BAD_STREAK_THRESHOLD ? 'poor' : raw;

      setQuality(effective);

      // ---- Fire transition callbacks ------------------------------------
      const prev = prevQuality.current;

      if (effective === 'bad' && prev !== 'bad') {
        onQualityBadRef.current?.();
      }

      if (effective === 'good' && (prev === 'bad' || prev === 'poor')) {
        onQualityGoodRef.current?.();
      }

      prevQuality.current = effective;
    } catch (err) {
      // Stats collection failed — degrade gracefully.
      console.warn('[useNetworkQuality] Failed to poll stats:', err);
    }
  }, [service, isConnected]);

  // ---- Polling interval ----------------------------------------------------
  useEffect(() => {
    if (!service || !isConnected) return;

    // Run once immediately so we don't wait a full interval.
    pollStats();

    const id = setInterval(pollStats, pollIntervalMs);
    return () => clearInterval(id);
  }, [service, isConnected, pollIntervalMs, pollStats]);

  return { quality, rtt, packetLoss };
}
