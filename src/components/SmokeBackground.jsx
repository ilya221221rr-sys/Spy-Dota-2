import React, { useEffect, useRef, useState } from 'react';
import { Eye, ShieldAlert, Sparkles } from 'lucide-react';
import { WordArtwork } from './WordArtwork.jsx';

export function SmokeBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = Math.min(36, Math.max(18, Math.floor(width / 42)));
    const particles = Array.from({ length: particleCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2.2 + 0.8,
      vx: (Math.random() - 0.5) * 0.28,
      vy: -Math.random() * 0.35 - 0.08,
      alpha: Math.random() * 0.45 + 0.12,
      isEmerald: i % 2 === 0,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.isEmerald
          ? `rgba(52, 211, 153, ${p.alpha})`
          : `rgba(168, 85, 247, ${p.alpha})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#07050d]"
    >
      {/* Subtle Dota map arcane grid */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(168,85,247,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,185,129,0.4) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      {/* Volumetric Smoke of Deceit clouds */}
      <div
        className="smoke-orb-violet absolute -top-36 -left-32 h-[540px] w-[540px] rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, rgba(139, 92, 246, 0.34) 0%, rgba(88, 28, 135, 0.16) 55%, transparent 75%)',
        }}
      />
      <div
        className="smoke-orb-emerald absolute top-1/4 -right-36 h-[560px] w-[560px] rounded-full blur-[130px]"
        style={{
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.27) 0%, rgba(6, 95, 70, 0.14) 55%, transparent 75%)',
        }}
      />
      <div
        className="smoke-orb-mixed absolute -bottom-44 left-1/4 h-[520px] w-[640px] rounded-full blur-[135px]"
        style={{
          background:
            'radial-gradient(circle, rgba(124, 58, 237, 0.24) 0%, rgba(16, 185, 129, 0.18) 48%, transparent 75%)',
        }}
      />

      {/* Vignette shadow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, transparent 35%, rgba(5, 3, 10, 0.72) 100%)',
        }}
      />

      {/* Floating arcane spores */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-75" />
    </div>
  );
}

/**
 * Полноэкранная анимация дыма Smoke of Deceit при показе секретной роли раунда
 */
export function RoleSmokeRevealModal({ open, myRole, onClose }) {
  const [stage, setStage] = useState('smoke'); // 'smoke' -> 'revealed'

  useEffect(() => {
    if (!open) {
      setStage('smoke');
      return;
    }
    setStage('smoke');
    const timer = setTimeout(() => {
      setStage('revealed');
    }, 1450);
    return () => clearTimeout(timer);
  }, [open, myRole?.roundNumber]);

  if (!open || !myRole) return null;

  const isSpy = Boolean(myRole.isSpy);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#05030a]/90 p-4 backdrop-blur-xl">
      {/* Billowing Purple & Emerald Smoke Clouds */}
      <div
        className="pointer-events-none absolute h-[95vmin] w-[95vmin] rounded-full blur-[80px] transition-all duration-1000"
        style={{
          transform: stage === 'smoke' ? 'scale(1.15) rotate(0deg)' : 'scale(1.55) rotate(16deg)',
          opacity: stage === 'smoke' ? 0.95 : 0.45,
          background:
            'radial-gradient(circle, rgba(147, 51, 234, 0.72) 0%, rgba(16, 185, 129, 0.55) 48%, transparent 74%)',
        }}
      />
      <div
        className="pointer-events-none absolute h-[80vmin] w-[80vmin] rounded-full blur-[70px] transition-all duration-1000"
        style={{
          transform: stage === 'smoke' ? 'scale(1.05) rotate(-10deg)' : 'scale(1.45) rotate(-22deg)',
          opacity: stage === 'smoke' ? 0.9 : 0.35,
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.65) 0%, rgba(109, 40, 217, 0.52) 52%, transparent 76%)',
        }}
      />

      {stage === 'smoke' ? (
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl border border-emerald-400/45 bg-violet-950/70 shadow-[0_0_50px_rgba(16,185,129,0.5)]">
            <Sparkles className="h-8 w-8 text-emerald-300" />
          </div>
          <h2 className="font-display bg-gradient-to-r from-violet-200 via-fuchsia-200 to-emerald-300 bg-clip-text text-2xl tracking-wider text-transparent sm:text-3xl">
            СМОКИ РАССЕИВАЮТСЯ...
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Раунд #{myRole.roundNumber} • Убедитесь, что никто не смотрит в ваш экран
          </p>
        </div>
      ) : (
        <div
          className={`relative z-10 w-full max-w-md overflow-hidden rounded-3xl border p-6 text-center shadow-2xl transition-all duration-500 sm:p-7 ${
            isSpy
              ? 'border-rose-500/50 bg-[#14091b]/95 shadow-[0_0_70px_rgba(244,63,94,0.3)]'
              : 'border-emerald-400/50 bg-[#0b141a]/95 shadow-[0_0_70px_rgba(16,185,129,0.28)]'
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 ${
              isSpy
                ? 'bg-gradient-to-r from-violet-500 via-rose-500 to-purple-500'
                : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-violet-500'
            }`}
          />

          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Раунд #{myRole.roundNumber} • Ваша роль
          </div>

          {isSpy ? (
            <>
              <div className="mx-auto my-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/45 bg-gradient-to-br from-rose-600/35 to-violet-800/45 shadow-[0_0_30px_rgba(244,63,94,0.35)]">
                <ShieldAlert className="h-9 w-9 text-rose-300" />
              </div>
              <h2 className="font-display bg-gradient-to-r from-rose-300 via-fuchsia-200 to-violet-300 bg-clip-text text-3xl text-transparent sm:text-4xl">
                ТЫ ШПИОН
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Вы скрыты в дыму <strong>Smoke of Deceit</strong> и не знаете
                загаданного слова. Слушайте ответы игроков, не выдайте себя и
                вычислите слово по списку категории!
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display mb-3 bg-gradient-to-r from-emerald-300 via-teal-200 to-violet-200 bg-clip-text text-2xl text-transparent sm:text-3xl">
                {myRole.word?.name}
              </h2>

              <WordArtwork word={myRole.word} className="mx-auto mb-3 h-44 w-full" />

              {myRole.word?.hint && (
                <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                  {myRole.word.hint}
                </p>
              )}
              <p className="mt-2 text-xs text-emerald-300/85">
                Вы в отряде мирных! Вычислите шпиона, не назвав слово напрямую.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition ${
              isSpy
                ? 'bg-gradient-to-r from-rose-600 via-fuchsia-600 to-violet-600 hover:from-rose-500 hover:to-violet-500'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-violet-600 hover:from-emerald-500 hover:to-violet-500'
            }`}
          >
            <Eye className="h-4 w-4" />
            <span>Понял, перейти к раунду</span>
          </button>
        </div>
      )}
    </div>
  );
}
