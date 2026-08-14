import { useEffect, useRef, useCallback, useState } from 'react';
import type { MediaStream } from 'react-native-webrtc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Current health status of a monitored video track. */
export type VideoHealthStatus = 'healthy' | 'stalled' | 'recovering' | 'failed';

/** Options accepted by {@link useVideoHealth}. */
export interface VideoHealthOptions {
  /** The remote MediaStream whose video track should be monitored. */
  stream: MediaStream | null;

  /**
   * Whether the remote peer is expected to be sending video.
   * When `false` the hook skips all checks and reports 'healthy'.
   */
  hasVideo: boolean;

  /**
   * Fired when the hook detects a stalled video track and wants the
   * consumer to attempt recovery (e.g. bump a key to force an RTCView
   * remount, or re-subscribe to the producer).
   */
  onRecoveryNeeded?: () => void;

  /**
   * How often (in ms) to inspect the video track.
   * @default 2000
   */
  checkIntervalMs?: number;
}

/** Return value of {@link useVideoHealth}. */
export interface VideoHealthResult {
  /** The current health assessment. */
  healthStatus: VideoHealthStatus;
  /** How many recovery attempts have been made for the current stream. */
  recoveryCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of consecutive bad checks before declaring a stall. */
const STALL_THRESHOLD = 3;

/** Maximum automatic recovery attempts before giving up. */
const MAX_RECOVERY_ATTEMPTS = 3;

/** Minimum gap (ms) between two recovery attempts. */
const RECOVERY_COOLDOWN_MS = 10_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Monitors a remote video track for stalls and triggers recovery callbacks.
 *
 * Because React Native uses `RTCView` (not a browser `<video>` element) we
 * cannot sample pixel data.  Instead we rely on the track's observable
 * properties (`readyState`, `enabled`, `muted`) which are updated by the
 * underlying `react-native-webrtc` library when the RTP flow stops.
 *
 * ### Recovery strategy
 * 1. If the track looks bad for {@link STALL_THRESHOLD} consecutive checks the
 *    status moves to `'stalled'`.
 * 2. `onRecoveryNeeded` is called so the parent can bump a key / re-subscribe.
 * 3. The status moves to `'recovering'` for the duration of the cooldown.
 * 4. After {@link MAX_RECOVERY_ATTEMPTS} failed recoveries the status becomes
 *    `'failed'` and no further callbacks are fired.
 *
 * @example
 * ```tsx
 * const { healthStatus, recoveryCount } = useVideoHealth({
 *   stream: participant.stream,
 *   hasVideo: participant.hasVideo,
 *   onRecoveryNeeded: () => setRemountKey(k => k + 1),
 * });
 * ```
 */
export function useVideoHealth(options: VideoHealthOptions): VideoHealthResult {
  const {
    stream,
    hasVideo,
    onRecoveryNeeded,
    checkIntervalMs = 2000,
  } = options;

  // ---- Render-triggering state -------------------------------------------
  const [healthStatus, setHealthStatus] = useState<VideoHealthStatus>('healthy');
  const [recoveryCount, setRecoveryCount] = useState(0);

  // ---- Mutable refs (no re-renders) --------------------------------------
  /** How many consecutive checks have returned a "bad" result. */
  const badCheckCount = useRef(0);
  /** Epoch ms of the last recovery attempt. */
  const lastRecoveryAt = useRef(0);
  /** Total recoveries attempted for the *current* stream identity. */
  const totalRecoveries = useRef(0);

  // Keep the callback ref fresh without re-creating the interval.
  const onRecoveryNeededRef = useRef(onRecoveryNeeded);
  useEffect(() => {
    onRecoveryNeededRef.current = onRecoveryNeeded;
  }, [onRecoveryNeeded]);

  // ---- Reset counters when the stream identity changes -------------------
  useEffect(() => {
    badCheckCount.current = 0;
    lastRecoveryAt.current = 0;
    totalRecoveries.current = 0;
    setHealthStatus('healthy');
    setRecoveryCount(0);
  }, [stream]);

  // ---- Core check callback -----------------------------------------------
  const checkTrackHealth = useCallback(() => {
    // Nothing to monitor — report healthy so consumers don't show warnings.
    if (!stream || !hasVideo) {
      badCheckCount.current = 0;
      setHealthStatus('healthy');
      return;
    }

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      // Stream exists but has no video tracks yet — treat as transient.
      badCheckCount.current = 0;
      setHealthStatus('healthy');
      return;
    }

    const track = videoTracks[0];

    // Determine if the track is in a "good" state.
    const isLive = track.readyState === 'live';
    const isEnabled = track.enabled === true;
    // `muted` on RN tracks reflects the RTP mute state (no packets flowing).
    const isUnmuted = (track as any).muted !== true;
    const isGood = isLive && isEnabled && isUnmuted;

    if (isGood) {
      // ---- Track is healthy ------------------------------------------------
      badCheckCount.current = 0;
      setHealthStatus('healthy');
      return;
    }

    // ---- Track looks bad ---------------------------------------------------
    badCheckCount.current += 1;

    // Already exhausted recovery budget — stay in failed.
    if (totalRecoveries.current >= MAX_RECOVERY_ATTEMPTS) {
      setHealthStatus('failed');
      return;
    }

    // Not enough consecutive failures yet — remain in current status.
    if (badCheckCount.current < STALL_THRESHOLD) {
      return;
    }

    // ---- Stall confirmed – attempt recovery --------------------------------
    const now = Date.now();
    const cooledDown = now - lastRecoveryAt.current >= RECOVERY_COOLDOWN_MS;

    if (!cooledDown) {
      // Still within cooldown window — show recovering.
      setHealthStatus('recovering');
      return;
    }

    // Fire recovery callback.
    setHealthStatus('stalled');
    totalRecoveries.current += 1;
    lastRecoveryAt.current = now;
    setRecoveryCount(totalRecoveries.current);

    // Transition to 'recovering' on the next tick so consumers see the
    // brief 'stalled' status before the cooldown begins.
    setTimeout(() => setHealthStatus('recovering'), 0);

    onRecoveryNeededRef.current?.();
  }, [stream, hasVideo]);

  // ---- Polling interval ----------------------------------------------------
  useEffect(() => {
    if (!stream || !hasVideo) return;

    const id = setInterval(checkTrackHealth, checkIntervalMs);
    return () => clearInterval(id);
  }, [stream, hasVideo, checkIntervalMs, checkTrackHealth]);

  return { healthStatus, recoveryCount };
}
