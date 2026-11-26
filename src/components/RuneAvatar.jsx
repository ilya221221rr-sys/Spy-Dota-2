import React from 'react';

export const RUNE_AVATARS = [
  {
    id: 'smoke',
    label: 'Смоки',
    ring: 'from-violet-500 to-emerald-400',
    bg: 'bg-violet-950/80',
  },
  {
    id: 'arcane',
    label: 'Волшебство',
    ring: 'from-fuchsia-500 to-violet-500',
    bg: 'bg-fuchsia-950/75',
  },
  {
    id: 'regen',
    label: 'Регенерация',
    ring: 'from-emerald-400 to-teal-500',
    bg: 'bg-emerald-950/75',
  },
  {
    id: 'bounty',
    label: 'Богатство',
    ring: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-950/75',
  },
  {
    id: 'dd',
    label: 'Двойной урон',
    ring: 'from-sky-400 to-indigo-500',
    bg: 'bg-sky-950/75',
  },
  {
    id: 'haste',
    label: 'Ускорение',
    ring: 'from-rose-500 to-orange-500',
    bg: 'bg-rose-950/75',
  },
  {
    id: 'illusion',
    label: 'Иллюзия',
    ring: 'from-yellow-300 to-emerald-400',
    bg: 'bg-lime-950/75',
  },
  {
    id: 'aegis',
    label: 'Аегис',
    ring: 'from-violet-400 to-amber-300',
    bg: 'bg-slate-900/85',
  },
];

function RuneGlyph({ id }) {
  switch (id) {
    case 'arcane':
      return (
        <svg viewBox="0 0 32 32" className="h-3/5 w-3/5" fill="none">
          <polygon
            points="16,3 27,16 16,29 5,16"
            stroke="#e879f9"
            strokeWidth="2.2"
            fill="rgba(217,70,239,0.22)"
          />
          <circle cx="16" cy="16" r="4" fill="#f5d0fe" />
        </svg>
      );
    case 'regen':
      return (
        <svg viewBox="0 0 32 32" className="h-3/5 w-3/5" fill="none">
          <path
            d="M16 4v24M4 16h24"
            stroke="#34d399"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <circle cx="16" cy="16" r="6" fill="rgba(16,185,129,0.28)" stroke="#6ee7b7" strokeWidth="1.6" />
        </svg>
      );
    case 'bounty':
      return (
        <svg viewBox="0 0 32 32" className="h-3/5 w-3/5" fill="none">
          <polygon
            points="16,3 28,11 24,27 8,27 4,11"
            stroke="#fbbf24"
            strokeWidth="2.2"
            fill="rgba(245,158,11,0.25)"
          />
          <polygon points="16,9 21,16 16,23 11,16" fill="#fde68a" />
        </svg>
      );
    case 'dd':
      return (
        <svg viewBox="0 0 32 32" className="h-3/5 w-3/5" fill="none">
          <path
            d="M9 25L21 7M13 25L25 7"
            stroke="#38bdf8"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path d="M7 19l6 6M19 7l6 6" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'haste':
      return (
        <svg viewBox="0 0 32 32" className="h-3/5 w-3/5" fill="none">
          <path
            d="M18 3L7 18h8l-2 11 12-15h-8l1-11z"
            stroke="#fb7185"
            strokeWidth="2"
            fill="rgba(244,63,94,0.28)"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'illusion':
      return (
        <svg viewBox="0 0 32 32" className="h-3/5 w-3/5" fill="none">
          <circle cx="13" cy="16" r="7" stroke="#fde047" strokeWidth="2" fill="rgba(250,204,21,0.18)" />
          <circle cx="19" cy="16" r="7" stroke="#34d399" strokeWidth="2" fill="rgba(52,211,153,0.18)" />
        </svg>
      );
    case 'aegis':
      return (
        <svg viewBox="0 0 32 32" className="h-3/5 w-3/5" fill="none">
          <path
            d="M16 3l11 4.5v8.5c0 6.8-4.7 11.4-11 13.5C9.7 27.4 5 22.8 5 16V7.5L16 3z"
            stroke="#c4b5fd"
            strokeWidth="2.2"
            fill="rgba(139,92,246,0.25)"
          />
          <circle cx="16" cy="15" r="3.8" fill="#fbbf24" />
        </svg>
      );
    case 'smoke':
    default:
      return (
        <svg viewBox="0 0 32 32" className="h-3/5 w-3/5" fill="none">
          <path
            d="M9 21c-2.8 0-5-2-5-4.6 0-2.3 1.8-4.2 4.1-4.5C9.1 8.5 12.2 6 16 6c4.2 0 7.7 3 8.2 7 2.2.5 3.8 2.3 3.8 4.5 0 2.6-2.2 4.5-5 4.5H9z"
            stroke="#c084fc"
            strokeWidth="2"
            fill="rgba(139,92,246,0.28)"
          />
          <path
            d="M10 25h12M13 28h6"
            stroke="#34d399"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export function RuneAvatar({ avatarId = 'smoke', size = 'md', isOnline = true }) {
  const meta = RUNE_AVATARS.find((a) => a.id === avatarId) || RUNE_AVATARS[0];

  const dims =
    size === 'sm'
      ? 'h-9 w-9'
      : size === 'lg'
        ? 'h-14 w-14'
        : 'h-11 w-11';

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br p-[1.5px] ${meta.ring} ${dims} ${
        !isOnline ? 'opacity-55 grayscale-[40%]' : ''
      }`}
    >
      <div
        className={`flex h-full w-full items-center justify-center rounded-[10.5px] ${meta.bg}`}
      >
        <RuneGlyph id={meta.id} />
      </div>
    </div>
  );
}
