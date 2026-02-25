import { scopedStorageKey } from "./user-storage";
const PREF_KEY = "userPreferences";
const PREF_EVENT = "user-preferences-updated";

export const DEFAULT_PREFERENCES = {
  textInput: true,
  voiceInput: true,
  imageInput: true,
  notifications: true,
  darkMode: true,
};

const getPrefKey = (userLike) => scopedStorageKey(PREF_KEY, userLike);

export const readPreferences = (userLike) => {
  try {
    const stored = JSON.parse(localStorage.getItem(getPrefKey(userLike)) || "null");
    return stored ? { ...DEFAULT_PREFERENCES, ...stored } : { ...DEFAULT_PREFERENCES };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

export const writePreferences = (next, userLike) => {
  const merged = { ...DEFAULT_PREFERENCES, ...next };
  localStorage.setItem(getPrefKey(userLike), JSON.stringify(merged));
  window.dispatchEvent(new Event(PREF_EVENT));
  return merged;
};

export const subscribePreferences = (onChange, userLike) => {
  const prefKey = getPrefKey(userLike);
  const handleStorage = (event) => {
    if (event?.key === prefKey) onChange(readPreferences(userLike));
  };

  const handleEvent = () => onChange(readPreferences(userLike));

  window.addEventListener("storage", handleStorage);
  window.addEventListener(PREF_EVENT, handleEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PREF_EVENT, handleEvent);
  };
};
