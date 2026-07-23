import React, { useMemo } from "react";
import { Lock, Settings2, ShieldAlert, RefreshCw, MicOff, VideoOff, Info } from "lucide-react";

type BrowserType = "chrome" | "firefox" | "safari" | "unknown";

interface PermissionHelpStepsProps {
  deviceType: "microphone" | "camera";
}

export function PermissionHelpSteps({ deviceType }: PermissionHelpStepsProps) {
  const browserType = useMemo<BrowserType>(() => {
    if (typeof window === "undefined") return "unknown";
    const ua = window.navigator.userAgent.toLowerCase();
    
    if (ua.includes("firefox")) {
      return "firefox";
    } else if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium")) {
      return "safari";
    } else if (ua.includes("chrome") || ua.includes("edg")) {
      return "chrome";
    }
    return "unknown";
  }, []);

  const getBrowserInstructions = () => {
    switch (browserType) {
      case "chrome":
        return (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className="bg-brand-gray/10 p-2 rounded-full mt-0.5">
                <Settings2 className="w-5 h-5 text-brand-blue" />
              </div>
              <p className="text-sm" style={{ color: "var(--mt-text-alt)" }}>
                <strong>Step 1:</strong> Click the <span className="font-semibold text-white">site information icon</span> (usually a lock or tune icon) on the left side of your browser&apos;s address bar.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-brand-gray/10 p-2 rounded-full mt-0.5">
                {deviceType === "microphone" ? (
                  <MicOff className="w-5 h-5 text-red-400" />
                ) : (
                  <VideoOff className="w-5 h-5 text-red-400" />
                )}
              </div>
              <p className="text-sm" style={{ color: "var(--mt-text-alt)" }}>
                <strong>Step 2:</strong> Find the <strong>{deviceType === "microphone" ? "Microphone" : "Camera"}</strong> setting and change it to <span className="font-semibold text-green-400">Allow</span>.
              </p>
            </div>
          </div>
        );
      case "firefox":
        return (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className="bg-brand-gray/10 p-2 rounded-full mt-0.5">
                <ShieldAlert className="w-5 h-5 text-brand-blue" />
              </div>
              <p className="text-sm" style={{ color: "var(--mt-text-alt)" }}>
                <strong>Step 1:</strong> Click the <span className="font-semibold text-white">crossed-out icon</span> in your browser&apos;s address bar.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-brand-gray/10 p-2 rounded-full mt-0.5">
                <Info className="w-5 h-5 text-brand-blue" />
              </div>
              <p className="text-sm" style={{ color: "var(--mt-text-alt)" }}>
                <strong>Step 2:</strong> Click the <strong>&apos;X&apos;</strong> next to the blocked permission to remove the restriction.
              </p>
            </div>
          </div>
        );
      case "safari":
        return (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className="bg-brand-gray/10 p-2 rounded-full mt-0.5">
                <Settings2 className="w-5 h-5 text-brand-blue" />
              </div>
              <p className="text-sm" style={{ color: "var(--mt-text-alt)" }}>
                <strong>Step 1:</strong> In the top menu bar, click <strong>Safari &gt; Settings for This Website...</strong>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-brand-gray/10 p-2 rounded-full mt-0.5">
                {deviceType === "microphone" ? (
                  <MicOff className="w-5 h-5 text-red-400" />
                ) : (
                  <VideoOff className="w-5 h-5 text-red-400" />
                )}
              </div>
              <p className="text-sm" style={{ color: "var(--mt-text-alt)" }}>
                <strong>Step 2:</strong> Find the <strong>{deviceType === "microphone" ? "Microphone" : "Camera"}</strong> permission and change it to <span className="font-semibold text-green-400">Allow</span>.
              </p>
            </div>
          </div>
        );
      default:
        // Generic fallback
        return (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className="bg-brand-gray/10 p-2 rounded-full mt-0.5">
                <Lock className="w-5 h-5 text-brand-blue" />
              </div>
              <p className="text-sm" style={{ color: "var(--mt-text-alt)" }}>
                <strong>Step 1:</strong> Click the lock icon in your browser&apos;s address bar to view site permissions.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-brand-gray/10 p-2 rounded-full mt-0.5">
                <RefreshCw className="w-5 h-5 text-brand-blue" />
              </div>
              <p className="text-sm" style={{ color: "var(--mt-text-alt)" }}>
                <strong>Step 2:</strong> Ensure <strong>{deviceType === "microphone" ? "Microphone" : "Camera"}</strong> is allowed.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-black/20 rounded-xl p-4 mb-6 border border-white/5">
      {getBrowserInstructions()}
      <div className="mt-4 pt-4 border-t border-white/10 flex items-start gap-3 text-left">
        <div className="bg-brand-gray/10 p-2 rounded-full mt-0.5">
          <RefreshCw className="w-5 h-5 text-brand-green" />
        </div>
        <p className="text-sm" style={{ color: "var(--mt-text-alt)" }}>
          <strong>Step 3:</strong> Reload the page for the new permissions to take effect.
        </p>
      </div>
    </div>
  );
}
