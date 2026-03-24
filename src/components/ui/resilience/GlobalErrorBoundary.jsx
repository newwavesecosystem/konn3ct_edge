import React from "react";
import CrashFallbackScreen from "./CrashFallbackScreen";

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("GlobalErrorBoundary caught an error", error, info);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <CrashFallbackScreen
          error={this.state.error}
          onRetry={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
