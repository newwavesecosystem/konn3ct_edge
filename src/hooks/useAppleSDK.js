import { useEffect, useState } from "react";

const DEFAULT_APPLE_SIGNIN_SDK_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

const APPLE_SIGNIN_SDK_URL =
  process.env.REACT_APP_APPLE_SIGNIN_SDK_URL || DEFAULT_APPLE_SIGNIN_SDK_URL;

const APPLE_SIGNIN_SCRIPT_ID = "apple-signin-sdk";

const isAppleSdkReady = () =>
  typeof window !== "undefined" && Boolean(window.AppleID?.auth);

export default function useAppleSDK() {
  const [ready, setReady] = useState(isAppleSdkReady);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isAppleSdkReady()) {
      setReady(true);
      setError(false);
      return undefined;
    }

    let script = document.getElementById(APPLE_SIGNIN_SCRIPT_ID);

    if (!script) {
      script = document.createElement("script");
      script.id = APPLE_SIGNIN_SCRIPT_ID;
      script.type = "text/javascript";
      script.src = APPLE_SIGNIN_SDK_URL;
      script.async = true;
      document.body.appendChild(script);
    }

    const handleLoad = () => {
      const nextReady = isAppleSdkReady();
      setReady(nextReady);
      setError(!nextReady);
    };

    const handleError = () => {
      setReady(false);
      setError(true);
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    handleLoad();

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, []);

  return { ready, error };
}
