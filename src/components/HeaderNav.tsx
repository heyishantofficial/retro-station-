import React from 'react';
import { Maximize2, Minimize2, Search } from 'lucide-react';
import { sound } from '../utils/soundEffects';
import { useViewportMode } from '../hooks/useViewportMode';

interface HeaderNavProps {
  isMenuOpen: boolean;
  isSyncedYouTube: boolean;
  isDark?: boolean;
  isFullscreen?: boolean;
  isHudHidden?: boolean;
  onToggleFullscreen: () => void;
  onToggleMenu: () => void;
  onOpenSearch: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  isMenuOpen,
  isSyncedYouTube,
  isDark = false,
  isFullscreen = false,
  isHudHidden = false,
  onToggleFullscreen,
  onToggleMenu,
  onOpenSearch,
}) => {
  const { isIOS } = useViewportMode();
  const lineColor = isDark && !isMenuOpen ? 'bg-white' : 'bg-neutral-900';
  const iconColor = isDark && !isMenuOpen ? 'text-white/85 hover:text-white' : 'text-neutral-900/80 hover:text-neutral-900';
  const hoverBg = isDark && !isMenuOpen ? 'hover:bg-white/10' : 'hover:bg-black/[0.06]';

  return (
    <header
      className="w-full px-4 sm:px-8 pb-2 flex items-center justify-end relative z-50 pointer-events-none app-drag-region"
      style={{ paddingTop: 'max(0.85rem, env(safe-area-inset-top, 0px))' }}
    >
      <div
        className={`flex items-center gap-1.5 no-drag transition-opacity duration-500 ${
          isHudHidden ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
      >
        {/* Search & Add Song Trigger */}
        {!isMenuOpen && (
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onOpenSearch();
            }}
            aria-label="Search and add songs"
            title="Search & Add Songs (/)"
            className={`touch-target w-9 h-9 rounded-full flex items-center justify-center ${iconColor} ${hoverBg} active:scale-90 transition-all`}
          >
            <Search className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}

        {/* True Borderless Fullscreen Toggle (hidden on iOS Safari where HTML5 Fullscreen is unsupported) */}
        {!isMenuOpen && !isIOS && (
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onToggleFullscreen();
            }}
            aria-label={isFullscreen ? 'Exit borderless fullscreen' : 'Enter borderless fullscreen'}
            title={isFullscreen ? 'Exit Fullscreen (F / Esc)' : 'Borderless Fullscreen (F)'}
            className={`touch-target w-9 h-9 rounded-full flex items-center justify-center ${iconColor} ${hoverBg} active:scale-90 transition-all`}
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
          className={`touch-target relative w-9 h-9 rounded-full flex flex-col items-center justify-center gap-[4.5px] ${hoverBg} active:scale-90 transition-all`}
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
