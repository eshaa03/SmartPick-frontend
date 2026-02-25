const USER_KEY = "user";
const TOKEN_KEY = "token";

export const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || raw === "undefined") return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const getTokenScopeId = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return "";
    const payload = decodeJwtPayload(token);
    const claimId =
      payload?.sub ||
      payload?.userId ||
      payload?.user_id ||
      payload?.id ||
      payload?.email ||
      payload?.uid ||
      "";
    if (claimId) return String(claimId);

    // Fallback: stable per-token scope to prevent cross-account leakage.
    return `token:${String(token).slice(-24)}`;
  } catch {
    return "";
  }
};

export const getUserScopeId = (userLike) => {
  const user = userLike || readStoredUser();
  const id =
    user?._id ||
    user?.id ||
    user?.email ||
    getTokenScopeId() ||
    "guest";
  return String(id);
};

export const scopedStorageKey = (baseKey, userLike) =>
  `${baseKey}::${getUserScopeId(userLike)}`;
