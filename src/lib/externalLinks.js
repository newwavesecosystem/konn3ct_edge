const readEnv = (value) => (value ?? "").trim();

export const privacyPolicyUrl = readEnv(
  process.env.REACT_APP_PRIVACY_POLICY_URL
);
export const googleUserInfoUrl = readEnv(
  process.env.REACT_APP_GOOGLE_USERINFO_URL
);
export const facebookSdkUrl = readEnv(process.env.REACT_APP_FACEBOOK_SDK_URL);
export const gettingStartedVideoUrl = readEnv(
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
