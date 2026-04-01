import React from "react";
import { useTranslation } from "react-i18next";
import FallbackActions from "./FallbackActions";
import FullscreenFallbackShell from "./FullscreenFallbackShell";

const OfflineFallbackScreen = ({
  onRetry,
  onRefresh,
  onGoBack,
  onGoHome,
}) => {
  const { t } = useTranslation();

  return (
    <FullscreenFallbackShell
      variant="offline"
      title={t("fallback.offlineTitle")}
      description={t("fallback.offlineDescription")}
      actions={
        <FallbackActions
          onRetry={onRetry}
          onRefresh={onRefresh}
          onGoBack={onGoBack}
          onGoHome={onGoHome}
          homeLabel={t("fallback.goToHome")}
        />
      }
    />
  );
};

export default OfflineFallbackScreen;
