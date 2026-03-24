import { useEffect, useState } from "react";

const getInitialStatus = () => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
};

const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(getInitialStatus);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);

    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  return { isOnline, isOffline: !isOnline };
};

export default useNetworkStatus;
