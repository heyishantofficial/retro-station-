import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface HeaderNavProps {
  isMenuOpen: boolean;
  isSyncedYouTube: boolean;
  isDark?: boolean;
  isFullscreen?: boolean;
  isHudHidden?: boolean;
  onToggleFullscreen: () => void;
  onToggleMenu: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  isMenuOpen,
  isSyncedYouTube,
  isDark = false,
  isFullscreen = false,
  isHudHidden = false,
  onToggleFullscreen,
  onToggleMenu,
}) => {
  const lineColor = isDark && !isMenuOpen ? 'bg-white' : 'bg-neutral-900';
  const iconColor = isDark && !isMenuOpen ? 'text-white/85 hover:text-white' : 'text-neutral-900/80 hover:text-neutral-900';
  const hoverBg = isDark && !isMenuOpen ? 'hover:bg-white/10' : 'hover:bg-black/[0.06]';

  return (
    <header className="w-full px-5 sm:px-8 pt-4 pb-2 flex items-center justify-end relative z-50 pointer-events-none app-drag-region">
      <div
        className={`flex items-center gap-1.5 no-drag transition-opacity duration-500 ${
          isHudHidden ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
      >
        {/* True Borderless Fullscreen Toggle (Hides Chrome tabs & address bar!) */}
        {!isMenuOpen && (
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onToggleFullscreen();
            }}
            aria-label={isFullscreen ? 'Exit borderless fullscreen' : 'Enter borderless fullscreen'}
            title={isFullscreen ? 'Exit Fullscreen (F / Esc)' : 'Borderless Fullscreen (F)'}
            className={`w-9 h-9 rounded-full flex items-center justify-center ${iconColor} ${hoverBg} active:scale-90 transition-all`}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>
        )}

        {/* Minimal Hamburger Menu Trigger (adapts automatically to dark/light views!) */}
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onToggleMenu();
          }}
          aria-label="Open menu"
          title="Menu — Player Views, Playlists & YouTube Sync"
          className={`relative w-9 h-9 rounded-full flex flex-col items-center justify-center gap-[4.5px] ${hoverBg} active:scale-90 transition-all`}
        >
          <span
            className={`block w-[18px] h-[1.5px] ${lineColor} rounded-full transition-all duration-200 ${
              isMenuOpen ? 'translate-y-[3px] rotate-45' : ''
            }`}
          />
          <span
            className={`block w-[18px] h-[1.5px] ${lineColor} rounded-full transition-all duration-200 ${
              isMenuOpen ? '-translate-y-[3px] -rotate-45' : ''
            }`}
          />
          {isSyncedYouTube && !isMenuOpen && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
      </div>
    </header>
  );
};
