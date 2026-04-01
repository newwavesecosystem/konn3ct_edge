import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const showErrorDetails =
    process.env.NODE_ENV !== "production" ? error?.message : "";

  return (
    <FullscreenFallbackShell
      variant="crash"
      title={title || t("fallback.crashTitle")}
      description={description || t("fallback.crashDescription")}
      details={showErrorDetails}
      actions={
        <FallbackActions
          onRetry={onRetry}
          onRefresh={onRefresh}
          onGoBack={onGoBack}
          onGoHome={onGoHome}
          homeLabel={t("fallback.goToDashboard")}
        />
      }
    />
  );
};

export default CrashFallbackScreen;
