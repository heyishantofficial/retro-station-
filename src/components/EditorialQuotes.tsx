import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CriticQuote } from '../types';

interface EditorialQuotesProps {
  quotes?: CriticQuote[];
}

export const EditorialQuotes: React.FC<EditorialQuotesProps> = ({ quotes }) => {
  if (!quotes || quotes.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-8 sm:gap-14 max-w-xl mx-auto select-text">
      {quotes.slice(0, 2).map((quote, idx) => (
        <AnimatePresence key={idx} mode="wait">
          <motion.div
            key={quote.text + quote.source}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, delay: idx * 0.08 }}
            className="flex flex-col items-center text-center max-w-[210px]"
          >
            {/* 5 Stars */}
            <div className="flex space-x-1 mb-1 text-[8px] text-neutral-900 tracking-widest">
              <span>★</span>
              <span>★</span>
              <span>★</span>
              <span>★</span>
              <span>★</span>
            </div>

            {/* Source Header (in smaller text) */}
            <div className="font-mono text-[7.5px] uppercase tracking-[0.25em] text-neutral-500 mb-1">
              {quote.source}
            </div>

            {/* Editorial Quote in high-contrast uppercase serif */}
            <blockquote className="font-serif text-[11px] sm:text-[12px] font-semibold tracking-wide uppercase leading-tight text-neutral-900">
              “{quote.text}”
            </blockquote>
          </motion.div>
        </AnimatePresence>
      ))}
    </div>
  );
};
