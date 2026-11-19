import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, X, Check, Disc3, Sparkles, Copy } from 'lucide-react';
import { SocialPost } from '../services/socialFeed';
import { sound } from '../utils/soundEffects';

interface ShareCardModalProps {
  isOpen: boolean;
  post: SocialPost | null;
  onClose: () => void;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({ isOpen, post, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  const title = post.type === 'song' ? post.song?.title : post.playlist?.title;
  const subtitle = post.type === 'song' ? post.song?.artist : `${post.playlist?.trackCount} tracks`;
  const coverUrl = post.type === 'song' ? post.song?.coverUrl : undefined;
  const shareUrl = `${window.location.origin}/?post=${post.id}`;

  const handleCopyLink = () => {
    sound.playClick();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyText = () => {
    sound.playClick();
    const formatted = `🎧 "${title}" by ${subtitle}\n“${post.note}”\nCurated by ${post.author.name} on Retro Station\n${shareUrl}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(formatted);
    }
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 overflow-hidden">
        {/* Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute inset-0 bg-black/65 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-sm rounded-3xl liquid-glass-drawer border border-white/25 p-5 text-white font-sans shadow-[0_32px_80px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.4)] z-10 flex flex-col gap-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.14]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold tracking-tight uppercase text-white/80">
                Collector Story Card
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              aria-label="Close Story Card"
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 9:16 Social Story Preview Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-white/[0.14] via-black/40 to-black/80 border border-white/25 shadow-xl relative overflow-hidden flex flex-col gap-3">
            {/* Ambient Refraction sheen */}
            <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-rose-500/20 blur-2xl" />

            {/* Card Header branding */}
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-white/60">
              <span>RETRO STATION</span>
              <span>{post.type === 'song' ? 'DISC SPOTLIGHT' : 'CURATED CRATE'}</span>
            </div>

            {/* Artwork Container */}
            <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-white/25 bg-neutral-950 shadow-md">
              {coverUrl ? (
                <img src={coverUrl} alt={title || 'Cover'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/40 to-black text-purple-300 gap-2">
                  <Disc3 className="w-12 h-12 animate-spin" />
                  <span className="text-xs font-mono uppercase tracking-wider">Mixtape Vault</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-mono text-white/80 border border-white/15">
                ✦ 24-BIT HI-FI
              </div>
            </div>

            {/* Track Info */}
            <div>
              <h4 className="text-base font-bold text-white tracking-tight truncate leading-tight">
                {title}
              </h4>
              <p className="text-xs text-white/70 font-medium truncate mt-0.5">{subtitle}</p>
            </div>

            {/* The Curator Micro-Note */}
            <div className="p-2.5 rounded-xl bg-white/[0.08] border border-white/10 text-xs italic text-white/90 leading-relaxed">
              “{post.note}”
            </div>

            {/* Curator Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] text-white/60">
              <div className="flex items-center gap-1.5">
                {post.author.avatarUrl ? (
                  <img
                    src={post.author.avatarUrl}
                    alt={post.author.name}
                    className="w-4 h-4 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <span>👤</span>
                )}
                <span className="font-semibold text-white/80">{post.author.name}</span>
              </div>
              <span className="font-mono text-white/50">retro-station-seven.vercel.app</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2 px-3 rounded-xl liquid-glass-interactive text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-white"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied Link!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="py-2 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_16px_rgba(244,63,94,0.3)] cursor-pointer active:scale-95 transition-all"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Story Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy For IG/X</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
