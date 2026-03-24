import React from "react";
import { ArrowLeft, Home, RefreshCw, RotateCcw } from "lucide-react";
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
  homeLabel = "Go to Dashboard",
}) => {
  return (
    <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
      <Button className="w-full" onClick={onRetry}>
        <RotateCcw className="mr-2 h-4 w-4" />
        Retry
      </Button>

      <Button variant="outline" className="w-full" onClick={onRefresh}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>

      <Button variant="outline" className="w-full" onClick={onGoBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Go Back
      </Button>

      <Button variant="outline" className="w-full" onClick={onGoHome}>
        <Home className="mr-2 h-4 w-4" />
        {homeLabel}
      </Button>
    </div>
  );
};

export default FallbackActions;
