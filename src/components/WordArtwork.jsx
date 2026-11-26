import React, { useState, useEffect } from 'react';

function LocationSceneSvg({ wordId }) {
  switch (wordId) {
    case 'loc_roshpit':
      return (
        <svg viewBox="0 0 240 135" className="h-full w-full" fill="none">
          <rect width="240" height="135" fill="#0d0818" />
          <radialGradient id="roshGlow" cx="50%" cy="55%" r="55%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#10b981" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0d0818" stopOpacity="0" />
          </radialGradient>
          <rect width="240" height="135" fill="url(#roshGlow)" />
          {/* Cave arch */}
          <path
            d="M15 135 L35 38 L85 16 L155 16 L205 38 L225 135 Z"
            fill="#140e24"
            stroke="#6d28d9"
            strokeWidth="2"
          />
          {/* Roshan horned silhouette & glowing eyes */}
          <path
            d="M86 112 C86 78, 154 78, 154 112 Z"
            fill="#1f1535"
            stroke="#a855f7"
            strokeWidth="1.8"
          />
          <path
            d="M95 72 Q72 48 64 28 Q88 45 106 62 Z"
            fill="#c084fc"
            opacity="0.85"
          />
          <path
            d="M145 72 Q168 48 176 28 Q152 45 134 62 Z"
            fill="#c084fc"
            opacity="0.85"
          />
          <circle cx="110" cy="76" r="3.5" fill="#34d399" />
          <circle cx="130" cy="76" r="3.5" fill="#34d399" />
          {/* Aegis glow at bottom */}
          <polygon
            points="120,95 132,104 120,122 108,104"
            fill="#fbbf24"
            opacity="0.85"
          />
        </svg>
      );

    case 'loc_ancient':
      return (
        <svg viewBox="0 0 240 135" className="h-full w-full" fill="none">
          <rect width="240" height="135" fill="#0a0918" />
          <circle cx="120" cy="68" r="52" fill="rgba(16,185,129,0.18)" />
          <polygon
            points="120,18 148,68 120,118 92,68"
            fill="rgba(139,92,246,0.35)"
            stroke="#34d399"
            strokeWidth="2.5"
          />
          <polygon
            points="72,48 88,76 72,104 56,76"
            fill="rgba(16,185,129,0.3)"
            stroke="#a855f7"
            strokeWidth="1.8"
          />
          <polygon
            points="168,48 184,76 168,104 152,76"
            fill="rgba(16,185,129,0.3)"
            stroke="#a855f7"
            strokeWidth="1.8"
          />
          <circle cx="120" cy="68" r="9" fill="#6ee7b7" />
        </svg>
      );

    case 'loc_secret_shop':
      return (
        <svg viewBox="0 0 240 135" className="h-full w-full" fill="none">
          <rect width="240" height="135" fill="#0b0d18" />
          <path d="M58 95 L120 32 L182 95 Z" fill="#2e1065" stroke="#c084fc" strokeWidth="2.2" />
          <rect x="76" y="95" width="88" height="26" fill="#17112b" stroke="#34d399" strokeWidth="1.8" />
          <circle cx="176" cy="76" r="8" fill="#fbbf24" />
          <circle cx="176" cy="76" r="16" fill="rgba(251,191,36,0.2)" />
          <path d="M108 121 V102 H132 V121" fill="#052e2b" stroke="#34d399" strokeWidth="1.6" />
        </svg>
      );

    case 'loc_mid':
      return (
        <svg viewBox="0 0 240 135" className="h-full w-full" fill="none">
          <rect width="240" height="135" fill="#091118" />
          {/* River */}
          <path d="M0 20 L240 115" stroke="#0ea5e9" strokeWidth="26" strokeOpacity="0.28" />
          {/* Mid lane crossing */}
          <path d="M25 120 L215 15" stroke="#a855f7" strokeWidth="18" strokeOpacity="0.38" />
          <circle cx="70" cy="95" r="10" fill="#10b981" fillOpacity="0.7" stroke="#a7f3d0" strokeWidth="2" />
          <circle cx="170" cy="40" r="10" fill="#c084fc" fillOpacity="0.7" stroke="#f3e8ff" strokeWidth="2" />
        </svg>
      );

    case 'loc_tormentor':
      return (
        <svg viewBox="0 0 240 135" className="h-full w-full" fill="none">
          <rect width="240" height="135" fill="#0b0818" />
          <rect
            x="82"
            y="30"
            width="76"
            height="76"
            rx="10"
            transform="rotate(15 120 68)"
            fill="rgba(139,92,246,0.28)"
            stroke="#c084fc"
            strokeWidth="2.5"
          />
          <rect
            x="96"
            y="44"
            width="48"
            height="48"
            rx="6"
            transform="rotate(-15 120 68)"
            fill="rgba(16,185,129,0.25)"
            stroke="#34d399"
            strokeWidth="2.2"
          />
          <circle cx="120" cy="68" r="10" fill="#e879f9" />
        </svg>
      );

    case 'loc_twin_gates':
      return (
        <svg viewBox="0 0 240 135" className="h-full w-full" fill="none">
          <rect width="240" height="135" fill="#090714" />
          <ellipse cx="78" cy="70" rx="26" ry="42" fill="rgba(139,92,246,0.32)" stroke="#c084fc" strokeWidth="2.5" />
          <ellipse cx="162" cy="70" rx="26" ry="42" fill="rgba(16,185,129,0.3)" stroke="#34d399" strokeWidth="2.5" />
          <path d="M104 70 C115 50, 125 90, 136 70" stroke="#e9d5ff" strokeWidth="2" strokeDasharray="4 3" />
        </svg>
      );

    case 'loc_lotus_pool':
      return (
        <svg viewBox="0 0 240 135" className="h-full w-full" fill="none">
          <rect width="240" height="135" fill="#071318" />
          <ellipse cx="120" cy="84" rx="76" ry="28" fill="rgba(16,185,129,0.22)" stroke="#34d399" strokeWidth="2" />
          <path d="M120 38 C134 55, 134 75, 120 84 C106 75, 106 55, 120 38 Z" fill="#f472b6" />
          <path d="M120 84 C142 74, 152 56, 142 46 C130 52, 124 68, 120 84 Z" fill="#e879f9" opacity="0.85" />
          <path d="M120 84 C98 74, 88 56, 98 46 C110 52, 116 68, 120 84 Z" fill="#c084fc" opacity="0.85" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 240 135" className="h-full w-full" fill="none">
          <rect width="240" height="135" fill="#0c081a" />
          <circle cx="120" cy="67" r="46" fill="rgba(139,92,246,0.22)" stroke="#a855f7" strokeWidth="2" />
          <polygon
            points="120,30 152,67 120,104 88,67"
            fill="rgba(16,185,129,0.28)"
            stroke="#34d399"
            strokeWidth="2.2"
          />
          <circle cx="120" cy="67" r="8" fill="#6ee7b7" />
        </svg>
      );
  }
}

export function WordArtwork({ word, className = 'h-40 w-full' }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [word?.id, word?.image]);

  if (!word) return null;

  const showImg = Boolean(word.image && !imgFailed);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-[#0b0718] shadow-[0_10px_35px_rgba(16,185,129,0.18)] ${className}`}
    >
      {showImg ? (
        <>
          {/* Blurred ambient backdrop so item icons and hero portraits fill wide frames richly */}
          <img
            src={word.image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-xl"
          />
          <div className="relative z-10 flex h-full w-full items-center justify-center p-2">
            <img
              src={word.image}
              alt={word.name}
              onError={() => setImgFailed(true)}
              className="max-h-full max-w-full rounded-xl object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.75)]"
            />
          </div>
        </>
      ) : (
        <LocationSceneSvg wordId={word.id} />
      )}

      {/* Subtle top-right category badge */}
      <div className="pointer-events-none absolute top-2.5 right-2.5 z-20 rounded-lg border border-violet-400/35 bg-[#090613]/85 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 backdrop-blur-md">
        {word.category === 'heroes'
          ? 'Герой'
          : word.category === 'items'
            ? 'Предмет'
            : 'Локация'}
      </div>
    </div>
  );
}
