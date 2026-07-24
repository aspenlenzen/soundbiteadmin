import { useRef, useState } from 'react';
import { LEVELS } from '../lib/levels';

// Web port of the app's SoundLevelSlider (src/components/SoundLevelSlider.tsx
// in the Expo repo): same 7 bands on a 0–100 track, same gradient built from
// the level colors with stops at each band's midpoint, same settle-to-center
// behavior on release. Value in/out is the 1–7 sound_rating.
const BAND = 100 / 7;
const bandOf = (raw: number) => Math.min(6, Math.max(0, Math.floor(raw / BAND)));
const centerOf = (band: number) => (band + 0.5) * BAND;

const TRACK_GRADIENT = (() => {
  const colors = [LEVELS[0].color, ...LEVELS.map((l) => l.color), LEVELS[6].color];
  const stops = [0, ...LEVELS.map((_, i) => (i + 0.5) / LEVELS.length), 1];
  return `linear-gradient(to right, ${colors
    .map((c, i) => `${c} ${(stops[i] * 100).toFixed(2)}%`)
    .join(', ')})`;
})();

function SpeakerIcon({ waves }: { waves?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {waves && <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}

type Props = {
  value: number; // 1–7 sound_rating
  onChange: (rating: number) => void;
  disabled?: boolean;
};

export default function SoundLevelSlider({ value, onChange, disabled }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Continuous 0–100 position while a pointer is down; null when idle so the
  // thumb rests at the committed value's band center.
  const [dragPos, setDragPos] = useState<number | null>(null);

  const posFor = (clientX: number): number | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  };

  const shown = dragPos ?? centerOf(value - 1);
  const band = bandOf(shown);
  const lvl = LEVELS[band];

  const settle = (raw: number) => {
    setDragPos(null);
    onChange(bandOf(raw) + 1);
  };

  const step = (delta: number) => {
    const next = Math.min(6, Math.max(0, value - 1 + delta));
    if (next !== value - 1) onChange(next + 1);
  };

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <div className="text-center">
        <p className="text-[22px] leading-7 font-extrabold" style={{ color: lvl.color }}>
          {lvl.word}
        </p>
        <p className="mt-0.5 min-h-4 text-[13px] text-gray-400">{lvl.desc}</p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled || band === 0}
          aria-label="One level quieter"
          className="w-[26px] text-[22px] leading-[26px] font-semibold"
          style={{ color: band === 0 || disabled ? '#D1D1D6' : 'var(--accent)' }}
        >
          −
        </button>
        <div
          className={`flex-1 py-2.5 ${disabled ? 'pointer-events-none' : 'cursor-pointer'}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = posFor(e.clientX);
            if (p !== null) setDragPos(p);
          }}
          onPointerMove={(e) => {
            if (dragPos === null) return;
            const p = posFor(e.clientX);
            if (p !== null) setDragPos(p);
          }}
          onPointerUp={(e) => {
            const p = posFor(e.clientX) ?? shown;
            settle(p);
          }}
          onPointerCancel={() => setDragPos(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              step(-1);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              step(1);
            }
          }}
          role="slider"
          aria-valuemin={1}
          aria-valuemax={7}
          aria-valuenow={value}
          aria-valuetext={`${lvl.word} (${band + 1} of 7)`}
          aria-label="Sound level"
          tabIndex={disabled ? -1 : 0}
        >
          <div
            ref={trackRef}
            className="relative h-2.5 rounded-full"
            style={{ background: TRACK_GRADIENT }}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                className="absolute top-0 h-2.5 w-0.5 -ml-px bg-white/90"
                style={{ left: `${(i + 1) * BAND}%` }}
              />
            ))}
            <span
              className="absolute top-1/2 h-7 w-7 rounded-full bg-white shadow-[0_1px_6px_rgba(0,0,0,0.3)]"
              style={{
                left: `${shown}%`,
                transform: 'translate(-50%, -50%)',
                transition: dragPos === null ? 'left 140ms ease-out' : 'none',
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled || band === 6}
          aria-label="One level louder"
          className="w-[26px] text-[22px] leading-[26px] font-semibold"
          style={{ color: band === 6 || disabled ? '#D1D1D6' : 'var(--accent)' }}
        >
          +
        </button>
      </div>
      <div className="mx-[34px] flex justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <SpeakerIcon />
          Nearly silent
        </span>
        <span className="flex items-center gap-1">
          <SpeakerIcon waves />
          Ear-splitting
        </span>
      </div>
    </div>
  );
}
