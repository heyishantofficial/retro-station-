import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  X,
  Disc3,
  ChevronDown,
  Check,
  Play,
  Flame,
  Calendar,
} from 'lucide-react';
import {
  CHART_COUNTRIES,
  YOUTUBE_CHARTS,
  YouTubeChartItem,
} from '../data/youtubeCharts';
import { sound } from '../utils/soundEffects';

interface YouTubeChartsModalProps {
  isOpen: boolean;
  isSyncing: boolean;
  syncStatus: string | null;
  onClose: () => void;
  onSelectChart: (playlistId: string, chartTitle: string) => void;
}

export const YouTubeChartsModal: React.FC<YouTubeChartsModalProps> = ({
  isOpen,
  isSyncing,
  syncStatus,
  onClose,
  onSelectChart,
}) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState('IN');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [loadingChartId, setLoadingChartId] = useState<string | null>(null);

  const currentCountry =
    CHART_COUNTRIES.find((c) => c.code === selectedCountryCode) || CHART_COUNTRIES[0];
  const charts = YOUTUBE_CHARTS[selectedCountryCode] || YOUTUBE_CHARTS.IN;

  const dailyCharts = charts.filter((c) => c.cadence === 'daily');
  const weeklyCharts = charts.filter((c) => c.cadence === 'weekly');

  const handleChartClick = (chart: YouTubeChartItem) => {
    sound.playDiscSpin();
    setLoadingChartId(chart.id);
    onSelectChart(chart.playlistId, chart.title);
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

          {/* Modal Sheet styled like YouTube Music Charts */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-3xl max-h-[90dvh] rounded-3xl bg-[#030303] text-white border border-white/10 shadow-[0_36px_90px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden"
          >
            {/* Header with Title and Country Dropdown Button (like YT Music) */}
            <div className="px-6 pt-6 pb-4 border-b border-white/[0.08] flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white shadow">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-white/50">
                    YouTube Music Official
                  </span>
                </div>
                <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none">
                  Charts
                </h1>

                {/* Country Pill Dropdown Button */}
                <div className="relative mt-3 inline-block">
                  <button
                    type="button"
                    onClick={() => setIsCountryDropdownOpen((o) => !o)}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-[13px] font-sans font-medium text-white transition-all active:scale-95 shadow-sm"
                  >
                    <span>{currentCountry.name}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-white/70 transition-transform ${
                        isCountryDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu matching Image 4 */}
                  <AnimatePresence>
                    {isCountryDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 w-64 max-h-72 overflow-y-auto rounded-2xl bg-[#1e1e20] border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-2 z-50 flex flex-col gap-0.5"
                      >
                        <div className="px-3 py-2 border-b border-white/[0.08] mb-1">
                          <span className="font-sans text-xs font-semibold text-white/70">
                            Select a country
                          </span>
                        </div>
                        {CHART_COUNTRIES.map((cty) => {
                          const isSel = cty.code === selectedCountryCode;
                          return (
                            <button
                              key={cty.code}
                              type="button"
                              onClick={() => {
                                sound.playClick();
                                setSelectedCountryCode(cty.code);
                                setIsCountryDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left text-[13px] flex items-center justify-between transition-colors ${
                                isSel
                                  ? 'bg-white/10 text-white font-medium'
                                  : 'hover:bg-white/[0.06] text-white/80'
                              }`}
                            >
                              <span className="flex items-center gap-2.5">
                                <span className="text-sm">{cty.flag}</span>
                                <span>{cty.name}</span>
                              </span>
                              {isSel && <Check className="w-4 h-4 text-white" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Charts Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 min-h-[320px] max-h-[62dvh] space-y-7">
              {isSyncing ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Disc3 className="w-12 h-12 animate-spin text-purple-400 mb-3" />
                  <h3 className="font-serif text-lg font-semibold uppercase tracking-wide">
                    Pressing Chart to Digital Vinyl…
                  </h3>
                  <p className="font-mono text-xs text-purple-300/70 mt-1">
                    {syncStatus || 'Connecting to YouTube Music playlist…'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Daily Charts Section */}
                  {dailyCharts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <Flame className="w-4 h-4 text-purple-400" />
                        <h2 className="font-sans text-lg font-bold text-white tracking-tight">
                          Daily charts
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {dailyCharts.map((chart) => {
                          const isLoading = isSyncing && loadingChartId === chart.id;
                          return (
                            <button
                              key={chart.id}
                              type="button"
                              onClick={() => handleChartClick(chart)}
                              disabled={isSyncing}
                              className="group text-left flex flex-col cursor-pointer transition-transform active:scale-[0.98]"
                            >
                              {/* Purple Chart Artwork Card (like YT Music) */}
                              <div
                                className={`relative w-full aspect-square rounded-2xl overflow-hidden p-4 flex flex-col justify-between shadow-xl bg-gradient-to-br ${chart.accentColor} transition-transform group-hover:scale-[1.02] border border-white/15`}
                              >
                                {/* Top Badge */}
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-black/30 text-white backdrop-blur-sm">
                                    DAILY
                                  </span>
                                  <div className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white/90 group-hover:bg-white group-hover:text-black transition-colors shadow">
                                    {isLoading ? (
                                      <Disc3 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Play className="w-3 h-3 fill-current ml-0.5" />
                                    )}
                                  </div>
                                </div>

                                {/* Center Big Text */}
                                <div className="my-auto text-center py-2">
                                  <span className="block font-sans font-black text-2xl tracking-tighter uppercase text-white/95 leading-none drop-shadow-md">
                                    {chart.badge}
                                  </span>
                                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/80 block mt-1">
                                    {chart.country}
                                  </span>
                                </div>

                                {/* Bottom Footnote on Card */}
                                <div className="flex items-center justify-between text-[9px] font-mono text-white/70">
                                  <span>Retro Station</span>
                                  <span>Spin on Vinyl ↗</span>
                                </div>
                              </div>

                              {/* Title & Subtitle Below Card (like YT Music) */}
                              <div className="mt-2.5 px-0.5">
                                <h3 className="font-sans text-[13.5px] font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                                  {chart.title}
                                </h3>
                                <p className="font-sans text-[11.5px] text-white/50 truncate mt-0.5">
                                  {chart.subtitle}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Weekly Charts Section */}
                  {weeklyCharts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3.5">
                        <Calendar className="w-4 h-4 text-purple-400" />
                        <h2 className="font-sans text-lg font-bold text-white tracking-tight">
                          Weekly charts
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {weeklyCharts.map((chart) => {
                          const isLoading = isSyncing && loadingChartId === chart.id;
                          return (
                            <button
                              key={chart.id}
                              type="button"
                              onClick={() => handleChartClick(chart)}
                              disabled={isSyncing}
                              className="group text-left flex flex-col cursor-pointer transition-transform active:scale-[0.98]"
                            >
                              {/* Purple Chart Artwork Card */}
                              <div
                                className={`relative w-full aspect-square rounded-2xl overflow-hidden p-4 flex flex-col justify-between shadow-xl bg-gradient-to-br ${chart.accentColor} transition-transform group-hover:scale-[1.02] border border-white/15`}
                              >
                                {/* Top Badge */}
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-black/30 text-white backdrop-blur-sm">
                                    WEEKLY
                                  </span>
                                  <div className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white/90 group-hover:bg-white group-hover:text-black transition-colors shadow">
                                    {isLoading ? (
                                      <Disc3 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Play className="w-3 h-3 fill-current ml-0.5" />
                                    )}
                                  </div>
                                </div>

                                {/* Center Big Text */}
                                <div className="my-auto text-center py-2">
                                  <span className="block font-sans font-black text-2xl tracking-tighter uppercase text-white/95 leading-none drop-shadow-md">
                                    {chart.badge}
                                  </span>
                                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/80 block mt-1">
                                    {chart.country}
                                  </span>
                                </div>

                                {/* Bottom Footnote on Card */}
                                <div className="flex items-center justify-between text-[9px] font-mono text-white/70">
                                  <span>Retro Station</span>
                                  <span>Spin on Vinyl ↗</span>
                                </div>
                              </div>

                              {/* Title & Subtitle Below Card */}
                              <div className="mt-2.5 px-0.5">
                                <h3 className="font-sans text-[13.5px] font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                                  {chart.title}
                                </h3>
                                <p className="font-sans text-[11.5px] text-white/50 truncate mt-0.5">
                                  {chart.subtitle}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-[11px] font-mono text-white/40">
              <span>Official YouTube Music Charts • 1-Click Spin on Turntable</span>
              <button
                type="button"
                onClick={onClose}
                className="text-white/70 hover:text-white uppercase tracking-wider font-semibold"
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
