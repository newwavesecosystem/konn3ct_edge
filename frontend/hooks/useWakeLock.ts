import { useEffect, useRef, useState } from "react";

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      setIsSupported(true);
    }
  }, []);

  const requestWakeLock = async () => {
    if (!isSupported) return;
    try {
      if (wakeLockRef.current) return;
      
      const wakeLock = await (navigator as any).wakeLock.request("screen");
      wakeLockRef.current = wakeLock;
      setIsLocked(true);
      
      wakeLock.addEventListener("release", () => {
        wakeLockRef.current = null;
        setIsLocked(false);
        console.log("Wake Lock was released");
      });
      console.log("Wake Lock is active!");
    } catch (err: any) {
      console.error(`Wake Lock error: ${err.name}, ${err.message}`);
    }
  };

  const releaseWakeLock = async () => {
    if (!wakeLockRef.current) return;
    try {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsLocked(false);
    } catch (err: any) {
      console.error(`Wake Lock release error: ${err.name}, ${err.message}`);
    }
  };

  // Re-acquire wake lock when document visibility changes to visible
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Request wake lock initially
    requestWakeLock();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isSupported]);

  return { isSupported, isLocked, requestWakeLock, releaseWakeLock };
}
