import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Disc3,
  LocateFixed,
} from 'lucide-react';
import {
  SharedViewProps,
  cleanDisplayTitle,
  formatTime,
  getBestCoverUrl,
} from '../../utils/viewCatalog';
import { Track } from '../../types';
import { sound } from '../../utils/soundEffects';
import { useViewportMode } from '../../hooks/useViewportMode';

// ============================================================================
// REAL-TIME WEBGL2 CRINKLED IRIDESCENT PVC POCKET CASE SHADER
// 100% sub-pixel locked to the binder sheet's exact (panX, panY) transform in
// the SAME requestAnimationFrame tick — zero drift, zero lag!
// As you pan in any direction, wrinkles & pockets stay glued to each CD while
// overhead studio reflections glide across the clear plastic case!
// ============================================================================
const PVC_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const PVC_FS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec4 u_sheetRect;  // x=panX, y=panY, z=unscaledSheetW, w=unscaledSheetH (CSS px)
uniform vec2 u_gridOrigin; // x=marginL, y=padY (unscaled CSS px)
uniform vec2 u_gridDims;   // x=cols, y=rows
uniform float u_cellSize;  // exact square pocket size in unscaled CSS px
uniform float u_scale;     // live zoom scale (e.g. 0.25 .. 2.4)
uniform float u_dpr;
uniform vec2 u_mouse;      // normalized [-1, 1]
uniform float u_time;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.82, 0.57, -0.57, 0.82);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.04;
    a *= 0.48;
  }
  return v;
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Physical clear PVC sleeve heightfield strictly in sheet-local coordinates (localPx)
// so every wrinkle, pocket pillow, and CD bulge stays 100% locked to its pocket!
float pvcHeight(vec2 localPx, vec2 cellUv, float inGrid) {
  // Subtle organic tension wrinkles radiating gently across the clear PVC plastic sheet
  vec2 warp = vec2(
    fbm(localPx * 0.0028 + vec2(1.4, 3.1)),
    fbm(localPx * 0.0028 + vec2(6.2, 2.5))
  ) - 0.5;

  // Crisp glossy plastic diagonal folds (ridged noise)
  float r1 = 1.0 - abs(fbm(localPx * 0.0056 + warp * 1.40 + vec2(localPx.y * 0.0016, 0.0)) * 2.0 - 1.0);
  float r2 = 1.0 - abs(fbm(localPx * 0.0130 - warp * 1.05) * 2.0 - 1.0);
  float crease = pow(r1, 2.5) * 0.56 + pow(r2, 2.8) * 0.24;

  // Physical CD bulge pushing upward against the clear plastic pouch inside each pocket!
  vec2 c = cellUv - 0.5;
  float discR = length(c);
  // Smooth raised plateau over the CD + gentle slope dropping down to the welded pocket seams
  float cdBulge = smoothstep(0.49, 0.36, discR) * 0.42 + smoothstep(0.45, 0.14, discR) * 0.14;
  // Subtle dip over the center spindle hole where the plastic relaxes slightly inward
  float hubDip = smoothstep(0.11, 0.0, discR) * 0.14;
  // Crisp pinched plastic crease right at the 4 corners of each pocket
  float cornerPinch = smoothstep(0.40, 0.50, max(abs(c.x), abs(c.y))) * 0.22;
  // Subtle horizontal plastic pouch lip slit near the top of each pocket
  float slitLip = exp(-pow((cellUv.y - 0.065) * 44.0, 2.0)) * smoothstep(0.48, 0.38, abs(c.x)) * 0.16;

  float pocketForm = (cdBulge - hubDip - cornerPinch + slitLip) * inGrid;
  float micro = (noise(localPx * 0.046 + warp * 1.8) - 0.5) * 0.045;

  return crease + pocketForm + micro;
}

// Authentic Y2K translucent PVC thin-film iridescence (rose pink, violet-lavender, ice cyan & crisp white)
vec3 thinFilmTint(float phase) {
  vec3 pink     = vec3(1.00, 0.64, 0.90);
  vec3 lavender = vec3(0.76, 0.66, 1.00);
  vec3 cyan     = vec3(0.66, 0.92, 1.00);
  vec3 white    = vec3(1.00, 0.97, 0.99);
  float t = fract(phase);
  if (t < 0.33) return mix(pink, lavender, t / 0.33);
  if (t < 0.66) return mix(lavender, cyan, (t - 0.33) / 0.33);
  return mix(cyan, mix(pink, white, 0.48), (t - 0.66) / 0.34);
}

void main() {
  // Exact CSS pixel coordinate (top-left origin, identical to DOM layout!)
  vec2 px = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_dpr;
  float sc = max(0.05, u_scale);

  // Convert viewport px directly into UNSCALED sheet-local px -> 100% sub-pixel locked at ANY zoom level!
  vec2 localPx = (px - u_sheetRect.xy) / sc;
  vec2 sheetHalf = u_sheetRect.zw * 0.5;
  float sdf = sdRoundedBox(localPx - sheetHalf, sheetHalf, 22.0);
  float aa = 1.5 / sc;
  float inSheet = 1.0 - smoothstep(-aa, aa, sdf);
  if (inSheet <= 0.001) {
    outColor = vec4(0.0);
    return;
  }

  vec2 gridPx = localPx - u_gridOrigin;
  vec2 gridSizePx = u_gridDims * u_cellSize;

  float inGrid = step(0.0, gridPx.x) * step(gridPx.x, gridSizePx.x)
               * step(0.0, gridPx.y) * step(gridPx.y, gridSizePx.y);

  vec2 cellUv  = fract(gridPx / u_cellSize);
  // Fixed finite-difference step in sheet-local px -> identical plastic normals at EVERY zoom & pan!
  float eps = 2.4;
  vec2 cellUvX = fract((gridPx + vec2(eps, 0.0)) / u_cellSize);
  vec2 cellUvY = fract((gridPx + vec2(0.0, eps)) / u_cellSize);

  // Analytical 3D plastic film normal strictly in locked sheet-local space
  float h0 = pvcHeight(localPx, cellUv, inGrid);
  float hx = pvcHeight(localPx + vec2(eps, 0.0), cellUvX, inGrid);
  float hy = pvcHeight(localPx + vec2(0.0, eps), cellUvY, inGrid);

  vec3 N = normalize(vec3(-(hx - h0) * 3.2, -(hy - h0) * 3.2, 1.0));
  // Fixed overhead gallery camera & lights -> plastic NEVER morphs, drifts, or changes over time!
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L1 = normalize(vec3(-0.36, -0.52, 0.85));
  vec3 L2 = normalize(vec3(0.56, 0.28, 0.78));

  vec3 H1 = normalize(V + L1);
  vec3 H2 = normalize(V + L2);

  float spec1Broad = pow(max(dot(N, H1), 0.0), 14.0);
  float spec1Sharp = pow(max(dot(N, H1), 0.0), 72.0);
  float spec2Broad = pow(max(dot(N, H2), 0.0), 16.0);
  float spec2Sharp = pow(max(dot(N, H2), 0.0), 62.0);

  // Fresnel grazing clear-plastic glow around CD bulges, folds, and seams
  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = pow(1.0 - NdotV, 2.45);

  // Static sheet-locked thin-film iridescence (zero time animation, zero cursor wobble!)
  float filmPhase = h0 * 1.40 + (N.x * 0.42 - N.y * 0.36) + (localPx.x - localPx.y) * 0.00018;
  vec3 irid = thinFilmTint(filmPhase);

  // Outer heat-welded PVC binder rim + left binder spine weld
  float outerRim = exp(-abs(sdf + 2.5) * 0.35) * inSheet;
  float innerWeld = exp(-abs(sdf + 11.0) * 0.52) * inSheet;
  float spineWeld = exp(-abs(localPx.x - u_gridOrigin.x) * 0.44) * inSheet;

  // Exact pixel-locked heat-welded pocket grid seam catch-lights + top pouch slit catch-light!
  float seamDistX = min(cellUv.x, 1.0 - cellUv.x) * u_cellSize;
  float seamDistY = min(cellUv.y, 1.0 - cellUv.y) * u_cellSize;
  float seamRidge = max(exp(-seamDistX * 0.42), exp(-seamDistY * 0.42)) * inGrid;
  float pouchSlit = exp(-abs((cellUv.y - 0.065) * u_cellSize) * 0.65)
                  * smoothstep(0.46, 0.36, abs(cellUv.x - 0.5)) * inGrid;

  vec3 sheen = vec3(0.0);
  // Delicate clear-plastic milky Fresnel glaze + soft broad iridescence over every CD pouch
  sheen += irid * (fresnel * 0.34 + spec1Broad * 0.20 + spec2Broad * 0.15);
  // Razor-crisp glossy specular highlights along crinkled folds & curved CD bulges
  sheen += mix(irid, vec3(1.0, 0.97, 1.0), 0.66) * (spec1Sharp * 0.56 + spec2Sharp * 0.38);

  // Fixed diagonal overhead gallery light band locked to the binder sheet
  vec2 sheetUv = localPx / max(vec2(1.0), u_sheetRect.zw);
  float ribbonCoord = (sheetUv.x * 0.65 + sheetUv.y * 0.45 - 0.52) + (N.x + N.y) * 0.24;
  float studioRibbon = exp(-pow(ribbonCoord * 2.6, 2.0)) * 0.12;
  sheen += mix(irid, vec3(1.0, 0.95, 0.99), 0.56) * studioRibbon;

  // Embossed plastic seams, spine weld, pouch slit lip & outer binder edge highlights
  sheen += mix(vec3(1.0, 0.72, 0.92), vec3(1.0), 0.44) * (outerRim * 0.56 + innerWeld * 0.22 + spineWeld * 0.30);
  sheen += mix(irid, vec3(1.0), 0.55) * seamRidge * (0.20 + 0.30 * spec1Broad);
  sheen += vec3(1.0, 0.92, 0.98) * pouchSlit * (0.16 + 0.22 * spec1Broad);

  // Subtle ambient clear-plastic reflection on the binder's top & left outer bevels
  float topGlow = exp(-max(0.0, localPx.y) * 0.030) * 0.14;
  sheen += vec3(1.0, 0.78, 0.94) * topGlow;

  sheen *= inSheet;
  float alpha = clamp(max(max(sheen.r, sheen.g), sheen.b) * 0.94, 0.0, 0.84);

  outColor = vec4(sheen, alpha);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('Binder PVC shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('Binder PVC link error:', gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

// ============================================================================
// INDIVIDUAL CD TUCKED INSIDE ITS CLEAR PVC BINDER POUCH
// ============================================================================
interface BinderPocketCDProps {
  track: Track;
  index: number;
  cellSize: number;
  isActive: boolean;
  isPlaying: boolean;
  onSelect: () => void;
}

const BinderPocketCD: React.FC<BinderPocketCDProps> = React.memo(
  ({ track, index, cellSize, isActive, isPlaying, onSelect }) => {
    const [imgSrc, setImgSrc] = useState(() => getBestCoverUrl(track));
    const [coverScale, setCoverScale] = useState(1.06);

    useEffect(() => {
      setImgSrc(getBestCoverUrl(track));
      setCoverScale(1.06);
    }, [track]);

    const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      if (track.youtubeId && naturalWidth <= 120) {
        setImgSrc(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`);
        return;
      }
      if (naturalWidth > 0 && naturalHeight > 0) {
        const aspect = naturalWidth / naturalHeight;
        setCoverScale(track.youtubeId && aspect > 1.25 && aspect < 1.48 ? 1.38 : 1.06);
      }
    };

    const handleError = () => {
      if (track.youtubeId && !imgSrc.includes('mqdefault')) {
        setImgSrc(`https://i.ytimg.com/vi/${track.youtubeId}/mqdefault.jpg`);
      } else if (imgSrc !== track.coverUrl) {
        setImgSrc(track.coverUrl);
      }
    };

    return (
      <button
        type="button"
        onClick={onSelect}
        className="group relative flex items-center justify-center p-[14px] focus:outline-none text-left overflow-hidden"
        style={{
          width: cellSize,
          height: cellSize,
          boxShadow: isActive
            ? 'inset 0 0 0 1px rgba(255,196,238,0.48), inset 0 0 28px rgba(226,142,255,0.18)'
            : 'inset 0 0 0 0.5px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,220,248,0.10)',
        }}
        title={`${String(index + 1).padStart(2, '0')} · ${cleanDisplayTitle(track.title)}`}
      >
        {/* Heat-welded embossed seam micro-dots along top & right pocket edges */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-40"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(255,230,248,0.6) 0 2px, transparent 2px 6px)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-[2px] opacity-35"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, rgba(255,230,248,0.6) 0 2px, transparent 2px 6px)',
          }}
        />

        {/* Subtle recessed dark plastic pocket backing */}
        <div
          className="pointer-events-none absolute inset-[2px] rounded-[5px]"
          style={{
            background: isActive
              ? 'radial-gradient(circle at 50% 50%, rgba(255,180,240,0.12) 0%, rgba(10,10,14,0.48) 76%)'
              : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, rgba(8,8,11,0.44) 78%)',
          }}
        />

        {/* Physical CD tucked INSIDE the clear PVC pouch */}
        <div
          className={`relative w-full h-full rounded-full transition-transform duration-300 ease-out ${
            isActive
              ? 'scale-[1.02]'
              : 'group-hover:scale-[1.03] group-active:scale-[0.985]'
          }`}
          style={{
            boxShadow: isActive
              ? '0 8px 22px rgba(0,0,0,0.75), 0 0 20px rgba(244,166,232,0.34), inset 0 0 0 1px rgba(255,255,255,0.52)'
              : '0 7px 18px rgba(0,0,0,0.68), inset 0 0 0 1px rgba(255,255,255,0.34)',
          }}
        >
          {/* Rotating CD artwork */}
          <div
            className="w-full h-full rounded-full overflow-hidden relative bg-[#151518]"
            style={{
              animation: 'binderCdSpin 11s linear infinite',
              animationPlayState: isActive && isPlaying ? 'running' : 'paused',
              willChange: isActive ? 'transform' : 'auto',
            }}
          >
            <img
              src={imgSrc}
              alt={track.title}
              loading="lazy"
              decoding="async"
              onLoad={handleLoad}
              onError={handleError}
              draggable={false}
              className="w-full h-full object-cover object-center filter contrast-[1.05] saturate-[1.08]"
              style={{ transform: `scale(${coverScale})` }}
            />

            {/* Delicate CD micro-grooves */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full opacity-20 mix-blend-overlay"
              style={{
                backgroundImage:
                  'repeating-radial-gradient(circle at center, transparent 0, transparent 1.5px, rgba(255,255,255,0.22) 2px, transparent 3px)',
              }}
            />

            {/* Subtle optical CD diffraction */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full opacity-[0.20] mix-blend-color-dodge"
              style={{
                background:
                  'conic-gradient(from 35deg at 50% 50%, transparent 0deg, rgba(255,90,210,0.45) 35deg, rgba(120,180,255,0.4) 80deg, transparent 130deg, transparent 180deg, rgba(255,90,210,0.42) 220deg, rgba(110,230,255,0.38) 265deg, transparent 320deg)',
              }}
            />
          </div>

          {/* Polycarbonate Center Hub + Cut-through Spindle Hole */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="w-[33%] h-[33%] rounded-full flex items-center justify-center"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(20,20,24,0.26) 72%, rgba(255,255,255,0.28) 100%)',
                border: '1px solid rgba(255,255,255,0.38)',
                boxShadow: 'inset 0 0 6px rgba(0,0,0,0.55)',
              }}
            >
              <div
                className="w-[78%] h-[78%] rounded-full flex items-center justify-center"
                style={{
                  background:
                    'conic-gradient(from 25deg, #646770 0deg, #e7e9f0 70deg, #43464f 165deg, #d7dae4 255deg, #646770 360deg)',
                  border: '1px solid rgba(255,255,255,0.45)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.7), 0 1px 4px rgba(0,0,0,0.65)',
                }}
              >
                <div
                  className="w-[56%] h-[56%] rounded-full bg-[#111114]"
                  style={{
                    border: '1.5px solid rgba(255,255,255,0.30)',
                    boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.9)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Crisp CD silver rim */}
          <div className="pointer-events-none absolute inset-0 rounded-full border border-white/40" />
        </div>

        {/* Clear PVC Top Pouch Lip (subtle translucent sleeve opening over the top of the CD!) */}
        <div
          className="pointer-events-none absolute top-[6.5%] left-[7%] right-[7%] h-[1px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,232,250,0.32) 20%, rgba(255,255,255,0.42) 50%, rgba(255,232,250,0.32) 80%, transparent 100%)',
          }}
        />

        {/* Active / Hover Micro-Label Tag tucked neatly at bottom of the PVC pocket */}
        <div
          className={`pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1.5 px-2 py-1 rounded-md backdrop-blur-md transition-all duration-200 ${
            isActive
              ? 'opacity-100 bg-black/74 border border-[#f5a8e4]/45 shadow-md'
              : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 bg-black/68 border border-white/15'
          }`}
        >
          <span className="font-mono text-[8.5px] tracking-[0.14em] text-[#f7b7ea] shrink-0">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="font-mono text-[8.5px] tracking-[0.06em] text-white/95 truncate uppercase flex-1">
            {cleanDisplayTitle(track.title)}
          </span>
          {isActive && (
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isPlaying ? 'bg-[#ff9de6] animate-pulse' : 'bg-white/45'
              }`}
            />
          )}
        </div>
      </button>
    );
  }
);

BinderPocketCD.displayName = 'BinderPocketCD';

// ============================================================================
// MAIN OMNI-DIRECTIONAL 2D ENDLESS PVC CD BINDER VIEW
// ============================================================================
export const BinderView: React.FC<SharedViewProps> = ({
  playlistTitle,
  tracks,
  activeIndex,
  isPlaying,
  currentTime,
  duration,
  onSelectTrack,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouseRef = useRef({ x: 0, y: 0 });

  // Unified 2D Camera State (x=panX, y=panY, scale=zoom) shared 1:1 by DOM + WebGL2 in the SAME RAF tick!
  const camRef = useRef({ x: 0, y: 0, scale: 1 });
  const targetCamRef = useRef<{ x: number; y: number; scale: number } | null>(null);
  const velRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
  });
  const [isGrabbing, setIsGrabbing] = useState(false);
  // Multi-pointer map for native 2-finger mobile touch pinch-to-zoom!
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistRef = useRef<number | null>(null);
  const { isMobile } = useViewportMode();

  const activeTrack = tracks[activeIndex] || tracks[0];

  // Balanced 2D omni-directional grid dimensions:
  // Desktop (>= 768px): 100% unchanged 248px pockets; Mobile (< 768px): crisp 148px pockets so 2-3 columns fit cleanly!
  const { cols, rows, totalPockets, cellSize, marginL, padY, padR, sheetW, sheetH } = useMemo(() => {
    const count = Math.max(12, tracks.length);
    const computedCols = Math.max(isMobile ? 3 : 4, Math.ceil(Math.sqrt(count * (isMobile ? 1.05 : 1.45))));
    const computedRows = Math.max(3, Math.ceil(count / computedCols));
    const cSize = isMobile ? 148 : 248;
    const mL = isMobile ? 42 : 72;
    const pY = isMobile ? 12 : 18;
    const pR = isMobile ? 12 : 18;
    return {
      cols: computedCols,
      rows: computedRows,
      totalPockets: computedCols * computedRows,
      cellSize: cSize,
      marginL: mL,
      padY: pY,
      padR: pR,
      sheetW: mL + computedCols * cSize + pR,
      sheetH: pY + computedRows * cSize + pY,
    };
  }, [tracks.length, isMobile]);

  const dimsRef = useRef({ cols, rows, cellSize, marginL, padY, sheetW, sheetH });
  dimsRef.current = { cols, rows, cellSize, marginL, padY, sheetW, sheetH };

  const getZoomBounds = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { sheetW: sw, sheetH: sh } = dimsRef.current;
    const fitScale = Math.min((vw - 96) / sw, (vh - 154) / sh);
    const minScale = Math.max(0.18, Math.min(0.85, fitScale * 0.92));
    return { minScale, maxScale: 2.4, fitScale: Math.max(0.18, Math.min(1.0, fitScale)) };
  }, []);

  const clampCam = useCallback(
    (x: number, y: number, rawScale: number) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { sheetW: rawW, sheetH: rawH } = dimsRef.current;
      const { minScale, maxScale } = getZoomBounds();
      const scale = Math.max(minScale, Math.min(maxScale, rawScale));
      const sw = rawW * scale;
      const sh = rawH * scale;

      const edgePadX = 72;
      const edgePadTop = 64;
      const edgePadBottom = 108;

      let cx: number;
      if (sw + edgePadX * 2 <= vw) {
        cx = (vw - sw) * 0.5;
      } else {
        const minX = vw - sw - edgePadX;
        const maxX = edgePadX;
        cx = Math.max(minX, Math.min(maxX, x));
      }

      let cy: number;
      if (sh + edgePadTop + edgePadBottom <= vh) {
        cy = (vh - sh) * 0.5 - 12;
      } else {
        const minY = vh - sh - edgePadBottom;
        const maxY = edgePadTop;
        cy = Math.max(minY, Math.min(maxY, y));
      }

      return { x: cx, y: cy, scale };
    },
    [getZoomBounds]
  );

  // Compute exact camera target to center any track index smoothly at a given scale
  const getCamForIndex = useCallback(
    (idx: number, scale?: number) => {
      const { cols: c, cellSize: cs, marginL: mL, padY: pY } = dimsRef.current;
      const s = scale ?? camRef.current.scale;
      const col = idx % c;
      const row = Math.floor(idx / c);
      const discCenterX = (mL + (col + 0.5) * cs) * s;
      const discCenterY = (pY + (row + 0.5) * cs) * s;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return clampCam(vw * 0.5 - discCenterX, vh * 0.47 - discCenterY, s);
    },
    [clampCam]
  );

  // Cursor-centered zoom helper (anchors exact world pixel under anchorX/anchorY!)
  const zoomAroundPoint = useCallback(
    (factor: number, anchorX: number, anchorY: number, smooth = false) => {
      const base = smooth && targetCamRef.current ? targetCamRef.current : camRef.current;
      const { minScale, maxScale } = getZoomBounds();
      const nextScale = Math.max(minScale, Math.min(maxScale, base.scale * factor));
      const worldX = (anchorX - base.x) / base.scale;
      const worldY = (anchorY - base.y) / base.scale;
      const nextCam = clampCam(anchorX - worldX * nextScale, anchorY - worldY * nextScale, nextScale);
      velRef.current = { x: 0, y: 0 };
      if (smooth) {
        targetCamRef.current = nextCam;
      } else {
        targetCamRef.current = null;
        camRef.current = nextCam;
      }
    },
    [clampCam, getZoomBounds]
  );

  // Initialize camera centered neatly on the active track (or opening spread) on mount / playlist change
  useEffect(() => {
    const initScale = 1;
    const startCam =
      activeIndex === 0
        ? clampCam(
            Math.max(48, (window.innerWidth - sheetW * initScale) * 0.5),
            Math.max(46, (window.innerHeight - sheetH * initScale) * 0.46),
            initScale
          )
        : getCamForIndex(activeIndex, initScale);
    camRef.current = startCam;
    targetCamRef.current = null;
    velRef.current = { x: 0, y: 0 };
  }, [sheetW, sheetH, clampCam, getCamForIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smoothly pan to the newly selected track whenever activeIndex changes if it's near/outside viewport edges
  const prevIndexRef = useRef(activeIndex);
  useEffect(() => {
    if (prevIndexRef.current === activeIndex) return;
    prevIndexRef.current = activeIndex;
    const { cols: c, cellSize: cs, marginL: mL, padY: pY } = dimsRef.current;
    const col = activeIndex % c;
    const row = Math.floor(activeIndex / c);
    const s = camRef.current.scale;
    const sx = camRef.current.x + (mL + (col + 0.5) * cs) * s;
    const sy = camRef.current.y + (pY + (row + 0.5) * cs) * s;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (sx < 140 || sx > vw - 140 || sy < 130 || sy > vh - 160) {
      targetCamRef.current = getCamForIndex(activeIndex, s);
      velRef.current = { x: 0, y: 0 };
    }
  }, [activeIndex, getCamForIndex]);

  const locateActive = useCallback(() => {
    velRef.current = { x: 0, y: 0 };
    const focusScale = camRef.current.scale < 0.72 ? 1 : camRef.current.scale;
    targetCamRef.current = getCamForIndex(activeIndex, focusScale);
  }, [activeIndex, getCamForIndex]);

  // Unified Wheel + Trackpad Pinch Zoom + 360° Trackpad Panning!
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // 1) Trackpad pinch-to-zoom (Chrome/Firefox send ctrlKey=true on pinch)
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.011);
        zoomAroundPoint(factor, e.clientX, e.clientY, false);
        return;
      }

      // 2) Physical mouse scroll wheel (discrete vertical steps with deltaX === 0) -> smooth cursor-centered zoom!
      const isMouseWheel =
        e.deltaX === 0 &&
        (e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 48 && Number.isInteger(e.deltaY)));
      if (isMouseWheel) {
        const normalizedDelta = e.deltaMode === 1 ? e.deltaY * 26 : e.deltaY;
        const factor = Math.exp(-normalizedDelta * 0.0022);
        zoomAroundPoint(factor, e.clientX, e.clientY, true);
        return;
      }

      // 3) Smooth two-finger trackpad 360° panning (horizontal + vertical simultaneously)
      targetCamRef.current = null;
      velRef.current = { x: 0, y: 0 };
      camRef.current = clampCam(
        camRef.current.x - e.deltaX,
        camRef.current.y - e.deltaY,
        camRef.current.scale
      );
    };

    // Safari / WebKit native trackpad pinch gesture fallback
    let gestureBaseScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureBaseScale = camRef.current.scale;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as Event & { scale?: number; clientX?: number; clientY?: number };
      if (!ge.scale) return;
      const desired = gestureBaseScale * ge.scale;
      const factor = desired / Math.max(0.05, camRef.current.scale);
      zoomAroundPoint(
        factor,
        ge.clientX ?? window.innerWidth * 0.5,
        ge.clientY ?? window.innerHeight * 0.5,
        false
      );
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, [clampCam, zoomAroundPoint]);

  // Keyboard shortcuts: Space = Play/Pause, Arrows = Next/Prev, + / - = Zoom In/Out
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        sound.playSwitch();
        onTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        sound.playDiscSpin();
        onNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        sound.playDiscSpin();
        onPrev();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomAroundPoint(1.22, window.innerWidth * 0.5, window.innerHeight * 0.5, true);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomAroundPoint(1 / 1.22, window.innerWidth * 0.5, window.innerHeight * 0.5, true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onTogglePlay, onNext, onPrev, zoomAroundPoint]);

  // Unified 120fps RAF Loop: updates 2D pan+zoom physics, DOM transform AND WebGL2 PVC Shader in the EXACT SAME frame!
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const program = createProgram(gl, PVC_VS, PVC_FS);
    if (!program) return;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uSheetRect = gl.getUniformLocation(program, 'u_sheetRect');
    const uGridOrigin = gl.getUniformLocation(program, 'u_gridOrigin');
    const uGridDims = gl.getUniformLocation(program, 'u_gridDims');
    const uCellSize = gl.getUniformLocation(program, 'u_cellSize');
    const uScale = gl.getUniformLocation(program, 'u_scale');
    const uDpr = gl.getUniformLocation(program, 'u_dpr');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uTime = gl.getUniformLocation(program, 'u_time');

    let rafId = 0;
    const t0 = performance.now();
    let lastNow = t0;

    const render = (now: number) => {
      const dt = Math.min(0.033, Math.max(0.004, (now - lastNow) / 1000));
      lastNow = now;

      // 1. Update smooth 2D camera physics (zoom/locate glide OR drag inertia)
      if (!dragRef.current.active) {
        if (targetCamRef.current) {
          const k = 1 - Math.exp(-10.5 * dt);
          camRef.current.x += (targetCamRef.current.x - camRef.current.x) * k;
          camRef.current.y += (targetCamRef.current.y - camRef.current.y) * k;
          camRef.current.scale += (targetCamRef.current.scale - camRef.current.scale) * k;
          if (
            Math.hypot(
              targetCamRef.current.x - camRef.current.x,
              targetCamRef.current.y - camRef.current.y
            ) < 0.35 &&
            Math.abs(targetCamRef.current.scale - camRef.current.scale) < 0.002
          ) {
            camRef.current = { ...targetCamRef.current };
            targetCamRef.current = null;
          }
        } else if (Math.abs(velRef.current.x) > 4 || Math.abs(velRef.current.y) > 4) {
          const friction = Math.exp(-5.8 * dt);
          velRef.current.x *= friction;
          velRef.current.y *= friction;
          const next = clampCam(
            camRef.current.x + velRef.current.x * dt,
            camRef.current.y + velRef.current.y * dt,
            camRef.current.scale
          );
          if (next.x === camRef.current.x) velRef.current.x = 0;
          if (next.y === camRef.current.y) velRef.current.y = 0;
          camRef.current = next;
        }
      }

      // 2. Apply EXACT pan + scale to DOM sheet BEFORE drawing WebGL2 -> 0.00px drift at ANY zoom!
      const { x: pxX, y: pxY, scale: curScale } = camRef.current;
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translate3d(${pxX}px, ${pxY}px, 0) scale(${curScale})`;
      }

      // 3. Draw pixel-locked WebGL2 Crinkled Iridescent PVC Case directly on top!
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.floor(canvas.clientWidth * dpr);
      const ch = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.08;
      smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.08;

      const d = dimsRef.current;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform4f(uSheetRect, pxX, pxY, d.sheetW, d.sheetH);
      gl.uniform2f(uGridOrigin, d.marginL, d.padY);
      gl.uniform2f(uGridDims, d.cols, d.rows);
      gl.uniform1f(uCellSize, d.cellSize);
      gl.uniform1f(uScale, curScale);
      gl.uniform1f(uDpr, dpr);
      gl.uniform2f(uMouse, smoothMouseRef.current.x, smoothMouseRef.current.y);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      gl.deleteBuffer(quad);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    };
  }, [clampCam]);

  // Pointer click-and-drag panning in all 360° directions + native 2-finger mobile touch pinch-to-zoom!
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      // Transition cleanly into 2-finger touch pinch-to-zoom!
      const pts = Array.from(activePointersRef.current.values());
      pinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      dragRef.current.active = false;
      dragRef.current.moved = true;
      velRef.current = { x: 0, y: 0 };
      targetCamRef.current = null;
      return;
    }

    targetCamRef.current = null;
    velRef.current = { x: 0, y: 0 };
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastTime: performance.now(),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Native 2-finger mobile pinch-to-zoom anchored at finger midpoint!
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) * 0.5;
      const midY = (pts[0].y + pts[1].y) * 0.5;
      if (pinchDistRef.current && pinchDistRef.current > 10 && dist > 10) {
        const factor = dist / pinchDistRef.current;
        zoomAroundPoint(factor, midX, midY, false);
      }
      pinchDistRef.current = dist;
      return;
    }

    if (!dragRef.current.active) return;

    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    const totalDist = Math.hypot(
      e.clientX - dragRef.current.startX,
      e.clientY - dragRef.current.startY
    );

    if (!dragRef.current.moved && totalDist > 6) {
      dragRef.current.moved = true;
      setIsGrabbing(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (dragRef.current.moved) {
      const now = performance.now();
      const dtSec = Math.max(0.004, (now - dragRef.current.lastTime) / 1000);
      velRef.current.x = velRef.current.x * 0.45 + (dx / dtSec) * 0.55;
      velRef.current.y = velRef.current.y * 0.45 + (dy / dtSec) * 0.55;
      camRef.current = clampCam(
        camRef.current.x + dx,
        camRef.current.y + dy,
        camRef.current.scale
      );
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      dragRef.current.lastTime = now;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchDistRef.current = null;
    }
    if (!dragRef.current.active) {
      window.setTimeout(() => {
        if (activePointersRef.current.size === 0) dragRef.current.moved = false;
      }, 30);
      return;
    }
    dragRef.current.active = false;
    setIsGrabbing(false);
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    // Reset moved flag after click event finishes propagating
    window.setTimeout(() => {
      dragRef.current.moved = false;
    }, 30);
  };

  const holeCount = Math.max(3, Math.ceil(rows * 1.1));
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full h-full overflow-hidden select-none touch-none bg-[#0d0d10] ${
        isGrabbing ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      <style>{`
        @keyframes binderCdSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Matte Charcoal Desk Surface */}
      <div
        className="pointer-events-none absolute inset-0 opacity-65"
        style={{
          background:
            'radial-gradient(ellipse 85% 65% at 50% 25%, rgba(44,36,48,0.42) 0%, rgba(11,11,14,0.98) 74%)',
        }}
      />

      {/* 2D Omni-Directional Translucent PVC Binder Sheet (translated + scaled 1:1 with WebGL2 canvas!) */}
      <div
        ref={sheetRef}
        className="absolute left-0 top-0 rounded-[22px] will-change-transform z-10"
        style={{
          width: sheetW,
          height: sheetH,
          transformOrigin: '0 0',
          background:
            'linear-gradient(155deg, rgba(44,38,52,0.58) 0%, rgba(20,18,25,0.74) 48%, rgba(36,30,44,0.60) 100%)',
          boxShadow:
            '0 32px 90px rgba(0,0,0,0.88), inset 0 0 0 1.5px rgba(255,214,244,0.28), inset 0 0 0 7px rgba(255,205,240,0.06), inset 0 0 38px rgba(236,162,255,0.08)',
        }}
      >
        {/* Left-Edge Torn Kraft Paper Collection Note (pinned with translucent pink washi tape) */}
        <div className="hidden sm:block pointer-events-none absolute -left-3.5 top-[150px] z-30 -rotate-[4deg]">
          <div
            className="relative w-[108px] px-3 py-3.5 text-[#1b1918] shadow-[0_10px_24px_rgba(0,0,0,0.62)]"
            style={{
              background: 'linear-gradient(145deg, #d7c7b4 0%, #c4b099 100%)',
              clipPath:
                'polygon(2% 0%, 96% 2%, 100% 24%, 97% 52%, 100% 78%, 94% 100%, 4% 97%, 0% 72%, 2% 38%)',
            }}
          >
            <div
              className="absolute -top-3 right-3 w-7 h-9 rotate-[28deg] opacity-80"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,148,208,0.78), rgba(232,110,182,0.68))',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              }}
            />
            <div className="font-serif italic text-[11.5px] leading-[1.25] font-semibold tracking-tight text-neutral-900 break-words">
              {playlistTitle || 'My Song Collection'}
            </div>
            <div className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-neutral-700">
              {tracks.length} DISCS ☺
            </div>
          </div>
        </div>

        {/* Right-Edge Pink "MUSIC" Ticket Stub Sticker */}
        <div className="hidden sm:block pointer-events-none absolute -right-3.5 top-[180px] z-30 rotate-[7deg]">
          <div
            className="px-2.5 py-2 rounded-[3px] text-[#221620] shadow-[0_8px_18px_rgba(0,0,0,0.55)] border border-white/40"
            style={{
              background: 'linear-gradient(135deg, #f9b8d4 0%, #f29bc1 100%)',
            }}
          >
            <div className="font-mono text-[9px] font-bold tracking-[0.16em] text-center">
              MUSIC
            </div>
            <div className="font-mono text-[7.5px] tracking-[0.12em] text-center opacity-75 mt-0.5">
              {String(activeIndex + 1).padStart(2, '0')} / {String(tracks.length).padStart(2, '0')}
            </div>
            <div
              className="mt-1.5 h-2.5 w-12 opacity-75"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, #1d141b 0 1.5px, transparent 1.5px 3px, #1d141b 3px 4px, transparent 4px 6px)',
              }}
            />
          </div>
        </div>

        {/* Exact-Pixel Binder Layout: Left Ring Margin + 2D Endless CD Pocket Grid */}
        <div className="flex w-full h-full rounded-[22px] overflow-hidden">
          {/* Left Ring-Binder Margin Strip with Endless Punched Holes */}
          <div
            className="shrink-0 relative flex flex-col justify-around items-center py-8"
            style={{
              width: marginL,
              background:
                'linear-gradient(90deg, rgba(255,212,244,0.10) 0%, rgba(255,255,255,0.03) 60%, rgba(255,212,244,0.12) 100%)',
              borderRight: '2px solid rgba(255,220,248,0.22)',
              boxShadow: 'inset -6px 0 12px rgba(0,0,0,0.35)',
            }}
          >
            <div
              className="pointer-events-none absolute right-[5px] inset-y-0 w-[2px] opacity-40"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(180deg, rgba(255,226,248,0.7) 0 2px, transparent 2px 6px)',
              }}
            />
            {Array.from({ length: holeCount }).map((_, hIdx) => (
              <div
                key={hIdx}
                className="w-7 h-7 rounded-full bg-[#0c0c0f]"
                style={{
                  boxShadow:
                    'inset 0 2px 6px rgba(0,0,0,0.95), 0 0 0 2px rgba(255,216,246,0.28), 0 0 10px rgba(255,180,235,0.14)',
                }}
              />
            ))}
          </div>

          {/* 2D Grid Container aligned pixel-for-pixel with WebGL2 u_gridOrigin & u_cellSize */}
          <div
            style={{
              paddingTop: padY,
              paddingBottom: padY,
              paddingRight: padR,
            }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
              }}
            >
              {Array.from({ length: totalPockets }).map((_, slotIdx) => {
                const track = tracks[slotIdx];
                if (!track) {
                  return (
                    <div
                      key={`empty-${slotIdx}`}
                      className="relative flex items-center justify-center"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        boxShadow:
                          'inset 0 0 0 0.5px rgba(255,255,255,0.09), inset 0 1px 0 rgba(255,220,248,0.08)',
                      }}
                    >
                      <div className="w-[74%] h-[74%] rounded-full border border-dashed border-white/[0.06]" />
                    </div>
                  );
                }

                const isActive = slotIdx === activeIndex;
                return (
                  <BinderPocketCD
                    key={`${track.id}-${slotIdx}`}
                    track={track}
                    index={slotIdx}
                    cellSize={cellSize}
                    isActive={isActive}
                    isPlaying={isPlaying}
                    onSelect={() => {
                      if (dragRef.current.moved) return;
                      if (isActive) {
                        sound.playSwitch();
                        onTogglePlay();
                      } else {
                        sound.playDiscSpin();
                        onSelectTrack(slotIdx);
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* PIXEL-LOCKED WEBGL2 CRINKLED IRIDESCENT PVC CASE FILM OVERLAY */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-20 w-full h-full"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Minimal Floating Obsidian-PVC Bottom Playback Pill (strictly flexbox-centered + safe-area!) */}
      <div
        className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3 sm:px-4"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto w-full max-w-[640px] rounded-full px-3.5 py-2 flex items-center gap-3 backdrop-blur-2xl"
          style={{
            background: 'rgba(15, 13, 19, 0.86)',
            border: '1px solid rgba(255, 206, 244, 0.24)',
            boxShadow: '0 16px 44px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 226, 250, 0.16)',
          }}
        >
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              sound.playDiscSpin();
              onPrev();
            }}
            aria-label="Previous track"
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
          >
            <SkipBack className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playSwitch();
              onTogglePlay();
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#131018] active:scale-90 transition-transform shadow-md"
            style={{
              background: 'linear-gradient(135deg, #ffd4f2 0%, #d8c8ff 55%, #b8eaff 100%)',
            }}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playDiscSpin();
              onNext();
            }}
            aria-label="Next track"
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
          >
            <SkipForward className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Disc3
                className={`w-3 h-3 shrink-0 text-[#f5b4e8] ${isPlaying ? 'animate-spin' : ''}`}
                style={{ animationDuration: '4s' }}
              />
              <span className="font-mono text-[10px] tracking-[0.08em] text-white/95 truncate uppercase">
                {activeTrack ? cleanDisplayTitle(activeTrack.title) : 'NO TRACK'}
              </span>
            </div>
            <span className="font-mono text-[9px] text-white/50 shrink-0 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              sound.playClick(900, 0.015);
              onSeek(ratio * duration);
            }}
            className="h-1.5 w-full rounded-full bg-white/12 cursor-pointer overflow-hidden relative"
          >
            <div
              className="h-full rounded-full transition-[width] duration-150"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #ff9de6 0%, #c8b2ff 60%, #98e4ff 100%)',
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            locateActive();
          }}
          title="Glide camera to spinning CD"
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/80 hover:text-white transition-all active:scale-95"
        >
          <LocateFixed className="w-3 h-3 text-[#f5b4e8]" />
          <span className="font-mono text-[9px] tracking-[0.12em] tabular-nums">
            {String(activeIndex + 1).padStart(2, '0')}/{String(tracks.length).padStart(2, '0')}
          </span>
        </button>
        </motion.div>
      </div>
    </div>
  );
};
