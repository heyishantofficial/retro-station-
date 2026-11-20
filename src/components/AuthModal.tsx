import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Cloud,
  LogOut,
  Sparkles,
  RefreshCw,
  Disc3,
  ShieldCheck,
  UserCheck,
  Key,
  ExternalLink,
  AlertTriangle,
  Check,
  ArrowRight,
  User,
  Mail,
} from 'lucide-react';
import { UserProfile, getLastSyncTime, syncUserWithBackend } from '../services/cloudSync';
import {
  loginWithGoogleAccount,
  getStoredGoogleClientId,
  setStoredGoogleClientId,
  isValidGoogleClientId,
} from '../services/googleAuth';
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
  const [authMode, setAuthMode] = useState<'direct' | 'google'>('direct');
  const [customName, setCustomName] = useState('Ishant Chauhan');
  const [customEmail, setCustomEmail] = useState('ishantchauhan410@gmail.com');
  const [clientIdInput, setClientIdInput] = useState(() => getStoredGoogleClientId());
  const [isSavedClientId, setIsSavedClientId] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSyncingNow, setIsSyncingNow] = useState(false);

  const lastSync = getLastSyncTime();

  // 1-Click Profile Sign In (Bypasses Google Cloud Console requirement)
  const handleDirectSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customEmail.trim() || !customName.trim()) {
      setErrorMessage('Please provide both your name and email');
      return;
    }

    sound.playClick();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await syncUserWithBackend({
        name: customName.trim(),
        email: customEmail.trim(),
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(customEmail.trim())}`,
      });
      setIsLoading(false);
      sound.playDiscSpin();
      onLoginSuccess(result.user, result.hasCloudPlaylists);
    } catch {
      setIsLoading(false);
      setErrorMessage('Could not connect to Retro Cloud database. Make sure the local server is running.');
    }
  };

  // Official Google OAuth 2.0 Sign In
  const handleGoogleSignIn = async () => {
    sound.playClick();
    setIsLoading(true);
    setErrorMessage(null);

    const activeClientId = clientIdInput.trim() || getStoredGoogleClientId();

    if (!activeClientId) {
      setIsLoading(false);
      setErrorMessage(
        'Google Error 401: invalid_client occurs when no OAuth Client ID is configured. Please paste your Google Cloud Client ID below, or use 1-Tap Profile Sync.'
      );
      return;
    }

    try {
      await loginWithGoogleAccount(
        async (userInfo) => {
          try {
            const syncResult = await syncUserWithBackend(userInfo);
            setIsLoading(false);
            sound.playDiscSpin();
            onLoginSuccess(syncResult.user, syncResult.hasCloudPlaylists);
          } catch {
            setIsLoading(false);
            sound.playDiscSpin();
            onLoginSuccess(userInfo, false);
          }
        },
        (err) => {
          setIsLoading(false);
          setErrorMessage(err || 'Could not connect with Google Identity Services');
        },
        activeClientId
      );
    } catch {
      setIsLoading(false);
      setErrorMessage(
        'Google OAuth was blocked or returned Error 401: invalid_client. Make sure your Google Cloud Client ID matches this origin (e.g. http://localhost:5173).'
      );
    }
  };

  const handleSaveClientId = () => {
    sound.playClick();
    setStoredGoogleClientId(clientIdInput.trim());
    setIsSavedClientId(true);
    setTimeout(() => setIsSavedClientId(false), 2000);
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
          {/* Frosted VisionOS Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          />

          {/* Liquid Glass Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-lg rounded-3xl liquid-glass-drawer text-white flex flex-col overflow-hidden max-h-[90vh] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_24px_80px_rgba(0,0,0,0.7)]"
            style={{
              background: 'linear-gradient(155deg, rgba(22, 28, 44, 0.88) 0%, rgba(10, 13, 24, 0.95) 100%)',
              backdropFilter: 'blur(50px) saturate(200%)',
              WebkitBackdropFilter: 'blur(50px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.20)',
              borderTopColor: 'rgba(255, 255, 255, 0.40)',
            }}
          >
            {/* Specular Ambient Glow */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-emerald-500/12 blur-3xl" />

            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.12] flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-500/30 to-indigo-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_0_16px_rgba(59,130,246,0.3)]">
                  <Cloud className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <span>{user ? 'Google Cloud Account' : 'Cloud Sync & Account'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/35 font-bold uppercase tracking-wider">
                      {user ? 'Connected' : 'Sign In'}
                    </span>
                  </h2>
                  <p className="text-xs text-white/60 mt-0.5">
                    Sync playlists across devices & unlock Community Lounge
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.20] border border-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto space-y-4 relative z-10 max-h-[calc(90vh-140px)]">
              {user ? (
                /* ================= SIGNED-IN PROFILE VIEW ================= */
                <div className="space-y-4">
                  {/* User Profile Card */}
                  <div className="p-4 rounded-2xl liquid-glass-card flex items-center gap-4">
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-12 h-12 rounded-2xl border border-white/30 object-cover shadow-lg ring-2 ring-emerald-400/30 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-white truncate">
                          {user.name}
                        </h3>
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 text-[10px] font-bold tracking-wider border border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.25)] flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      </div>
                      <p className="text-xs text-white/70 truncate mt-1 flex items-center gap-1.5 font-medium">
                        <Mail className="w-3 h-3 text-white/40" />
                        <span>{user.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Cloud Sync Status Box */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-400/30 flex flex-col gap-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-300 font-bold flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
                        <span>Playlists Backed Up to Cloud</span>
                      </span>
                      <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full bg-white/10 border border-white/15">
                        {playlistsCount} {playlistsCount === 1 ? 'Playlist' : 'Playlists'}
                      </span>
                    </div>

                    <p className="text-xs text-white/70 leading-relaxed font-normal">
                      Your tracks and custom crates are automatically saved to your cloud profile. Switching browsers, using mobile, or refreshing will restore all your music seamlessly.
                    </p>

                    {lastSync && (
                      <div className="text-[10px] text-white/50 pt-1 border-t border-white/10 flex items-center justify-between">
                        <span>Last Cloud Backup</span>
                        <span className="font-mono text-emerald-300 font-semibold">
                          {new Date(lastSync).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleTriggerManualSync}
                      disabled={isSyncingNow}
                      className="flex-1 py-2.5 px-4 rounded-xl liquid-glass-pill text-neutral-950 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 shadow-md"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin text-purple-600' : ''}`}
                      />
                      <span>{isSyncingNow ? 'Backing Up…' : 'Backup Now'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onLogout();
                      }}
                      className="py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-200 border border-red-400/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer shadow-sm"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* ================= SIGNED-OUT AUTHENTICATION ================= */
                <div className="space-y-4">
                  {/* Segmented Mode Switcher */}
                  <div className="p-1 rounded-2xl bg-black/40 border border-white/15 backdrop-blur-xl grid grid-cols-2 gap-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setAuthMode('direct');
                        setErrorMessage(null);
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        authMode === 'direct'
                          ? 'liquid-glass-pill text-neutral-950'
                          : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>1-Tap Profile Sync</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-800 font-extrabold uppercase">
                        Instant
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setAuthMode('google');
                        setErrorMessage(null);
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        authMode === 'google'
                          ? 'liquid-glass-pill text-neutral-950'
                          : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Google OAuth 2.0</span>
                    </button>
                  </div>

                  {/* Error Callout */}
                  {errorMessage && (
                    <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-400/35 text-xs text-red-200 leading-relaxed flex items-start gap-2.5 shadow-[0_0_16px_rgba(239,68,68,0.2)]">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-bold text-red-100">Authentication Alert</div>
                        <div className="text-[11px] mt-0.5 text-red-200/90">{errorMessage}</div>
                      </div>
                    </div>
                  )}

                  {/* MODE 1: DIRECT 1-TAP PROFILE SYNC (RECOMMENDED) */}
                  {authMode === 'direct' && (
                    <form onSubmit={handleDirectSignIn} className="space-y-3.5">
                      <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-400/25 text-xs text-blue-200 leading-relaxed">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          <span>No API Keys or Setup Required</span>
                        </div>
                        <p className="text-[11px] text-white/70 mt-1">
                          Instantly connect your account to backup your playlists, save custom mixtapes, and join the Sharing is Caring community lounge.
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1 block">
                            Your Name / Display Alias
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                            <input
                              type="text"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              placeholder="e.g. Ishant Chauhan"
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] focus:bg-white/[0.14] border border-white/20 focus:border-blue-400 text-white text-xs font-semibold focus:outline-none transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1 block">
                            Account Email
                          </label>
                          <div className="relative">
                            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                            <input
                              type="email"
                              value={customEmail}
                              onChange={(e) => setCustomEmail(e.target.value)}
                              placeholder="e.g. ishantchauhan410@gmail.com"
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] focus:bg-white/[0.14] border border-white/20 focus:border-blue-400 text-white text-xs font-semibold focus:outline-none transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-2xl liquid-glass-pill text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-lg disabled:opacity-50 mt-1"
                      >
                        {isLoading ? (
                          <Disc3 className="w-4 h-4 animate-spin text-neutral-900" />
                        ) : (
                          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                        )}
                        <span>Connect Profile & Sync Playlists</span>
                      </button>
                    </form>
                  )}

                  {/* MODE 2: OFFICIAL GOOGLE OAUTH 2.0 (REQUIRES GOOGLE CLOUD CLIENT ID) */}
                  {authMode === 'google' && (
                    <div className="space-y-3.5">
                      {/* Explanatory Banner for Error 401 */}
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/25 text-xs text-amber-200 leading-relaxed">
                        <div className="font-bold text-amber-100 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Why Google Shows &quot;Error 401: invalid_client&quot;</span>
                        </div>
                        <p className="text-[11px] text-white/70 mt-1">
                          Google requires every website to register its own authorized domain in the <strong>Google Cloud Console</strong>. Without your own Client ID, Google rejects the login with Error 401.
                        </p>
                      </div>

                      {/* Official Google Button */}
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-sans font-bold text-xs flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Disc3 className="w-4 h-4 animate-spin text-neutral-900" />
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

                      {/* Google Cloud Client ID Input */}
                      <div className="p-3.5 rounded-2xl liquid-glass-card space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                            <Key className="w-3 h-3 text-amber-300" />
                            <span>Your Google Cloud Client ID</span>
                          </label>
                          {isValidGoogleClientId(clientIdInput) && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                              Valid Format
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={clientIdInput}
                            onChange={(e) => setClientIdInput(e.target.value)}
                            placeholder="e.g. 123456789-xyz.apps.googleusercontent.com"
                            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-[11px] font-mono focus:outline-none focus:border-amber-400 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]"
                          />
                          <button
                            type="button"
                            onClick={handleSaveClientId}
                            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1"
                          >
                            {isSavedClientId ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-300">Saved</span>
                              </>
                            ) : (
                              <span>Save</span>
                            )}
                          </button>
                        </div>

                        {/* Setup Guidance */}
                        <div className="pt-2 border-t border-white/10 space-y-1.5 text-[10.5px] text-white/60">
                          <div className="font-semibold text-white/80 flex items-center justify-between">
                            <span>How to create your Client ID in 2 minutes:</span>
                            <a
                              href="https://console.cloud.google.com/apis/credentials"
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-300 hover:text-blue-200 underline flex items-center gap-1"
                            >
                              <span>Open Console</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <ol className="list-decimal pl-4 space-y-0.5 text-white/50">
                            <li>Create a Web application OAuth Client ID in Google Cloud Console.</li>
                            <li>
                              Add Authorized JavaScript origin:{' '}
                              <code className="text-white/80 bg-white/10 px-1 py-0.2 rounded">
                                {window.location.origin}
                              </code>
                            </li>
                            <li>Copy and paste the Client ID string into the field above and click Save.</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/[0.12] bg-black/35 flex items-center justify-between text-xs text-white/50 relative z-10">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Full Cloud Sync Across All Devices</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                className="text-white/70 hover:text-white uppercase tracking-wider font-bold text-[11px] cursor-pointer"
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