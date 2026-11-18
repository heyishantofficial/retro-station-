import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { getBestCoverUrl } from '../utils/viewCatalog';

interface SmartCoverProps {
  track?: Track;
  className?: string;
  extraScale?: number;
}

export const SmartCover: React.FC<SmartCoverProps> = ({
  track,
  className = '',
  extraScale = 1,
}) => {
  const [src, setSrc] = useState(() => getBestCoverUrl(track));
  const [scale, setScale] = useState(1.06);

  useEffect(() => {
    setSrc(getBestCoverUrl(track));
    setScale(1.06);
  }, [track]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (track?.youtubeId && naturalWidth <= 120) {
      setSrc(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`);
      return;
    }
    if (naturalWidth > 0 && naturalHeight > 0) {
      const aspect = naturalWidth / naturalHeight;
      if (track?.youtubeId && aspect > 1.25 && aspect < 1.48) {
        setScale(1.38);
      } else {
        setScale(1.06);
      }
    }
  };

  const handleError = () => {
    if (track?.youtubeId && !src.includes('mqdefault')) {
      setSrc(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`);
    } else if (track && src !== track.coverUrl) {
      setSrc(track.coverUrl);
    }
  };

  if (!src) return null;

  return (
    <img
      src={src}
      alt={track?.title || 'Cover'}
      onLoad={handleLoad}
      onError={handleError}
      className={`w-full h-full object-cover object-center ${className}`}
      style={{
        transform: `scale(${scale * extraScale})`,
        transformOrigin: 'center center',
      }}
      draggable={false}
    />
  );
};
