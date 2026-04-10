const readEnv = (value) => (value ?? "").trim();

const DEFAULT_GETTING_STARTED_VIDEO_URL =
  "https://www.youtube.com/embed/eTFcF4cgNn0";

const normalizeYouTubeEmbedUrl = (value) => {
  const nextValue = readEnv(value);

  if (!nextValue) {
    return DEFAULT_GETTING_STARTED_VIDEO_URL;
  }

  try {
    const url = new URL(nextValue);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const videoId = url.searchParams.get("v");

        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }

      if (url.pathname.startsWith("/embed/")) {
        return nextValue;
      }
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.replace(/^\//, "");

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch (error) {
    return DEFAULT_GETTING_STARTED_VIDEO_URL;
  }

  return nextValue;
};

export const privacyPolicyUrl = readEnv(
  process.env.REACT_APP_PRIVACY_POLICY_URL
);
export const googleUserInfoUrl = readEnv(
  process.env.REACT_APP_GOOGLE_USERINFO_URL
);
export const facebookSdkUrl = readEnv(process.env.REACT_APP_FACEBOOK_SDK_URL);
export const gettingStartedVideoUrl = normalizeYouTubeEmbedUrl(
  process.env.REACT_APP_GETTING_STARTED_VIDEO_URL
);
export const contactSalesUrl = readEnv(
  process.env.REACT_APP_CONTACT_SALES_URL
);

const joinMeetingUrl = readEnv(process.env.REACT_APP_JOIN_MEETING_URL);

export const buildJoinMeetingUrl = (sessionToken) => {
  if (!joinMeetingUrl || !sessionToken) {
    return "";
  }

  try {
    const url = new URL(joinMeetingUrl);
    url.searchParams.set("sessionToken", sessionToken);
    return url.toString();
  } catch (error) {
    return "";
  }
};
