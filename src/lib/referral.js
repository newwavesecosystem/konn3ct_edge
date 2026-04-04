const REFERRAL_STORAGE_KEY = "konn3ct.referralCode";

export const normalizeReferralCode = (value) => String(value ?? "").trim();

export const getReferralCodeFromRecord = (record = {}) =>
  normalizeReferralCode(
    record.referral_code ??
      record.referralCode ??
      record.ref ??
      record.code ??
      ""
  );

export const getReferralCodeFromSearchParams = (searchParams) => {
  if (!searchParams?.get) return "";

  const referralKeys = ["ref", "referral_code", "referralCode", "code"];

  for (const key of referralKeys) {
    const code = normalizeReferralCode(searchParams.get(key));
    if (code) return code;
  }

  return "";
};

export const getStoredReferralCode = () => {
  if (typeof window === "undefined") return "";

  try {
    return normalizeReferralCode(
      window.sessionStorage.getItem(REFERRAL_STORAGE_KEY)
    );
  } catch {
    return "";
  }
};

export const setStoredReferralCode = (value) => {
  if (typeof window === "undefined") return;

  try {
    const normalizedCode = normalizeReferralCode(value);

    if (normalizedCode) {
      window.sessionStorage.setItem(REFERRAL_STORAGE_KEY, normalizedCode);
      return;
    }

    window.sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Ignore storage failures so the registration flow still works.
  }
};

export const clearStoredReferralCode = () => {
  setStoredReferralCode("");
};

export const buildReferralLink = ({ referralLink = "", referralCode = "" }) => {
  const normalizedLink = String(referralLink ?? "").trim();
  if (normalizedLink) return normalizedLink;

  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) return "";

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const registerPath = `/register?ref=${encodeURIComponent(normalizedCode)}`;

  return origin ? `${origin}${registerPath}` : registerPath;
};

export const getReferralLinkFromRecord = (record = {}) =>
  buildReferralLink({
    referralLink: record.referral_link ?? record.referralLink ?? "",
    referralCode: getReferralCodeFromRecord(record),
  });
