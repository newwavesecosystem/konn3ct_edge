import React from "react";
import { useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from "react-router-dom";
import CrashFallbackScreen from "./CrashFallbackScreen";
import OfflineFallbackScreen from "./OfflineFallbackScreen";
import useNetworkStatus from "./useNetworkStatus";

const RouteErrorFallback = () => {
  const { t } = useTranslation();
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

  let title = t("components.fallbackScreens.route.title");
  let description = t("components.fallbackScreens.route.description");

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = t("components.fallbackScreens.route.pageNotFoundTitle");
      description = t("components.fallbackScreens.route.pageNotFoundDescription");
    } else {
      title = t("components.fallbackScreens.route.routeErrorTitle", {
        status: error.status,
      });
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
