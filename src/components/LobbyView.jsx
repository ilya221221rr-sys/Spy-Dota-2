import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  Clock,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Flame,
  Link2,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  Swords,
  UserMinus,
  Users,
} from 'lucide-react';
import { RuneAvatar } from './RuneAvatar.jsx';

const ROUND_TIME_OPTIONS = [
  { seconds: 0, label: 'Без лимита ∞' },
  { seconds: 30, label: '30с / ход' },
  { seconds: 45, label: '45с / ход' },
  { seconds: 60, label: '60с / ход' },
  { seconds: 90, label: '90с / ход' },
];

const SPY_COUNT_OPTIONS = [
  { count: 1, label: '1 шпион', hint: 'От 3 игроков' },
  { count: 2, label: '2 шпиона', hint: 'Лучше от 5+ игроков' },
];

const CATEGORY_ICONS = {
  heroes: Swords,
  items: Flame,
  locations: MapPin,
};

export function LobbyView({
  room,
  myPlayerId,
  isBusy,
  onLeaveRoom,
  onToggleReady,
  onUpdateSettings,
  onTransferHost,
  onKickPlayer,
  onSendChat,
  onStartGame,
  onNotify,
}) {
  const [hideCode, setHideCode] = useState(false);
  const [copiedType, setCopiedType] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const feedEndRef = useRef(null);

  const me = room.players.find((p) => p.id === myPlayerId);
  const isHost = Boolean(me?.isHost);
  const onlinePlayers = room.players.filter((p) => p.isOnline);
  const readyCount = onlinePlayers.filter((p) => p.isReady || p.isHost).length;
  const canStart = room.players.length >= 3;

  const categories =
    room.categoriesMeta && room.categoriesMeta.length > 0
      ? room.categoriesMeta
      : [
          {
            id: 'heroes',
            label: 'Герои',
            description: 'Все 127 героев Света и Тьмы',
            wordCount: 127,
          },
          {
            id: 'items',
            label: 'Предметы',
            description: 'Все предметы лавки, Рошана и нейтралки',
            wordCount: 331,
          },
          {
            id: 'locations',
            label: 'Локации',
            description: 'Ключевые точки и объекты карты Dota 2',
            wordCount: 20,
          },
        ];

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room.events?.length]);

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedType('code');
      onNotify({ type: 'emerald', message: `Код комнаты ${room.code} скопирован!` });
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      onNotify({ type: 'info', message: `Код комнаты: ${room.code}` });
    }
  };

  const copyInviteLink = async () => {
    const url = `${window.location.origin}/?room=${room.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedType('link');
      onNotify({ type: 'emerald', message: 'Ссылка-приглашение скопирована!' });
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      onNotify({ type: 'info', message: url });
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput('');
    await onSendChat(trimmed);
  };

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pt-4 pb-28 sm:px-6 sm:py-6 lg:pb-10">
      {/* Top Room Code Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/25 bg-[#100b1e]/90 p-4 shadow-xl backdrop-blur-xl sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-purple-400 to-emerald-400" />

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          {/* Code Display */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Код лобби для входа
                </span>
                <button
                  type="button"
                  onClick={() => setHideCode((v) => !v)}
                  title={hideCode ? 'Показать код' : 'Скрыть код (режим стримера)'}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-violet-500/15 hover:text-slate-200"
                >
                  {hideCode ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {room.code.split('').map((char, idx) => (
                  <div
                    key={idx}
                    className="font-mono-code flex h-12 w-11 items-center justify-center rounded-xl border border-emerald-400/35 bg-[#081210]/90 text-2xl font-extrabold text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_rgba(16,185,129,0.15)] sm:h-14 sm:w-12 sm:text-3xl"
                  >
                    {hideCode ? '•' : char}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyRoomCode}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/35 bg-violet-600/20 px-3.5 py-2.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-600/35"
              >
                {copiedType === 'code' ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 text-violet-300" />
                )}
                <span>Копировать код</span>
              </button>

              <button
                type="button"
                onClick={copyInviteLink}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-2.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
              >
                {copiedType === 'link' ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Link2 className="h-4 w-4 text-emerald-300" />
                )}
                <span>Ссылка друзьям</span>
              </button>
            </div>
          </div>

          {/* Leave Button */}
          <div className="flex items-center justify-end gap-2.5 border-t border-violet-500/15 pt-3 md:border-t-0 md:pt-0">
            <button
              type="button"
              onClick={onLeaveRoom}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/35 px-3.5 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/50"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-400" />
              <span>Выйти из лобби</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Players List & Chat */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* Players Card */}
          <section className="rounded-3xl border border-violet-500/20 bg-[#0f0a1c]/88 p-4 shadow-xl backdrop-blur-xl sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Users className="h-5 w-5 text-emerald-400" />
                <h2 className="font-display text-base text-white sm:text-lg">
                  ОТРЯД В ЛОББИ
                </h2>
                <span className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-xs font-bold text-violet-200">
                  {room.players.length} / 12
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>
                  Онлайн:{' '}
                  <strong className="text-emerald-300">{onlinePlayers.length}</strong>
                </span>
                <span>•</span>
                <span>
                  Готовы:{' '}
                  <strong className="text-violet-200">
                    {readyCount}/{onlinePlayers.length}
                  </strong>
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {room.players.map((player) => {
                const isMe = player.id === myPlayerId;

                return (
                  <div
                    key={player.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 transition sm:px-4 ${
                      isMe
                        ? 'border-emerald-400/35 bg-gradient-to-r from-violet-950/60 via-[#130d24] to-emerald-950/35'
                        : 'border-violet-500/15 bg-[#0a0714]/80'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative">
                        <RuneAvatar
                          avatarId={player.avatarId}
                          size="md"
                          isOnline={player.isOnline}
                        />
                        <span
                          title={
                            player.isOnline
                              ? 'В сети'
                              : 'Потерял связь — ожидание реконнекта'
                          }
                          className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[#0a0714] ${
                            player.isOnline
                              ? 'bg-emerald-400'
                              : 'animate-pulse bg-amber-400'
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-white sm:text-base">
                            {player.nickname}
                          </span>

                          {isMe && (
                            <span className="rounded-md border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                              Вы
                            </span>
                          )}

                          {player.isHost && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                              <Crown className="h-3 w-3 text-amber-400" />
                              Хост
                            </span>
                          )}
                        </div>

                        <div className="mt-0.5 flex items-center gap-2 text-xs">
                          {!player.isOnline ? (
                            <span className="font-medium text-amber-300">
                              Переподключение...
                            </span>
                          ) : player.isHost ? (
                            <span className="text-slate-400">Ведущий комнаты</span>
                          ) : player.isReady ? (
                            <span className="font-medium text-emerald-400">
                              Готов к охоте
                            </span>
                          ) : (
                            <span className="text-slate-400">Ожидает старта</span>
                          )}
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{player.score} очк.</span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: status badge + Host management buttons */}
                    <div className="ml-auto flex items-center gap-1.5">
                      {isHost && !isMe && (
                        <>
                          {player.isOnline && (
                            <button
                              type="button"
                              onClick={() => onTransferHost(player.id)}
                              title={`Передать права хоста игроку ${player.nickname}`}
                              className="inline-flex items-center gap-1 rounded-xl border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25"
                            >
                              <Crown className="h-3.5 w-3.5 text-amber-400" />
                              <span className="hidden sm:inline">Сделать хостом</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onKickPlayer(player.id)}
                            title={`Исключить ${player.nickname}`}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-500/25 bg-rose-950/40 p-1.5 text-rose-300 transition hover:bg-rose-900/60"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {!isHost && (
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            !player.isOnline
                              ? 'bg-amber-500/15 text-amber-300'
                              : player.isHost || player.isReady
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-slate-800/80 text-slate-400'
                          }`}
                        >
                          {!player.isOnline
                            ? 'Оффлайн'
                            : player.isHost || player.isReady
                              ? 'Готов'
                              : 'Не готов'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {onlinePlayers.length < 3 && (
              <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-violet-400/20 bg-violet-950/25 px-3.5 py-2.5 text-xs text-slate-300">
                <ShieldAlert className="h-4 w-4 shrink-0 text-violet-400" />
                <span>
                  Пригласите ещё минимум{' '}
                  <strong className="text-emerald-300">
                    {3 - onlinePlayers.length}
                  </strong>{' '}
                  {3 - onlinePlayers.length === 1 ? 'игрока' : 'игроков'} по коду{' '}
                  <strong className="font-mono-code text-white">{room.code}</strong>{' '}
                  (можно открыть вторую вкладку браузера для теста).
                </span>
              </div>
            )}
          </section>

          {/* Lobby Event Feed & Chat */}
          <section className="rounded-3xl border border-violet-500/20 bg-[#0f0a1c]/88 p-4 shadow-xl backdrop-blur-xl sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-violet-400" />
              <h3 className="font-display text-sm text-slate-200">
                ЧАТ И СОБЫТИЯ КОМНАТЫ
              </h3>
            </div>

            <div className="mb-3 max-h-44 space-y-1.5 overflow-y-auto rounded-2xl border border-violet-500/15 bg-[#080510]/85 p-3 text-xs">
              {(room.events || []).map((ev) => (
                <div key={ev.id} className="leading-relaxed">
                  {ev.type === 'chat' ? (
                    <div>
                      <span className="font-bold text-emerald-300">{ev.author}: </span>
                      <span className="text-slate-200">{ev.message}</span>
                    </div>
                  ) : (
                    <div className="text-violet-300/85">• {ev.message}</div>
                  )}
                </div>
              ))}
              <div ref={feedEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                maxLength={140}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Написать в лобби (например: го категорию Герои!)..."
                className="min-w-0 flex-1 rounded-xl border border-violet-500/25 bg-[#090613] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none sm:text-sm"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-500/20 px-4 py-2.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Отправить</span>
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Host Game Settings */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          <section className="rounded-3xl border border-violet-500/20 bg-[#0f0a1c]/88 p-4 shadow-xl backdrop-blur-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-base text-white sm:text-lg">
                ПАРАМЕТРЫ МАТЧА
              </h2>
              {isHost ? (
                <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  Вы управляете
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-violet-500/25 bg-violet-950/40 px-2.5 py-0.5 text-[11px] text-slate-400">
                  <Lock className="h-3 w-3" />
                  Выбирает хост
                </span>
              )}
            </div>

            <div className="space-y-5">
              {/* Category Selector */}
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Категория слов
                </span>
                <div className="space-y-2">
                  {categories.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.id] || Swords;
                    const active = room.settings.category === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        disabled={!isHost}
                        onClick={() => onUpdateSettings({ category: cat.id })}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition ${
                          active
                            ? 'border-emerald-400/55 bg-gradient-to-r from-violet-900/50 to-emerald-900/40 shadow-[0_0_24px_rgba(16,185,129,0.18)]'
                            : 'border-violet-500/15 bg-[#090613]/80 hover:border-violet-400/35'
                        } ${!isHost ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                              active
                                ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                                : 'border-violet-500/25 bg-violet-950/40 text-violet-300'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              {cat.label}
                            </div>
                            <div className="text-xs text-slate-400">
                              {cat.description}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold ${
                            active
                              ? 'bg-emerald-400/20 text-emerald-200'
                              : 'bg-slate-800/80 text-slate-400'
                          }`}
                        >
                          {cat.wordCount} слов
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Turn Time Selector (Endless Rounds) */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    <Clock className="h-3.5 w-3.5 text-violet-400" />
                    Раунды ходов (время на ход)
                  </span>
                  <span className="text-xs font-bold text-emerald-300">
                    {room.settings.roundTimeSeconds === 0
                      ? 'Бесконечно ∞'
                      : `${room.settings.roundTimeSeconds} сек / ход`}
                  </span>
                </div>
                <p className="mb-2 text-[11px] text-slate-400">
                  Круги ходов идут бесконечно, пока игроки сами не запустят голосование
                </p>

                <div className="grid grid-cols-5 gap-1.5">
                  {ROUND_TIME_OPTIONS.map((opt) => {
                    const active = room.settings.roundTimeSeconds === opt.seconds;
                    return (
                      <button
                        key={opt.seconds}
                        type="button"
                        disabled={!isHost}
                        onClick={() =>
                          onUpdateSettings({ roundTimeSeconds: opt.seconds })
                        }
                        className={`rounded-xl border px-1 py-2.5 text-[11px] font-bold transition ${
                          active
                            ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                            : 'border-violet-500/15 bg-[#090613]/80 text-slate-400 hover:border-violet-400/35 hover:text-slate-200'
                        } ${!isHost ? 'cursor-default' : ''}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Spy Count Selector */}
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Количество шпионов
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {SPY_COUNT_OPTIONS.map((opt) => {
                    const active = room.settings.spyCount === opt.count;
                    return (
                      <button
                        key={opt.count}
                        type="button"
                        disabled={!isHost}
                        onClick={() => onUpdateSettings({ spyCount: opt.count })}
                        className={`rounded-2xl border p-3 text-left transition ${
                          active
                            ? 'border-violet-400/60 bg-violet-600/25 shadow-[0_0_18px_rgba(139,92,246,0.25)]'
                            : 'border-violet-500/15 bg-[#090613]/80 hover:border-violet-400/35'
                        } ${!isHost ? 'cursor-default' : ''}`}
                      >
                        <div className="text-sm font-bold text-white">{opt.label}</div>
                        <div className="text-[11px] text-slate-400">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Desktop Action CTA */}
              <div className="hidden pt-2 lg:block">
                {isHost ? (
                  <button
                    type="button"
                    disabled={!canStart || isBusy}
                    onClick={onStartGame}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold tracking-wide transition ${
                      canStart
                        ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-emerald-600 text-white shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:from-violet-500 hover:to-emerald-500'
                        : 'cursor-not-allowed border border-violet-500/20 bg-slate-900/70 text-slate-400'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {canStart
                        ? 'Начать игру (Раздать роли в Смоках)'
                        : `Ожидание игроков (${room.players.length}/3)`}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onToggleReady}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold tracking-wide transition ${
                      me?.isReady
                        ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                        : 'bg-gradient-to-r from-emerald-600 to-violet-600 text-white shadow-[0_10px_25px_rgba(16,185,129,0.3)] hover:from-emerald-500 hover:to-violet-500'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    <span>
                      {me?.isReady ? 'Вы готовы! (Нажмите для отмены)' : 'Я готов к игре!'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-violet-500/25 bg-[#0b0716]/95 p-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto max-w-xl">
          {isHost ? (
            <button
              type="button"
              disabled={!canStart || isBusy}
              onClick={onStartGame}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition ${
                canStart
                  ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-emerald-600 text-white shadow-lg'
                  : 'border border-violet-500/20 bg-slate-900/80 text-slate-400'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {canStart
                  ? 'Начать игру (Смоки)'
                  : `Нужно минимум 3 игрока (${room.players.length}/3)`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleReady}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition ${
                me?.isReady
                  ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                  : 'bg-gradient-to-r from-emerald-600 to-violet-600 text-white shadow-lg'
              }`}
            >
              <Check className="h-4 w-4" />
              <span>
                {me?.isReady ? 'Готов! (Снять готовность)' : 'Я готов к игре!'}
              </span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
