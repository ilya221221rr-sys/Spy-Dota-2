import React from 'react';
import { AlertCircle, CheckCircle2, Crown, Sparkles } from 'lucide-react';

export function ToastStack({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-16 right-3 left-3 z-50 flex flex-col items-center gap-2 sm:right-5 sm:left-auto sm:items-end">
      {toasts.map((t) => {
        const styleMap = {
          error:
            'border-rose-500/45 bg-[#1b0b14]/95 text-rose-100 shadow-[0_8px_30px_rgba(244,63,94,0.22)]',
          emerald:
            'border-emerald-500/40 bg-[#091a16]/95 text-emerald-100 shadow-[0_8px_30px_rgba(16,185,129,0.2)]',
          gold:
            'border-amber-400/45 bg-[#1a1408]/95 text-amber-100 shadow-[0_8px_30px_rgba(251,191,36,0.2)]',
          smoke:
            'border-violet-400/40 bg-[#130d24]/95 text-violet-100 shadow-[0_8px_30px_rgba(139,92,246,0.25)]',
          info:
            'border-violet-500/30 bg-[#110c1f]/95 text-slate-100 shadow-[0_8px_30px_rgba(15,10,30,0.5)]',
        };

        const cls = styleMap[t.type] || styleMap.info;

        return (
          <div
            key={t.id}
            onClick={() => onDismiss(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium backdrop-blur-xl transition sm:text-sm ${cls}`}
          >
            {t.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
            {t.type === 'emerald' && (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            {t.type === 'gold' && <Crown className="h-4 w-4 shrink-0 text-amber-400" />}
            {(t.type === 'smoke' || t.type === 'info' || !t.type) && (
              <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
            )}
            <span className="leading-snug">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
