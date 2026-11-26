import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Dices,
  KeyRound,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { RUNE_AVATARS, RuneAvatar } from './RuneAvatar.jsx';

const DOTA_NICK_SUGGESTIONS = [
  'Yatoro',
  'Collapse',
  'Miracle-',
  'Dendi',
  'Topson',
  'Puppey',
  'Nisha',
  'Larl',
  'Miposhka',
  'Riki_In_Smoke',
  'GrandMagus',
  'ButcherHook',
  'Invoker_QWE',
  'AegisCarrier',
];

export function HomeView({
  initialNickname,
  initialAvatarId,
  initialJoinCode,
  multiTabRoomHint,
  reconnectCandidate,
  platformStats,
  isBusy,
  onCreateRoom,
  onJoinRoom,
  onManualReconnect,
}) {
  const [mode, setMode] = useState(initialJoinCode ? 'join' : 'create');
  const [nickname, setNickname] = useState(initialNickname || '');
  const [avatarId, setAvatarId] = useState(initialAvatarId || 'smoke');
  const [roomCode, setRoomCode] = useState(initialJoinCode || '');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (initialJoinCode) {
      setRoomCode(initialJoinCode.toUpperCase().slice(0, 4));
      setMode('join');
    }
  }, [initialJoinCode]);

  const rollRandomNick = () => {
    const candidates = DOTA_NICK_SUGGESTIONS.filter((n) => n !== nickname);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    setNickname(chosen);
    setFormError('');
  };

  const handleCodeChange = (e) => {
    const cleaned = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4);
    setRoomCode(cleaned);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedNick = nickname.replace(/\s+/g, ' ').trim();
    if (trimmedNick.length < 2) {
      setFormError('Введите игровой ник (минимум 2 символа)');
      return;
    }

    if (mode === 'create') {
      const err = await onCreateRoom({ nickname: trimmedNick, avatarId });
      if (err) setFormError(err);
    } else {
      const cleanCode = roomCode.trim().toUpperCase();
      if (cleanCode.length !== 4) {
        setFormError('Введите 4-символьный код комнаты');
        return;
      }
      const err = await onJoinRoom({
        roomCode: cleanCode,
        nickname: trimmedNick,
        avatarId,
      });
      if (err) setFormError(err);
    }
  };

  const handleQuickJoinMultiTab = () => {
    if (!multiTabRoomHint?.roomCode) return;
    setMode('join');
    setRoomCode(multiTabRoomHint.roomCode);
    if (!nickname || nickname === multiTabRoomHint.nickname) {
      const available = DOTA_NICK_SUGGESTIONS.filter(
        (n) => n.toLowerCase() !== String(multiTabRoomHint.nickname || '').toLowerCase()
      );
      setNickname(available[Math.floor(Math.random() * available.length)]);
    }
    setFormError('');
  };

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Left Hero Column */}
        <section className="space-y-5 lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/40 px-3.5 py-1 text-xs font-medium text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.18)]">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Социальная дедукция во вселенной Dota 2</span>
          </div>

          <h1 className="font-display text-3xl leading-tight tracking-wide text-white sm:text-4xl lg:text-5xl">
            КТО В ОТРЯДЕ{' '}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-emerald-400 bg-clip-text text-transparent">
              ВРАЖЕСКИЙ ШПИОН?
            </span>
          </h1>

          <p className="max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Соберите друзей по 4-символьному коду комнаты. Мирные игроки видят
            загаданного героя, предмет или локацию Dota 2, а{' '}
            <span className="font-semibold text-violet-300">Шпион под Смоками</span>{' '}
            не знает секретного слова и должен выведать его, не выдав себя.
          </p>

          {/* Feature / Rules Pills */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-violet-500/20 bg-[#110c20]/75 p-3.5 backdrop-blur-md">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-violet-300">
                <KeyRound className="h-4 w-4 text-violet-400" />
                <span>Код из 4 символов</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Мгновенный вход с телефона или ПК без регистрации.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-[#0c1917]/75 p-3.5 backdrop-blur-md">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <Users className="h-4 w-4 text-emerald-400" />
                <span>От 3 до 12 игроков</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Герои, предметы и локации карты с передачей прав хоста.
              </p>
            </div>

            <div className="rounded-2xl border border-violet-500/20 bg-[#110c20]/75 p-3.5 backdrop-blur-md">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-fuchsia-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Авто-реконнект</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Обновление страницы или смена сети возвращает вас в лобби.
              </p>
            </div>
          </div>

          {/* Live Supabase Platform Stats */}
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>
                Слов в базе Supabase:{' '}
                <strong className="text-slate-200">
                  {platformStats?.words_count ?? 42}
                </strong>
              </span>
            </div>
            {platformStats && (
              <>
                <span className="text-slate-700">•</span>
                <div>
                  Комнат за 24ч:{' '}
                  <strong className="text-emerald-300">
                    {platformStats.active_rooms ?? 0}
                  </strong>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Right Form Card */}
        <section className="lg:col-span-6">
          <div className="rune-glow relative overflow-hidden rounded-3xl border border-violet-400/25 bg-[#0f0b1d]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
            {/* Top gradient accent bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-400" />

            {/* Reconnect banner if an offline session exists */}
            {reconnectCandidate && (
              <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-950/45 p-3.5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold text-emerald-300">
                    Найдена незавершённая сессия
                  </p>
                  <p className="text-xs text-slate-300">
                    Комната{' '}
                    <span className="font-mono-code font-bold text-white">
                      {reconnectCandidate.roomCode}
                    </span>{' '}
                    • Ник: <strong>{reconnectCandidate.nickname}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onManualReconnect}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Вернуться
                </button>
              </div>
            )}

            {/* Multi-tab helper banner when another tab is already hosting/playing */}
            {!reconnectCandidate && multiTabRoomHint && (
              <div className="mb-5 flex flex-col justify-between gap-2.5 rounded-2xl border border-violet-400/35 bg-violet-950/40 p-3.5 sm:flex-row sm:items-center">
                <div className="text-xs">
                  <p className="font-semibold text-violet-200">
                    Комната{' '}
                    <span className="font-mono-code text-emerald-300">
                      {multiTabRoomHint.roomCode}
                    </span>{' '}
                    активна в соседней вкладке
                  </p>
                  <p className="text-slate-400">
                    Можно подключиться вторым игроком для проверки лобби
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleQuickJoinMultiTab}
                  className="shrink-0 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
                >
                  Подставить код {multiTabRoomHint.roomCode}
                </button>
              </div>
            )}

            {/* Mode Switcher Tabs */}
            <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl border border-violet-500/20 bg-[#090612]/90 p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode('create');
                  setFormError('');
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition sm:text-sm ${
                  mode === 'create'
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_4px_20px_rgba(124,58,237,0.45)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PlusCircle className="h-4 w-4" />
                <span>Создать комнату</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('join');
                  setFormError('');
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition sm:text-sm ${
                  mode === 'join'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                <span>Войти по коду</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nickname Input */}
              <div>
                <label
                  htmlFor="nickname-input"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Ваш игровой ник
                </label>
                <div className="relative flex items-center">
                  <input
                    id="nickname-input"
                    type="text"
                    maxLength={18}
                    value={nickname}
                    onChange={(e) => {
                      setNickname(e.target.value);
                      setFormError('');
                    }}
                    placeholder="Например, Yatoro или Pudge_Master"
                    autoComplete="off"
                    className="w-full rounded-xl border border-violet-500/30 bg-[#090613] py-3 pr-11 pl-4 text-sm font-medium text-white placeholder-slate-500 transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={rollRandomNick}
                    title="Случайный ник из Dota 2"
                    className="absolute right-2 rounded-lg p-2 text-slate-400 transition hover:bg-violet-500/15 hover:text-emerald-300"
                  >
                    <Dices className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 4-char Room Code Input (Join mode) */}
              {mode === 'join' && (
                <div>
                  <label
                    htmlFor="room-code-input"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-emerald-300"
                  >
                    Код комнаты (4 символа)
                  </label>
                  <input
                    id="room-code-input"
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={4}
                    value={roomCode}
                    onChange={handleCodeChange}
                    placeholder="K7X2"
                    className="font-mono-code w-full rounded-xl border border-emerald-500/35 bg-[#07110f] py-3.5 text-center text-2xl font-extrabold tracking-[0.45em] text-emerald-300 uppercase placeholder-emerald-900/70 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/25 focus:outline-none"
                  />
                </div>
              )}

              {/* Rune Avatar Picker */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Выберите руну-эмблему
                  </span>
                  <span className="text-xs font-medium text-violet-300">
                    {RUNE_AVATARS.find((a) => a.id === avatarId)?.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {RUNE_AVATARS.map((item) => {
                    const selected = avatarId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAvatarId(item.id)}
                        title={item.label}
                        className={`flex flex-col items-center justify-center rounded-xl border p-1.5 transition ${
                          selected
                            ? 'border-emerald-400 bg-violet-500/20 shadow-[0_0_16px_rgba(52,211,153,0.3)]'
                            : 'border-violet-500/15 bg-[#090613]/70 opacity-75 hover:border-violet-400/40 hover:opacity-100'
                        }`}
                      >
                        <RuneAvatar avatarId={item.id} size="sm" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {formError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3.5 py-2.5 text-xs font-medium text-rose-200">
                  {formError}
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isBusy}
                className={`group flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold tracking-wide text-white shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 ${
                  mode === 'create'
                    ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-emerald-600 hover:from-violet-500 hover:via-purple-500 hover:to-emerald-500 shadow-[0_10px_30px_rgba(124,58,237,0.35)]'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-violet-600 hover:from-emerald-500 hover:via-teal-500 hover:to-violet-500 shadow-[0_10px_30px_rgba(16,185,129,0.35)]'
                }`}
              >
                <span>
                  {isBusy
                    ? 'Подключение к серверу...'
                    : mode === 'create'
                      ? 'Создать комнату и получить код'
                      : 'Войти в комнату под Смоками'}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
