import React from "react";
import {
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from "react-router-dom";
import CrashFallbackScreen from "./CrashFallbackScreen";
import OfflineFallbackScreen from "./OfflineFallbackScreen";
import useNetworkStatus from "./useNetworkStatus";

const RouteErrorFallback = () => {
  const error = useRouteError();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();

  if (!isOnline) {
    return (
      <OfflineFallbackScreen
        onRetry={() => navigate(0)}
        onRefresh={() => window.location.reload()}
        onGoBack={() => navigate(-1)}
        onGoHome={() => navigate("/")}
      />
    );
  }

  let title = "Something went wrong on this route";
  let description =
    "This page encountered an unexpected problem. You can retry or go back safely.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Page not found";
      description =
        "The page you tried to open does not exist or was moved to a different route.";
    } else {
      title = `Route error (${error.status})`;
      description = error.statusText || description;
    }
  } else if (error instanceof Error && error.message) {
    description = error.message;
  }

  return (
    <CrashFallbackScreen
      error={error}
      title={title}
      description={description}
      onRetry={() => navigate(0)}
      onRefresh={() => window.location.reload()}
      onGoBack={() => navigate(-1)}
      onGoHome={() => navigate("/")}
    />
  );
};

export default RouteErrorFallback;
