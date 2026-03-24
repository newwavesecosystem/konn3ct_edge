import React from "react";
import OfflineFallbackScreen from "./OfflineFallbackScreen";
import useNetworkStatus from "./useNetworkStatus";

const GlobalNetworkGuard = ({ children }) => {
  const { isOnline } = useNetworkStatus();

  if (!isOnline) {
    return <OfflineFallbackScreen />;
  }

  return children;
};

export default GlobalNetworkGuard;
