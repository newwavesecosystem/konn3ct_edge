import React from "react";
import FallbackActions from "./FallbackActions";
import FullscreenFallbackShell from "./FullscreenFallbackShell";

const CrashFallbackScreen = ({
  error,
  title,
  description,
  onRetry,
  onRefresh,
  onGoBack,
  onGoHome,
}) => {
  const showErrorDetails =
    process.env.NODE_ENV !== "production" ? error?.message : "";

  return (
    <FullscreenFallbackShell
      variant="crash"
      title={title || "We hit an unexpected issue"}
      description={
        description ||
        "Konn3ct could not render this screen safely. Please try again or return to your dashboard."
      }
      details={showErrorDetails}
      actions={
        <FallbackActions
          onRetry={onRetry}
          onRefresh={onRefresh}
          onGoBack={onGoBack}
          onGoHome={onGoHome}
          homeLabel="Go to Dashboard"
        />
      }
    />
  );
};

export default CrashFallbackScreen;
