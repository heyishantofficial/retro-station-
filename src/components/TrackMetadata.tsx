import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Track } from '../types';

interface TrackMetadataProps {
  track: Track;
}

export const TrackMetadata: React.FC<TrackMetadataProps> = ({ track }) => {
  const cleanTitle = track.title.split(/\s*\|\s*/)[0].trim() || track.title;

  return (
    <div className="w-full max-w-[36vw] min-w-[220px] max-w-md pointer-events-auto select-text">
      <div className="overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.h1
            key={track.id + '-title'}
            title={cleanTitle}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-xl sm:text-2xl md:text-[30px] font-medium tracking-tight uppercase leading-[1.08] text-neutral-900 truncate whitespace-nowrap"
          >
            {cleanTitle}
          </motion.h1>
        </AnimatePresence>
      </div>
    </div>
  );
};
