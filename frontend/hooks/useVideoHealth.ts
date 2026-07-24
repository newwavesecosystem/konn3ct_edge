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
  const recoveryStartTimeRef = useRef<number>(0);
  const healthyStartTimeRef = useRef<number>(0);

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
    recoveryStartTimeRef.current = now;
    
    setHealth('recovering');
    setRemountKey(prev => prev + 1);
    stallCountRef.current = 0;
    if (onRecover) onRecover();
  }, [onRecover]);

  useEffect(() => {
    if (!track) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHealth('healthy'); 
      return;
    }

    const video = videoRef.current;
    if (!video || !isVisible) {
      return; 
    }

    let checkInterval: NodeJS.Timeout;

    let tickCounter = 0;

    const checkHealth = () => {
      tickCounter++;
      
      // 1. Timeout for recovering state (5 seconds)
      if (health === 'recovering' && recoveryStartTimeRef.current > 0) {
        if (Date.now() - recoveryStartTimeRef.current > 5000) {
          logDev('Recovery overlay timed out, marking as stalled to prevent stuck UI.');
          console.log('participant_tile_video_stalled');
          setHealth('stalled');
          recoveryStartTimeRef.current = 0;
          return; // Skip further checks this tick
        }
      }

      if (track.readyState === 'ended') {
        setHealth('ended');
        return;
      }
      if (track.muted || !track.enabled) {
        setHealth('muted');
        return;
      }

      // 2. Strong indicators of healthy playback
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        const currentTime = video.currentTime;
        
        // If currentTime goes backwards, it means the video remounted.
        if (currentTime < lastTimeRef.current || (currentTime === 0 && lastTimeRef.current > 0)) {
           lastTimeRef.current = currentTime; // Just sync the ref, do not treat as healthy play yet
        } else if (currentTime !== lastTimeRef.current) {
          // Absolute proof of playing
          lastTimeRef.current = currentTime;
          stallCountRef.current = 0;
          if (health !== 'healthy' && health !== 'black') {
             console.log('participant_tile_video_recovered');
             setHealth('healthy');
             recoveryStartTimeRef.current = 0;
             healthyStartTimeRef.current = Date.now();
          } else if (health === 'healthy') {
             if (recoveryCountRef.current > 0 && Date.now() - healthyStartTimeRef.current > 15000) {
                logDev('Video has been healthy for >15s. Resetting recovery cap.');
                recoveryCountRef.current = 0;
             }
          }
        } else {
          // currentTime is stalled
          const isSafariQuirk = currentTime === 0 && !checkBlackFrame(video);
          
          if (isSafariQuirk) {
             stallCountRef.current = 0;
             if (health !== 'healthy') {
                console.log('participant_tile_video_recovered');
                setHealth('healthy');
                recoveryStartTimeRef.current = 0;
                healthyStartTimeRef.current = Date.now();
             }
          } else {
             if (health !== 'recovering' && !video.paused) {
                stallCountRef.current++;
                if (stallCountRef.current > 4) {
                  if (health !== 'stalled') {
                    console.log('participant_tile_video_stalled');
                    setHealth('stalled');
                  }
                  return;
                }
             }
          }
        }
      } else {
        // Missing dimensions or readyState
        if (video.readyState < 2) {
          stallCountRef.current++;
          if (stallCountRef.current > 5) {
            triggerRecovery('readyState stuck below 2');
          }
          return;
        }
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          stallCountRef.current++;
          if (stallCountRef.current > 5) {
            triggerRecovery('Zero dimensions');
            return;
          }
        }
      }

      // 3. Black frame detection
      // Check if stalled, OR check every 5 seconds even if playing smoothly (to catch smooth black videos)
      const shouldCheckBlack = (stallCountRef.current >= 2 && stallCountRef.current <= 4) || (tickCounter % 5 === 0);
      
      if (shouldCheckBlack && video.readyState >= 2) {
         if (checkBlackFrame(video)) {
            if (health !== 'black') {
               setHealth('black');
               console.log('participant_tile_video_black');
            }
            // intentionally NOT calling triggerRecovery here to prevent infinite destruction loops
         } else if (health === 'black') {
            // It recovered from black!
            setHealth('healthy');
            healthyStartTimeRef.current = Date.now();
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
  }, [health, track, videoRef, isVisible, checkBlackFrame, triggerRecovery]);

  return { health, remountKey, triggerRecovery };
}
