import React from 'react';
import { Database, Wifi, WifiOff } from 'lucide-react';

export function HeaderBar({ isSocketConnected, supabaseStatus, roomCode, onLogoClick }) {
  return (
    <header className="relative z-20 border-b border-violet-500/15 bg-[#0a0714]/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onLogoClick}
          className="group flex items-center gap-2.5 text-left focus:outline-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-600/35 via-purple-900/50 to-emerald-500/30 shadow-[0_0_20px_rgba(139,92,246,0.3)] transition group-hover:border-emerald-400/50">
            <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none">
              <path
                d="M5 21L21 5M8 5h4L23 16v4"
                stroke="url(#spyGrad)"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="20" r="2.5" fill="#34d399" />
              <defs>
                <linearGradient id="spyGrad" x1="4" y1="4" x2="24" y2="24">
                  <stop stopColor="#c084fc" />
                  <stop offset="1" stopColor="#34d399" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-display bg-gradient-to-r from-violet-200 via-purple-100 to-emerald-300 bg-clip-text text-base tracking-wide text-transparent sm:text-lg">
                SPY DOTA 2
              </span>
              <span className="hidden rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 sm:inline-block">
                Smoke Edition
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Вычисли шпиона под Смоками
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {roomCode && (
            <div className="hidden items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-950/40 px-2.5 py-1 text-xs sm:flex">
              <span className="text-slate-400">Комната:</span>
              <span className="font-mono-code font-bold tracking-widest text-emerald-300">
                {roomCode}
              </span>
            </div>
          )}

          {/* Supabase status pill */}
          <div
            title={
              supabaseStatus === 'synced'
                ? 'Данные комнат синхронизируются с Supabase PostgreSQL'
                : 'Подключение к Supabase PostgreSQL'
            }
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-medium text-emerald-300"
          >
            <Database className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Supabase</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                supabaseStatus === 'offline' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
          </div>

          {/* Socket status pill */}
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
              isSocketConnected
                ? 'border-violet-500/30 bg-violet-950/40 text-violet-200'
                : 'border-rose-500/40 bg-rose-950/50 text-rose-200'
            }`}
          >
            {isSocketConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden xs:inline sm:inline">Онлайн</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 animate-pulse text-rose-400" />
                <span>Реконнект...</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
