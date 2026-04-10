import React from "react";
import FallbackActions from "./FallbackActions";
import FullscreenFallbackShell from "./FullscreenFallbackShell";

const OfflineFallbackScreen = ({
  onRetry,
  onRefresh,
  onGoBack,
  onGoHome,
}) => {
  return (
    <FullscreenFallbackShell
      variant="offline"
      title="No internet connection"
      description="You are currently offline. Reconnect to continue using Konn3ct features and live updates."
      actions={
        <FallbackActions
          onRetry={onRetry}
          onRefresh={onRefresh}
          onGoBack={onGoBack}
          onGoHome={onGoHome}
          homeLabel="Go to Home"
        />
      }
    />
  );
};

export default OfflineFallbackScreen;
