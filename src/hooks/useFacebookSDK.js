import { useEffect } from "react";

export default function useFacebookSDK() {
  useEffect(() => {
    if (document.getElementById("facebook-jssdk")) return;

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
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
