import { useEffect } from "react";
import { facebookSdkUrl } from "../lib/externalLinks";

export default function useFacebookSDK() {
  useEffect(() => {
    if (document.getElementById("facebook-jssdk") || !facebookSdkUrl) return;

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = facebookSdkUrl;
    document.body.appendChild(script);

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.REACT_APP_FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false, // we don't need XFBML parsing
        version: "v21.0",
      });
    };
  }, []);
}
