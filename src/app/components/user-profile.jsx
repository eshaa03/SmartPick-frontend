import { motion, AnimatePresence } from "motion/react";
import {
  User,
  Settings,
  Bell,
  Shield,
  Moon,
  MessageSquare,
  Mic,
  Camera,
  X,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { getPreferences, updatePreferences } from "../../api/preferences";
import {
  DEFAULT_PREFERENCES,
  readPreferences,
  writePreferences,
  subscribePreferences,
} from "../lib/user-preferences";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export function UserProfile() {
  const [preferences, setPreferences] = useState(() => readPreferences());
  const [user, setUser] = useState(() => readUser());
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      const localPrefs = readPreferences();
      try {
        const res = await getPreferences();
        const serverPrefs = res?.data
          ? { ...DEFAULT_PREFERENCES, ...res.data }
          : { ...DEFAULT_PREFERENCES };

        // Keep local values when they already exist to avoid visible auto-flips on page load.
        const merged = { ...serverPrefs, ...localPrefs };
        if (!isMounted) return;
        setPreferences(merged);
        writePreferences(merged);

      } catch (err) {
        console.error("Failed to load preferences", err);
        if (!isMounted) return;
        setPreferences(localPrefs);
        writePreferences(localPrefs);
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);



  const togglePreference = async (key) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    writePreferences(updated);

    if (key === "notifications" && updated.notifications) {
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          const reverted = { ...updated, notifications: false };
          setPreferences(reverted);
          writePreferences(reverted);
          return;
        }
      }
    }
    try {
      await updatePreferences(updated);
    } catch (err) {
      console.error("Failed to save preference", err);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (preferences.darkMode) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
  }, [preferences.darkMode]);


  useEffect(() => {
    const handleStorage = (event) => {
      if (event?.key === "user") {
        setUser(readUser());
      }
    };

    const unsubscribe = subscribePreferences(setPreferences);

    window.addEventListener("storage", handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);


  const displayName = useMemo(
    () => user?.name || user?.username || "SmartPick User",
    [user]
  );
  const displayEmail = useMemo(
    () => user?.email || "user@smartpick.ai",
    [user]
  );

  const inputMethods = [
    { key: "textInput", label: "Text Input", icon: MessageSquare },
    { key: "voiceInput", label: "Voice Input", icon: Mic },
    { key: "imageInput", label: "Image Upload", icon: Camera },
  ];

  const settingsItems = [
    { key: "notifications", label: "Push Notifications", icon: Bell },
    { key: "darkMode", label: "Dark Mode", icon: Moon },
  ];

  const handleMobileLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-3 space-y-6 pb-12 md:pb-8">
      {/* Profile Header */}
      <motion.div className="glass-strong rounded-2xl p-6 border border-slate-700/35">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-teal-700/35 border border-teal-400/35 flex items-center justify-center shadow-[0_0_16px_rgba(45,212,191,0.14)]">
            <User className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">
              {displayName}
            </h2>
            <p className="text-slate-400">{displayEmail}</p>
          </div>
        </div>
      </motion.div>

      {/* Input Methods */}
      <motion.div className="glass-strong rounded-2xl p-6 border border-slate-700/35">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-100">Input Preferences</h3>
          <p className="text-sm text-slate-400 mt-1">
            Choose which input modes stay enabled for your account.
          </p>
        </div>
        {inputMethods.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between p-4 rounded-xl bg-slate-900/35 border border-slate-700/35 mb-2 transition-colors hover:bg-slate-800/35"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-teal-300/90" />
              <span className="text-slate-300">{item.label}</span>
            </div>

            <button
              onClick={() => togglePreference(item.key)}
              aria-label={`Toggle ${item.label}`}
              title={`Toggle ${item.label}`}
              className={`relative w-12 h-6 rounded-full ${
                preferences[item.key]
                  ? "bg-teal-600/85 border border-teal-300/45"
                  : "bg-slate-700/80 border border-slate-600/70"
              } transition-colors`}
            >
              <motion.div
                className="absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-sm"
                animate={{ x: preferences[item.key] ? 24 : 0 }}
              />
            </button>
          </div>
        ))}
      </motion.div>

      {/* SETTINGS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-strong rounded-2xl p-6 border border-slate-700/35"
      >
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-6 h-6 text-teal-300" />
          <h3 className="text-lg font-semibold text-slate-100">
            Settings
          </h3>
        </div>

        {settingsItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between p-4 rounded-xl bg-slate-900/35 border border-slate-700/35 mb-2 transition-colors hover:bg-slate-800/35"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-teal-300/90" />
              <span className="text-slate-300">{item.label}</span>
            </div>

            <button
              onClick={() => togglePreference(item.key)}
              aria-label={`Toggle ${item.label}`}
              title={`Toggle ${item.label}`}
              className={`relative w-12 h-6 rounded-full ${
                preferences[item.key]
                  ? "bg-teal-600/85 border border-teal-300/45"
                  : "bg-slate-700/80 border border-slate-600/70"
              } transition-colors`}
            >
              <motion.div
                className="absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-sm"
                animate={{ x: preferences[item.key] ? 24 : 0 }}
              />
            </button>
          </div>
        ))}

        <button
          onClick={() => setIsPrivacyOpen(true)}
          className="w-full p-4 rounded-xl bg-slate-900/35 border border-slate-700/35 flex items-center gap-3 hover:bg-slate-800/35 transition-colors"
        >
          <Shield className="w-5 h-5 text-teal-300/90" />
          <span className="text-slate-300">Privacy & Security</span>
        </button>
      </motion.div>

      <button
        type="button"
        onClick={handleMobileLogout}
        className="md:hidden w-full rounded-2xl border border-red-300/70 bg-red-100/75 px-4 py-3 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors dark:border-red-400/35 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
      >
        Logout
      </button>

      <AnimatePresence>
        {isPrivacyOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPrivacyOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                className="glass-strong rounded-3xl p-6 w-full max-w-lg border border-slate-700/45"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-100">
                    Privacy & Security
                  </h3>
                  <button
                    onClick={() => setIsPrivacyOpen(false)}
                    className="p-2 rounded-xl hover:bg-slate-700/50 transition-colors"
                    aria-label="Close"
                    title="Close"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-3 text-sm text-slate-300">
                  <p>Your preferences are stored locally for faster access.</p>
                  <p>Notification permission is managed by your browser.</p>
                  <p>You can clear local data by logging out or clearing site storage.</p>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
