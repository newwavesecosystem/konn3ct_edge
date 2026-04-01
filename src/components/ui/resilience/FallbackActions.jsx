import React from "react";
import { ArrowLeft, Home, RefreshCw, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../button";

const runBrowserAction = (action) => {
  if (typeof window !== "undefined") {
    action();
  }
};

const defaultHandlers = {
  onRetry: () => runBrowserAction(() => window.location.reload()),
  onRefresh: () => runBrowserAction(() => window.location.reload()),
  onGoBack: () => runBrowserAction(() => window.history.back()),
  onGoHome: () => runBrowserAction(() => window.location.assign("/")),
};

const FallbackActions = ({
  onRetry = defaultHandlers.onRetry,
  onRefresh = defaultHandlers.onRefresh,
  onGoBack = defaultHandlers.onGoBack,
  onGoHome = defaultHandlers.onGoHome,
  homeLabel,
}) => {
  const { t } = useTranslation();
  const resolvedHomeLabel = homeLabel || t("fallback.goToDashboard");

  return (
    <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
      <Button className="w-full" onClick={onRetry}>
        <RotateCcw className="mr-2 h-4 w-4" />
        {t("actions.retry")}
      </Button>

      <Button variant="outline" className="w-full" onClick={onRefresh}>
        <RefreshCw className="mr-2 h-4 w-4" />
        {t("actions.refresh")}
      </Button>

      <Button variant="outline" className="w-full" onClick={onGoBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("actions.goBack")}
      </Button>

      <Button variant="outline" className="w-full" onClick={onGoHome}>
        <Home className="mr-2 h-4 w-4" />
        {resolvedHomeLabel}
      </Button>
    </div>
  );
};

export default FallbackActions;
