import { useEffect, useRef, useState, useCallback } from 'react';

type VideoHealthStatus = 'healthy' | 'stalled' | 'black' | 'ended' | 'muted' | 'recovering';

interface UseVideoHealthProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  track: MediaStreamTrack | null | undefined;
  isVisible: boolean;
  onRecover?: () => void;
}

const MAX_RECOVERIES = 3;
const RECOVERY_COOLDOWN_MS = 10000; // 10 seconds between recovery attempts

export function useVideoHealth({ videoRef, track, isVisible, onRecover }: UseVideoHealthProps) {
  const [health, setHealth] = useState<VideoHealthStatus>('healthy');
  const [remountKey, setRemountKey] = useState(0); 
  const lastTimeRef = useRef<number>(0);
  const stallCountRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Backoff and loop prevention
  const recoveryCountRef = useRef<number>(0);
  const lastRecoveryTimeRef = useRef<number>(0);

  const logDev = (msg: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[VideoHealth] ${msg}`);
    }
  };

  const checkBlackFrame = useCallback((video: HTMLVideoElement) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 32;
      canvasRef.current.height = 32;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let isBlack = true;
      for (let i = 0; i < imageData.length; i += 4) {
        if (imageData[i] > 5 || imageData[i + 1] > 5 || imageData[i + 2] > 5) {
          isBlack = false;
          break;
        }
      }
      return isBlack;
    } catch (e) {
      return false; 
    }
  }, []);

  const triggerRecovery = useCallback((reason: string) => {
    const now = Date.now();
    if (now - lastRecoveryTimeRef.current < RECOVERY_COOLDOWN_MS) {
      logDev(`Skipping recovery for ${reason}: in cooldown`);
      return;
    }
    if (recoveryCountRef.current >= MAX_RECOVERIES) {
      logDev(`Skipping recovery for ${reason}: max recoveries reached`);
      return;
    }

    logDev(`Initiating recovery due to: ${reason}`);
    recoveryCountRef.current++;
    lastRecoveryTimeRef.current = now;
    
    setHealth('recovering');
    setRemountKey(prev => prev + 1);
    stallCountRef.current = 0;
    if (onRecover) onRecover();
  }, [onRecover]);

  useEffect(() => {
    if (!track) {
      setHealth('healthy'); 
      return;
    }

    const video = videoRef.current;
    if (!video || !isVisible) {
      return; 
    }

    let checkInterval: NodeJS.Timeout;

    const checkHealth = () => {
      if (track.readyState === 'ended') {
        setHealth('ended');
        return;
      }
      if (track.muted || !track.enabled) {
        setHealth('muted');
        return;
      }

      if (video.readyState < 2) {
        stallCountRef.current++;
        if (stallCountRef.current > 5) {
          triggerRecovery('readyState stuck below 2');
        }
        return;
      }

      if (!video.paused) {
        const currentTime = video.currentTime;
        if (currentTime === lastTimeRef.current) {
          stallCountRef.current++;
          if (stallCountRef.current > 4) {
            triggerRecovery('currentTime stalled');
            return;
          }
        } else {
          lastTimeRef.current = currentTime;
          stallCountRef.current = 0;
          setHealth('healthy');
        }
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        stallCountRef.current++;
        if (stallCountRef.current > 5) {
          triggerRecovery('Zero dimensions');
          return;
        }
      }

      // Deterministic throttled canvas sampling only when lightweight signals hint at a problem
      // (e.g. stalled count is rising but we haven't hit the recovery threshold yet)
      if (stallCountRef.current >= 2 && stallCountRef.current <= 4) {
         if (checkBlackFrame(video)) {
            setHealth('black');
            triggerRecovery('black frame detected');
         }
      }
    };

    const handleMute = () => setHealth('muted');
    const handleUnmute = () => setHealth('healthy');
    const handleEnded = () => setHealth('ended');

    track.addEventListener('mute', handleMute);
    track.addEventListener('unmute', handleUnmute);
    track.addEventListener('ended', handleEnded);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logDev('Tab became visible, checking video state...');
        if (video.paused && !track.muted) {
            video.play().catch(e => logDev(`Play failed on visibility change: ${e}`));
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    checkInterval = setInterval(checkHealth, 1000);

    return () => {
      clearInterval(checkInterval);
      track.removeEventListener('mute', handleMute);
      track.removeEventListener('unmute', handleUnmute);
      track.removeEventListener('ended', handleEnded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [track, videoRef, isVisible, checkBlackFrame, triggerRecovery]);

  return { health, remountKey, triggerRecovery };
}
