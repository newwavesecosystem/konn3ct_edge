"use client";

/* eslint-disable react-hooks/immutability */
import React, { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  VideoOff,
  MonitorUp,
  Hand,
  Crown,
  Shield,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Loader2,
  AlertTriangle,
  Maximize,
  MoreVertical,
  BellRing
} from "lucide-react";
import type { Participant } from "@/lib/types/meeting";
import { useMeeting } from "@/lib/meeting-context";
import { useVideoHealth } from "../../hooks/useVideoHealth";

interface ParticipantTileProps {
  participant: Participant;
  isLarge?: boolean;
  /** When true, the tile constrains itself to 16:9 (used in filmstrips). */
  fixedAspect?: boolean;
  className?: string;
}

const roleIcon: Record<string, React.ReactNode> = {
  host: <Crown className="w-3 h-3 text-yellow-400" />,
  "co-host": <Shield className="w-3 h-3 text-blue-400" />,
};

/**
 * A single participant tile.
 *
 * The tile is *fluid* by default — it fills 100% of its parent on both axes.
 * The parent layout decides the shape (tall, wide, square). This is the key
 * difference from the old version, which forced every tile to `aspect-video`
 * regardless of context.
 *
 * Pass `fixedAspect` to opt into a 16:9 box (used in filmstrips / spotlight
 * thumbnails, where a uniform tile shape matters).
 */
export function getEffectiveVideoState(participant: Participant) {
  if (participant.audioOnlyMode) return 'audio-only';
  if (!participant.isCameraOn) return 'camera-off';
  if (participant.videoTrack) return 'video-active';
  return 'stalled';
}

export function ParticipantTile({
  participant,
  isLarge = false,
  fixedAspect = false,
  className,
}: ParticipantTileProps) {
  const { roomSettings, currentUser, selectedDevices, isMirrorVideoEnabled, pauseRemoteVideo, resumeRemoteVideo, isRecorderMode, isOriginalRatioEnabled, stopParticipantScreenShare, pingParticipant } = useMeeting();
  const [showMenu, setShowMenu] = useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = React.useState(true);
  const [playError, setPlayError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isRecorderMode || (typeof navigator !== 'undefined' && navigator.webdriver)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { root: null, rootMargin: "200px" } // Preload slightly before it enters view
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isRecorderMode]);

  const isSelf = participant.id === currentUser.id;

  const handleRecover = React.useCallback(() => {
    // If recovery is triggered, we can try to re-attach the track to the srcObject
    if (videoRef.current && participant.videoTrack) {
      console.log('participant_tile_video_recovered');
      videoRef.current.srcObject = new MediaStream([participant.videoTrack]);
      videoRef.current.play().catch(e => {
        const isAbort = e.name === 'AbortError' || (e.message && e.message.includes('interrupted by a new load request'));
        if (!isAbort) {
          console.warn("Play failed on recover:", e);
          console.log('participant_tile_video_play_rejected');
          setPlayError(e.message || e.name);
        }
      });
    }
  }, [participant.videoTrack]);

  const { health, remountKey } = useVideoHealth({
    videoRef,
    track: participant.videoTrack,
    isVisible,
    onRecover: handleRecover
  });

  React.useEffect(() => {
    if (!isSelf && participant.videoTrack) {
      if (!isVisible) {
        pauseRemoteVideo(participant.videoTrack.id);
      } else {
        resumeRemoteVideo(participant.videoTrack.id);
      }
    }
  }, [isVisible, isSelf, participant.videoTrack, pauseRemoteVideo, resumeRemoteVideo]);

  const initials = (participant.name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || (participant.name ? participant.name.slice(0, 2).toUpperCase() : "?");

  const toggleFullscreen = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    
    const elem = videoRef.current as any;
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    } else {
      if (elem.requestFullscreen) elem.requestFullscreen().catch(() => {});
      else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
      else if (elem.webkitEnterFullscreen) elem.webkitEnterFullscreen();
    }
  }, []);

  // Camera video ref
  const lastVideoElRef = React.useRef<HTMLVideoElement | null>(null);
  const setVideoRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      // Clean up previous event listeners if needed
      if (lastVideoElRef.current) {
        lastVideoElRef.current.onloadedmetadata = null;
        lastVideoElRef.current.oncanplay = null;
      }

      videoRef.current = el;
      if (el) {
        lastVideoElRef.current = el;

        const attemptPlay = () => {
          if (!el) return;
          participant.cameraStats = participant.cameraStats || {};
          participant.cameraStats.lastVideoPlayAttemptAt = new Date().toISOString();
          
          // Force DOM properties to prevent browser autoplay blocking
          // React sometimes fails to apply the 'muted' attribute in time for play()
          el.muted = true;
          el.playsInline = true;
          
          el.play().then(() => {
             console.log('participant_tile_video_play_started');
             setPlayError(null);
             if (participant.cameraStats) {
               participant.cameraStats.lastVideoPlayResult = 'success';
               participant.cameraStats.lastVideoError = undefined;
             }
          }).catch((e) => {
            console.log('participant_tile_video_play_rejected');
            if (participant.cameraStats) {
              participant.cameraStats.lastVideoPlayResult = 'error';
              const isAbort = e.name === 'AbortError' || 
                              (e.message && e.message.includes('interrupted by a new load request'));
              if (!isAbort) {
                console.warn("Video play failed:", e);
                (el as any)._lastError = e.message || e.name;
                participant.cameraStats.lastVideoError = e.message || e.name;
                console.log('participant_tile_video_error');
                setPlayError(e.message || e.name);
              }
            }
          });
        };

        el.onloadedmetadata = attemptPlay;
        el.oncanplay = attemptPlay;

        if (participant.videoTrack) {
          if (el.srcObject) {
            const stream = el.srcObject as MediaStream;
            if (stream.getVideoTracks()[0] === participant.videoTrack) {
              attemptPlay();
              return;
            }
          }
          el.srcObject = new MediaStream([participant.videoTrack]);
          console.log('participant_tile_video_attached');
          attemptPlay();
        } else {
          el.srcObject = null;
        }
      } else {
        if (lastVideoElRef.current) lastVideoElRef.current.srcObject = null;
        lastVideoElRef.current = null;
      }
    },
    [participant.videoTrack]
  );

  // Handle Safari backgrounding/foregrounding
  React.useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && videoRef.current && participant.videoTrack) {
        // Re-bind to wake up Safari hardware pipeline
        videoRef.current.srcObject = new MediaStream([participant.videoTrack]);
        videoRef.current.play().catch(e => {
            if (e.name !== 'AbortError') console.warn("Visibility video play failed:", e);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handleVisibility);
    };
  }, [participant.videoTrack]);

  const effectiveVideoState = 
    (currentUser.audioOnlyMode && !isSelf) 
      ? 'audio-only' 
      : (isRecorderMode && participant.videoTrack)
          ? 'video-active'
          : getEffectiveVideoState(participant);

  const isCameraEffectivelyOn = effectiveVideoState === 'video-active' && (isVisible || isSelf);

  // Determine diagnosis hint
  let diagnosisHint = 'video-healthy';
  if (participant.audioOnlyMode) diagnosisHint = 'audio-only';
  else if (participant.isCameraOn === false) diagnosisHint = 'camera-off';
  else if (!participant.videoTrack && !participant.cameraStats?.consumerExists) diagnosisHint = 'no-consumer';
  else if (!participant.videoTrack && participant.cameraStats?.consumerExists) diagnosisHint = 'consumer-no-track';
  else if (participant.videoTrack && effectiveVideoState !== 'video-active') diagnosisHint = 'state-blocked-video';
  else if (participant.videoTrack && effectiveVideoState === 'video-active' && health === 'recovering') diagnosisHint = 'safari-playback-stalled';
  else if (participant.videoTrack && effectiveVideoState === 'video-active' && health === 'stalled') diagnosisHint = 'recovery-timeout-unconfirmed';

  // Mutate QA stats for diagnostics overlay
  React.useEffect(() => {
    participant.cameraStats = participant.cameraStats || {};
    
    // Check if time progressed
    if (videoRef.current) {
       const currentTime = videoRef.current.currentTime;
       if (currentTime !== (videoRef.current as any)._lastReportedTime) {
          participant.cameraStats.currentTimeProgressing = true;
          (videoRef.current as any)._lastReportedTime = currentTime;
       } else {
          participant.cameraStats.currentTimeProgressing = false;
       }
       if (health === 'healthy') {
          participant.cameraStats.lastHealthyAt = new Date().toISOString();
       }
    }
    
    participant.cameraStats.videoTrackExists = !!participant.videoTrack;
    participant.cameraStats.remoteTrackReadyState = participant.videoTrack?.readyState;
    participant.cameraStats.remoteTrackMuted = participant.videoTrack?.muted;
    participant.cameraStats.remoteTrackEnabled = participant.videoTrack?.enabled;
    participant.cameraStats.tileRenderMode = effectiveVideoState;
    participant.cameraStats.videoDimensions = videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : '0x0';
    participant.cameraStats.currentTime = videoRef.current?.currentTime || 0;
    participant.cameraStats.readyState = videoRef.current?.readyState || 0;
    participant.cameraStats.videoElementAttached = !!videoRef.current?.srcObject;
    participant.cameraStats.isRecovering = health === 'recovering';
    participant.cameraStats.playbackRecoveryCount = remountKey;
    participant.cameraStats.diagnosisHint = diagnosisHint;
  });

  React.useEffect(() => {
    if (!participant.cameraStats) return;

    if (effectiveVideoState === 'video-active') {
      participant.cameraStats.tileRenderMode = 'video';
    } else if (effectiveVideoState === 'audio-only') {
      participant.cameraStats.tileRenderMode = 'audio-only';
    } else {
      participant.cameraStats.tileRenderMode = 'avatar';
    }
  }, [participant, effectiveVideoState, health]);

  const expectsMedia = isSelf || participant.isCameraOn || !participant.isMuted;
  let mediaConnectionState: string | null = null;
  
  if (expectsMedia && !currentUser.audioOnlyMode) {
    if (participant.networkQuality === 'connecting_to_media_server') {
      mediaConnectionState = "Connecting to Video";
    } else if (participant.networkQuality === 'reconnecting') {
      mediaConnectionState = "Reconnecting to Video";
    } else if (participant.isConnecting) {
      mediaConnectionState = "Connecting...";
    } else if (health === 'black') {
      mediaConnectionState = isSelf 
        ? "Your camera hardware failed." 
        : null; // Remote viewers just see avatar
    } else if (health === 'stalled' || (!isSelf && effectiveVideoState === 'stalled')) {
      mediaConnectionState = null; // Remote viewers see avatar, local user gets toast
    } else if (health === 'recovering') {
      mediaConnectionState = null; // Remote viewers see avatar
    }
  }

  // Toast notifications for the local user
  React.useEffect(() => {
    if (!isSelf) return;

    if (health === 'black') {
      toast.error("Your camera stopped responding. Do you have another meeting/app using your camera?", { id: 'cam-hardware-fail' });
    } else if (health === 'stalled') {
      toast.error("Your video feed seems stuck. Give it a moment to catch up!", { id: 'cam-stalled' });
    } else if (participant.networkQuality === 'reconnecting') {
      toast.error("Your camera connection dropped. We're trying to reconnect it behind the scenes!", { id: 'cam-network-drop' });
    }
  }, [health, participant.networkQuality, isSelf]);

  React.useEffect(() => {
    if (!participant.cameraStats) return;

    if (health === 'healthy') {
      participant.cameraStats.diagnosisHint = 'video-healthy';
    } else if (health === 'stalled') {
      participant.cameraStats.diagnosisHint = 'safari-playback-stalled';
    } else if (health === 'recovering') {
      participant.cameraStats.diagnosisHint = 'recovering-playback';
    }
  }, [health, participant.cameraStats]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full rounded-2xl overflow-hidden group",
        "transition-shadow duration-300",
        fixedAspect && "aspect-video",
        className,
      )}
      style={{
        backgroundColor: "var(--mt-bg-tile)",
      }}
    >
      {/* ── Speaking ring (inset, never clipped by overflow-hidden parents) ── */}
      {participant.isSpeaking && !participant.isMuted && (
        <div className="absolute inset-0 z-20 pointer-events-none rounded-2xl border-[3px] border-brand-green shadow-[inset_0_0_12px_rgba(34,197,94,0.4)]" />
      )}

      {/* ── Video / avatar area ── */}
      {isCameraEffectivelyOn ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={
            isLarge
              ? { backgroundColor: "#111111" }
              : {
                  background:
                    "linear-gradient(135deg, var(--mt-bg-tile-camera), var(--mt-bg-tile), var(--mt-bg-tile-alt2))",
                }
          }
        >
          <video
            key={`main-video-${remountKey}`}
            ref={setVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full h-full",
              isOriginalRatioEnabled ? "object-contain" : "object-cover",
              health === 'recovering' && "opacity-50"
            )}
            style={{
              transform:
                isSelf && isMirrorVideoEnabled ? "scaleX(-1)" : "none",
            }}
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--mt-bg-tile-alt), var(--mt-bg-tile), var(--mt-bg-tile-alt2))",
          }}
        >
          <div className="relative flex flex-col items-center gap-2">
            <div
              className={cn(
                "rounded-full flex items-center justify-center font-bold shadow-lg",
                isLarge ? "w-32 h-32 text-5xl" : "w-28 h-28 text-3xl",
              )}
              style={{
                backgroundColor: "var(--mt-avatar-bg, var(--mt-bg-tile-alt))",
                color: "var(--mt-avatar-text, var(--mt-text))",
                border: "3px solid rgba(255,255,255,0.18)",
              }}
            >
              {initials}
            </div>
            {participant.isSpeaking && !participant.isMuted && (
              <div className="absolute inset-0 rounded-full border-4 border-brand-green/30 animate-pulse-fast scale-110 pointer-events-none" />
            )}
          </div>
          {effectiveVideoState === 'audio-only' && (
            <div className="absolute bottom-6 flex flex-col items-center gap-1">
              <span className="text-white/80 text-xs flex items-center gap-1 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg">
                <SignalLow className="w-3 h-3 text-red-400" /> Audio Only
              </span>
              {participant.videoSuspendedReason === 'network' && (
                <span className="text-yellow-300 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/40">
                  Poor Network
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Hand raised ── */}
      {participant.isHandRaised && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-yellow-500/90 backdrop-blur-sm rounded-full p-1.5 animate-bounce shadow-lg">
            <Hand className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* ── Top-Left Overlays ── */}
      <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-2 pointer-events-none">
        {participant.isScreenSharing && (
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="bg-blue-500/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 text-xs text-white font-medium">
              <MonitorUp className="w-3 h-3" />
              Sharing
            </div>
            {['host', 'admin', 'co-host'].includes(currentUser.role) && participant.id !== currentUser.id && (
              <button 
                onClick={(e) => { e.stopPropagation(); stopParticipantScreenShare(participant.userId); }}
                className="bg-red-500 hover:bg-red-600 transition-colors backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1 text-xs text-white font-medium shadow-sm"
              >
                Stop Share
              </button>
            )}
          </div>
        )}
        
        {['host', 'admin', 'co-host'].includes(currentUser.role) && participant.id !== currentUser.id && (
          <div className="pointer-events-auto relative">
            <button
              className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-sm transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div className="absolute left-0 top-full mt-1 w-40 bg-[var(--mt-bg-elevated)] border border-[var(--mt-border)] rounded-md shadow-lg z-50 py-1 flex flex-col text-sm">
                  <button
                    className="w-full text-left px-3 py-1.5 text-[var(--mt-text)] hover:bg-[var(--mt-bg-hover)] flex items-center gap-2"
                    onClick={(e) => { e.stopPropagation(); pingParticipant(participant.userId); setShowMenu(false); }}
                  >
                    <BellRing className="w-4 h-4 text-[var(--mt-text-muted)]" />
                    Ping participant
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {isCameraEffectivelyOn && (
          <button
            onClick={toggleFullscreen}
            title="Full Screen"
            className="pointer-events-auto bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-md rounded-full p-1.5 text-white/90 shadow-md"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Audio Connection Status (Top-right) ── */}
      {(!participant.isHandRaised) && (() => {
        // Fallback to legacy isMuted if audioConnectionStatus is missing
        const status = participant.audioConnectionStatus || (participant.isMuted ? 'muted' : 'connected');
        
        if (status === 'connected' && !participant.isMuted) return null; // Normal active mic is not shown here

        let icon = null;
        let tooltip = '';
        let wrapperClass = "bg-black/55 backdrop-blur-md rounded-full p-1.5 shadow-md";

        if (status === 'muted' || (status === 'connected' && participant.isMuted)) {
          icon = <MicOff className="w-3.5 h-3.5 text-red-500" />;
          tooltip = 'Muted';
        } else if (status === 'failed') {
          icon = <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
          tooltip = isSelf ? 'Audio connection failed' : 'Audio unavailable';
          wrapperClass = "bg-red-950/80 backdrop-blur-md rounded-full p-1.5 shadow-md border border-red-500/50";
        } else if (status === 'connecting' || status === 'reconnecting') {
          icon = <Mic className="w-3.5 h-3.5 text-amber-400 animate-pulse" />;
          tooltip = status === 'connecting' ? 'Connecting audio...' : 'Reconnecting audio...';
        }

        if (!icon) return null;

        return (
          <div className="absolute top-3 right-3 z-10" title={tooltip}>
            <div className={wrapperClass}>
              {icon}
            </div>
            {isSelf && status === 'failed' && (
              <div className="absolute top-8 right-0 bg-red-950/90 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap border border-red-900/50">
                Check device / retry
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Name pill (bottom-left, no full-width gradient strip) ── */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2 pointer-events-none">
        <div
          className="flex items-center gap-1.5 min-w-0 max-w-full px-2.5 py-1 rounded-lg backdrop-blur-md"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          {roleIcon[participant.role] && (
            <span className="shrink-0">{roleIcon[participant.role]}</span>
          )}
          <span className="text-white text-xs font-medium truncate">
            {participant.name || 'Guest'}
          </span>
          {isSelf && (
            <span className="text-white/60 text-[10px] shrink-0">(You)</span>
          )}
        </div>
        {/* Network quality + camera off indicators */}
        <div className="flex items-center gap-1 shrink-0">
          {!isCameraEffectivelyOn && (
            <VideoOff className="w-3.5 h-3.5 text-red-400 drop-shadow-md" />
          )}
          {roomSettings?.networkDetectionEnabled && participant.networkQuality === 'unstable_network' && (
            <span title="Unstable Network"><SignalMedium className="w-3.5 h-3.5 text-yellow-400 drop-shadow-md" /></span>
          )}
          {roomSettings?.networkDetectionEnabled && participant.networkQuality === 'poor_network' && (
            <span title="Poor Network"><SignalLow className="w-3.5 h-3.5 text-red-500 drop-shadow-md" /></span>
          )}
          {roomSettings?.networkDetectionEnabled && participant.networkQuality === 'device_performance_issue' && (
            <span title="Device Performance Issue"><AlertTriangle className="w-3.5 h-3.5 text-purple-400 drop-shadow-md" /></span>
          )}
          {roomSettings?.networkDetectionEnabled && participant.networkQuality === 'screen_share_performance_issue' && (
            <span title="Screen Share Lag"><MonitorUp className="w-3.5 h-3.5 text-orange-400 drop-shadow-md" /></span>
          )}
          {roomSettings?.networkDetectionEnabled && participant.networkQuality === 'good' && (
            <span title="Good Connection"><SignalHigh className="w-3.5 h-3.5 text-brand-green drop-shadow-md" /></span>
          )}
        </div>
      </div>

      {/* ── Media Connection State Overlay ── */}
      {mediaConnectionState && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/70 text-white font-medium text-sm text-center px-4">
          <div className="flex flex-col items-center gap-2">
            {health === 'black' ? (
               <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : health === 'stalled' ? (
               <AlertTriangle className="w-5 h-5 text-yellow-400" />
            ) : (
               <Loader2 className="w-5 h-5 animate-spin text-brand-green" />
            )}
            <span>{mediaConnectionState}</span>
          </div>
        </div>
      )}
      {/* ── Playback Error Overlay ── */}
      {playError && participant.videoTrack && (
        <div className="absolute top-2 inset-x-2 flex flex-col items-center gap-1 z-40">
          <span className="text-white text-[10px] text-center bg-red-600/90 px-2 py-1 rounded shadow-lg border border-red-400">
            Playback Failed: {playError}
          </span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setPlayError(null);
              if (videoRef.current) videoRef.current.play().catch(console.error);
            }}
            className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

    </div>
  );
}