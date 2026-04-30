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
      title={t("components.fallbackScreens.offline.title")}
      description={t("components.fallbackScreens.offline.description")}
      actions={
        <FallbackActions
          onRetry={onRetry}
          onRefresh={onRefresh}
          onGoBack={onGoBack}
          onGoHome={onGoHome}
          homeLabel={t("common.actions.goHome")}
        />
      }
    />
  );
};

export default OfflineFallbackScreen;
