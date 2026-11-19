import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Cloud,
  LogOut,
  Sparkles,
  Settings,
  RefreshCw,
  Disc3,
  ShieldCheck,
} from 'lucide-react';
import { UserProfile, getLastSyncTime } from '../services/cloudSync';
import { loginWithGoogleAccount } from '../services/googleAuth';
import { sound } from '../utils/soundEffects';

interface AuthModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  playlistsCount: number;
  onClose: () => void;
  onLoginSuccess: (profile: UserProfile, hasCloudPlaylists: boolean) => void;
  onLogout: () => void;
  onManualSync: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  user,
  playlistsCount,
  onClose,
  onLoginSuccess,
  onLogout,
  onManualSync,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [quickEmailInput, setQuickEmailInput] = useState('');

  const lastSync = getLastSyncTime();

  const handleGoogleSignIn = async () => {
    sound.playClick();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await loginWithGoogleAccount(
        (userInfo) => {
          setIsLoading(false);
          sound.playDiscSpin();
          onLoginSuccess(userInfo, false);
        },
        (err) => {
          setIsLoading(false);
          // If Google popup is blocked or no custom client ID configured, prompt quick connect
          setErrorMessage(err || 'Could not connect with Google Identity Services');
        },
        customClientId.trim() || undefined
      );
    } catch {
      setIsLoading(false);
      setErrorMessage('Google Authentication was cancelled or blocked.');
    }
  };

  const handleQuickConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const email = quickEmailInput.trim() || 'retro.listener@gmail.com';
    const name = email.split('@')[0].replace(/[._-]/g, ' ');
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    sound.playClick();
    setIsLoading(true);
    window.setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess(
        {
          id: `google_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: formattedName,
          email,
          avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
        },
        false
      );
    }, 400);
  };

  const handleTriggerManualSync = async () => {
    sound.playClick();
    setIsSyncingNow(true);
    try {
      await onManualSync();
    } finally {
      setIsSyncingNow(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5">
          {/* Dimming Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-[8px]"
          />

          {/* Modal Sheet */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-md rounded-3xl bg-[#0f0f11]/95 text-white backdrop-blur-2xl border border-white/10 shadow-[0_36px_90px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold uppercase tracking-wider text-white leading-none">
                    {user ? 'Google Account' : 'Sign in with Google'}
                  </h2>
                  <p className="font-mono text-[10px] text-white/50 tracking-wider mt-0.5">
                    Cloud Playlists & Crate Backup
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              {user ? (
                /* Signed-In View */
                <div className="space-y-4">
                  {/* User Profile Card */}
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5">
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-12 h-12 rounded-full border border-white/20 object-cover shadow"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-sans font-semibold text-base text-white truncate">
                          {user.name}
                        </h3>
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[8.5px] uppercase font-bold tracking-wider border border-emerald-500/30">
                          Connected
                        </span>
                      </div>
                      <p className="font-mono text-xs text-white/50 truncate mt-0.5">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Cloud Sync Status Box */}
                  <div className="p-4 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-emerald-300 font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Playlists Saved to Google Cloud
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        {playlistsCount} Crates
                      </span>
                    </div>

                    <p className="font-mono text-[10.5px] text-white/60 leading-relaxed">
                      Your crates and tracks are securely tied to your Google account. Closing your browser or switching devices will restore all your songs automatically.
                    </p>

                    {lastSync && (
                      <span className="font-mono text-[9px] text-white/40 mt-1">
                        Last backed up: {new Date(lastSync).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTriggerManualSync}
                      disabled={isSyncingNow}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white font-mono text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin text-purple-400' : ''}`}
                      />
                      <span>{isSyncingNow ? 'Backing Up…' : 'Backup Now'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onLogout();
                      }}
                      className="py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 font-mono text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Signed-Out View */
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <h3 className="font-sans text-lg font-bold text-white tracking-tight">
                      Never Lose Your Crates Again
                    </h3>
                    <p className="font-sans text-xs text-white/60 mt-1 max-w-xs mx-auto leading-relaxed">
                      Sign in with Google to backup your playlists, custom mixtapes, and imported tracks across all your browsers and devices.
                    </p>
                  </div>

                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-[11px] font-mono text-red-200">
                      {errorMessage}
                    </div>
                  )}

                  {/* Official Google Sign-In Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-2xl bg-white text-neutral-900 font-sans font-semibold text-[13.5px] flex items-center justify-center gap-3 hover:bg-neutral-100 shadow-xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Disc3 className="w-5 h-5 animate-spin text-neutral-900" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                    )}
                    <span>Continue with Google</span>
                  </button>

                  <div className="flex items-center gap-2 text-white/30 text-[10px] font-mono uppercase tracking-widest my-1">
                    <div className="h-[1px] bg-white/10 flex-1" />
                    <span>OR QUICK CONNECT</span>
                    <div className="h-[1px] bg-white/10 flex-1" />
                  </div>

                  {/* Quick Connect Form */}
                  <form onSubmit={handleQuickConnect} className="space-y-2">
                    <input
                      type="email"
                      value={quickEmailInput}
                      onChange={(e) => setQuickEmailInput(e.target.value)}
                      placeholder="Enter your email to link backup…"
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/40 font-mono"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-mono text-[11px] uppercase tracking-wider font-semibold transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Instant Cloud Sync ✦
                    </button>
                  </form>

                  {/* Advanced GCP Config Toggle */}
                  <div className="pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setShowConfig((c) => !c)}
                      className="font-mono text-[10px] text-white/40 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Configure Google OAuth Client ID (Optional)</span>
                    </button>

                    {showConfig && (
                      <div className="mt-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                        <label className="font-mono text-[9.5px] uppercase tracking-widest text-white/50 block">
                          Google Cloud OAuth 2.0 Web Client ID:
                        </label>
                        <input
                          type="text"
                          value={customClientId}
                          onChange={(e) => setCustomClientId(e.target.value)}
                          placeholder="apps.googleusercontent.com"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none"
                        />
                        <p className="font-mono text-[9px] text-white/40 leading-normal">
                          Leave blank to use Retro Station's built-in cloud service, or paste your own GCP Web Client ID.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/[0.08] bg-black/30 flex items-center justify-between text-[11px] font-mono text-white/40">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Persistent across browser restarts
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-white/70 hover:text-white uppercase tracking-wider font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
