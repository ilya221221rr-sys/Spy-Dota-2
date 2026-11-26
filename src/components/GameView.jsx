import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Infinity as InfinityIcon,
  LogOut,
  MessageSquare,
  Mic,
  Repeat,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Trophy,
  Vote,
  X,
} from 'lucide-react';
import { RuneAvatar } from './RuneAvatar.jsx';
import { WordArtwork } from './WordArtwork.jsx';

const CATEGORY_LABELS = {
  heroes: 'Герои',
  items: 'Предметы',
  locations: 'Локации',
};

const SUBFILTERS_BY_CATEGORY = {
  heroes: [
    { id: 'all', label: 'Все' },
    { id: 'str', label: 'Сила' },
    { id: 'agi', label: 'Ловкость' },
    { id: 'int', label: 'Интеллект' },
    { id: 'uni', label: 'Универсал' },
  ],
  items: [
    { id: 'all', label: 'Все' },
    { id: 'shop', label: 'Лавка' },
    { id: 'neutral', label: 'Нейтралки' },
    { id: 'consumable', label: 'Расходники / Рошан' },
  ],
  locations: [],
};

function matchesWordFilter(word, query, subfilter) {
  if (subfilter && subfilter !== 'all') {
    const hint = (word.hint || '').toLowerCase();
    if (subfilter === 'str' && !hint.startsWith('сила')) return false;
    if (subfilter === 'agi' && !hint.startsWith('ловкость')) return false;
    if (subfilter === 'int' && !hint.startsWith('интеллект')) return false;
    if (subfilter === 'uni' && !hint.startsWith('универсал')) return false;
    if (subfilter === 'shop' && !hint.startsWith('лавка')) return false;
    if (subfilter === 'neutral' && !hint.startsWith('нейтральный')) return false;
    if (
      subfilter === 'consumable' &&
      !hint.startsWith('расходник') &&
      !hint.startsWith('трофей рошана')
    ) {
      return false;
    }
  }

  const q = (query || '').trim().toLowerCase();
  if (!q) return true;

  return (
    (word.name || '').toLowerCase().includes(q) ||
    (word.nameEn || '').toLowerCase().includes(q) ||
    (word.hint || '').toLowerCase().includes(q)
  );
}

function formatSeconds(sec) {
  const safe = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function GameView({
  room,
  myPlayerId,
  myRole,
  discussion,
  voting,
  spyGuess,
  results,
  clockOffsetMs,
  isBusy,
  onReopenSmokeModal,
  onSubmitTurn,
  onSkipTurn,
  onStartVotingEarly,
  onCastVote,
  onSubmitSpyGuess,
  onRematch,
  onReturnToLobby,
  onTransferHost,
  onSendChat,
  onLeaveRoom,
  onTimerExpired,
}) {
  const [hideRoleCard, setHideRoleCard] = useState(false);
  const [crossedWordIds, setCrossedWordIds] = useState({});
  const [hideCrossed, setHideCrossed] = useState(false);
  const [wordSearch, setWordSearch] = useState('');
  const [wordSubfilter, setWordSubfilter] = useState('all');
  const [guessSearch, setGuessSearch] = useState('');
  const [guessSubfilter, setGuessSubfilter] = useState('all');
  const [selectedGuessWordId, setSelectedGuessWordId] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [turnInput, setTurnInput] = useState('');
  const [chatInput, setChatInput] = useState('');

  const feedEndRef = useRef(null);
  const turnLogEndRef = useRef(null);
  const expiredTriggeredRef = useRef(null);

  const me = room.players.find((p) => p.id === myPlayerId);
  const isHost = Boolean(me?.isHost);
  const status = room.status; // 'discussion' | 'voting' | 'spy_guess' | 'results'

  // Reset crossed-out notepad & filters on new round
  useEffect(() => {
    setCrossedWordIds({});
    setHideCrossed(false);
    setWordSearch('');
    setWordSubfilter('all');
    setGuessSearch('');
    setGuessSubfilter('all');
    setSelectedGuessWordId(null);
    setHideRoleCard(false);
  }, [room.currentRound]);

  // Synchronized server countdown timer
  useEffect(() => {
    if (!room.phaseEndsAt || status === 'results') {
      setSecondsLeft(null);
      return;
    }

    const endMs = new Date(room.phaseEndsAt).getTime();

    const tick = () => {
      const serverNowApprox = Date.now() + (clockOffsetMs || 0);
      const diffSec = Math.max(0, Math.ceil((endMs - serverNowApprox) / 1000));
      setSecondsLeft(diffSec);

      const phaseKey = `${room.currentRound}-${status}-${room.phaseEndsAt}`;
      if (diffSec === 0 && expiredTriggeredRef.current !== phaseKey) {
        expiredTriggeredRef.current = phaseKey;
        if (onTimerExpired) onTimerExpired();
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [room.phaseEndsAt, room.currentRound, status, clockOffsetMs, onTimerExpired]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room.events?.length]);

  useEffect(() => {
    turnLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussion?.turnLog?.length]);

  const toggleCrossWord = (wordId) => {
    setCrossedWordIds((prev) => ({
      ...prev,
      [wordId]: !prev[wordId],
    }));
  };

  const handleTurnSubmit = async (e) => {
    e.preventDefault();
    const trimmed = turnInput.trim();
    if (!trimmed || !onSubmitTurn) return;
    setTurnInput('');
    await onSubmitTurn(trimmed);
  };

  const handleVoiceTurnPass = async () => {
    if (!onSubmitTurn) return;
    const trimmed = turnInput.trim();
    setTurnInput('');
    await onSubmitTurn(trimmed);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput('');
    await onSendChat(trimmed);
  };

  const activeCategoryKey = myRole?.category || room.settings?.category || 'heroes';
  const categoryLabel = CATEGORY_LABELS[activeCategoryKey] || 'Dota 2';
  const subfilters = SUBFILTERS_BY_CATEGORY[activeCategoryKey] || [];
  const crossedCount = Object.values(crossedWordIds).filter(Boolean).length;

  const filteredDiscussionWords = (myRole?.categoryWords || []).filter((w) => {
    if (hideCrossed && crossedWordIds[w.id]) return false;
    return matchesWordFilter(w, wordSearch, wordSubfilter);
  });

  const filteredGuessWords = (spyGuess?.categoryWords || []).filter((w) =>
    matchesWordFilter(w, guessSearch, guessSubfilter)
  );
  const selectedGuessWordObj = (spyGuess?.categoryWords || []).find(
    (w) => w.id === selectedGuessWordId
  );

  const onlinePlayers = room.players.filter((p) => p.isOnline);
  const earlyVoteIds = myRole?.earlyVotePlayerIds || [];
  const iVotedEarly = earlyVoteIds.includes(myPlayerId);
  const majorityNeeded = Math.floor(Math.max(onlinePlayers.length, 3) / 2) + 1;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-4 pb-10 sm:px-6 sm:py-6">
      {/* Top Status & Server Timer Bar */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/25 bg-[#100b1e]/92 p-4 shadow-xl backdrop-blur-xl sm:px-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-emerald-400" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl border border-violet-400/35 bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-200">
              Партия #{room.currentRound}
            </span>

            {status === 'discussion' && discussion && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-3 py-1 text-xs font-extrabold text-emerald-200">
                <Repeat className="h-3.5 w-3.5 text-emerald-400" />
                <span>Круг #{discussion.cycle}</span>
                <InfinityIcon className="h-3.5 w-3.5 text-emerald-300" />
              </span>
            )}

            <span className="text-sm font-semibold text-slate-200">
              {status === 'discussion' &&
                (discussion?.currentTurnNickname
                  ? `Сейчас ход: ${discussion.currentTurnNickname}`
                  : 'Пошаговые раунды до голосования')}
              {status === 'voting' && 'Голосование: кто шпион?'}
              {status === 'spy_guess' && 'Шпион раскрыт: попытка угадать слово!'}
              {status === 'results' && 'Итоги партии и очки'}
            </span>

            <span className="hidden rounded-lg border border-emerald-500/25 bg-emerald-950/40 px-2.5 py-0.5 text-xs text-emerald-300 sm:inline-block">
              Категория: {categoryLabel}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {status === 'discussion' && secondsLeft === null && (
              <div className="hidden items-center gap-1.5 rounded-2xl border border-emerald-400/35 bg-[#081512] px-3 py-1.5 text-xs font-bold text-emerald-300 sm:flex">
                <InfinityIcon className="h-4 w-4" />
                <span>Раунды до голосования</span>
              </div>
            )}

            {secondsLeft !== null && status !== 'results' && (
              <div
                className={`font-mono-code flex items-center gap-2 rounded-2xl border px-3.5 py-1.5 text-base font-extrabold sm:text-lg ${
                  secondsLeft <= 15
                    ? 'animate-pulse border-rose-500/60 bg-rose-950/60 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                    : secondsLeft <= 40
                      ? 'border-amber-400/50 bg-amber-950/45 text-amber-200'
                      : 'border-emerald-400/40 bg-[#081512] text-emerald-300'
                }`}
                title={
                  status === 'discussion'
                    ? 'Время на текущий ход игрока'
                    : 'Оставшееся время фазы'
                }
              >
                <Clock className="h-4 w-4" />
                <span>{formatSeconds(secondsLeft)}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onLeaveRoom}
              title="Покинуть комнату"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/35 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/55"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* PHASE 4: RESULTS & SCOREBOARD & REMATCH                               */}
      {/* ===================================================================== */}
      {status === 'results' && results && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            {/* Victory Banner */}
            <section
              className={`relative overflow-hidden rounded-3xl border p-6 shadow-2xl backdrop-blur-xl ${
                results.winner === 'civilians'
                  ? 'border-emerald-400/45 bg-gradient-to-br from-[#091c18]/95 via-[#0e1322]/95 to-[#120c24]/95'
                  : 'border-rose-500/45 bg-gradient-to-br from-[#1d0b18]/95 via-[#150c24]/95 to-[#0e0a1a]/95'
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-0.5 text-xs font-semibold text-slate-200">
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    <span>Раунд #{results.roundNumber} завершён</span>
                  </div>
                  <h2
                    className={`font-display text-2xl sm:text-3xl ${
                      results.winner === 'civilians'
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {results.winner === 'civilians'
                      ? 'ПОБЕДА МИРНЫХ ИГРОКОВ!'
                      : 'ПОБЕДА ШПИОНА ПОД СМОКАМИ!'}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">
                    {results.winReason}
                  </p>
                </div>
              </div>

              {/* Secret Word & Spy Reveal Grid */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Secret Word Card */}
                <div className="rounded-2xl border border-emerald-400/30 bg-[#090714]/85 p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                    Загаданное слово
                  </div>
                  <div className="mb-2.5 text-base font-bold text-white">
                    {results.secretWord?.name}
                  </div>
                  <WordArtwork word={results.secretWord} className="h-32 w-full" />
                </div>

                {/* Spies Card */}
                <div className="flex flex-col justify-between rounded-2xl border border-violet-400/30 bg-[#090714]/85 p-4">
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                      В роли Шпиона {results.spyPlayerIds?.length > 1 ? 'были' : 'был'}
                    </div>
                    <div className="space-y-2">
                      {room.players
                        .filter((p) => (results.spyPlayerIds || []).includes(p.id))
                        .map((spy) => (
                          <div
                            key={spy.id}
                            className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-2.5"
                          >
                            <RuneAvatar avatarId={spy.avatarId} size="sm" />
                            <div>
                              <div className="text-sm font-bold text-white">
                                {spy.nickname}
                              </div>
                              <div className="text-[11px] text-rose-300">
                                Шпион под Смоками
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {results.spyGuessedWord && (
                    <div className="mt-3 rounded-xl border border-violet-500/25 bg-violet-950/35 p-2.5 text-xs">
                      <span className="text-slate-400">Догадка шпиона: </span>
                      <strong className="text-violet-200">
                        {results.spyGuessedWord.name}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Rematch & Return to Lobby CTA */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {isHost ? (
                  <>
                    <button
                      type="button"
                      disabled={isBusy || room.players.length < 3}
                      onClick={onRematch}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-emerald-600 py-3.5 px-5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition hover:from-violet-500 hover:to-emerald-500 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Реванш (Новый раунд)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={onReturnToLobby}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-400/35 bg-[#130d24] py-3.5 px-5 text-sm font-semibold text-violet-200 transition hover:bg-violet-900/40"
                    >
                      <Settings2 className="h-4 w-4" />
                      <span>В лобби (Настройки)</span>
                    </button>
                  </>
                ) : (
                  <div className="w-full rounded-2xl border border-violet-500/25 bg-[#0a0714]/80 px-4 py-3 text-center text-xs text-slate-300 sm:text-sm">
                    Ожидаем хоста комнаты — скоро начнётся <strong>Реванш</strong> или возврат в лобби!
                  </div>
                )}
              </div>
            </section>

            {/* Votes Breakdown */}
            {results.votesBreakdown && results.votesBreakdown.length > 0 && (
              <section className="rounded-3xl border border-violet-500/20 bg-[#0f0a1c]/88 p-5 backdrop-blur-xl">
                <h3 className="font-display mb-3 text-sm text-slate-200">
                  КАК ГОЛОСОВАЛ ОТРЯД
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {results.votesBreakdown.map((v, i) => {
                    const votedSpy = (results.spyPlayerIds || []).includes(v.targetId);
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-xl border border-violet-500/15 bg-[#090613]/85 px-3 py-2 text-xs"
                      >
                        <span className="truncate font-semibold text-slate-200">
                          {v.voterNickname}
                        </span>
                        <span className="text-slate-500">→</span>
                        <span
                          className={`truncate font-bold ${
                            votedSpy ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {v.targetNickname}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Scoreboard & Chat */}
          <div className="space-y-5 lg:col-span-5">
            <section className="rounded-3xl border border-violet-500/20 bg-[#0f0a1c]/88 p-5 shadow-xl backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                <h3 className="font-display text-base text-white">
                  ТАБЛИЦА ОЧКОВ
                </h3>
              </div>

              <div className="space-y-2.5">
                {[...room.players]
                  .sort((a, b) => b.score - a.score)
                  .map((p, idx) => {
                    const delta = Number(results.scoreDeltas?.[p.id] || 0);
                    const wasSpy = (results.spyPlayerIds || []).includes(p.id);

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-violet-500/15 bg-[#090613]/85 px-3.5 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="font-mono-code w-5 text-xs font-bold text-slate-400">
                            #{idx + 1}
                          </span>
                          <RuneAvatar avatarId={p.avatarId} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-bold text-white">
                                {p.nickname}
                              </span>
                              {wasSpy && (
                                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                                  Шпион
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {delta > 0 && (
                            <span className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                              +{delta}
                            </span>
                          )}
                          <span className="font-mono-code text-base font-extrabold text-amber-300">
                            {p.score}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PHASE 3: SPY CAUGHT — LAST CHANCE TO GUESS THE SECRET WORD            */}
      {/* ===================================================================== */}
      {status === 'spy_guess' && spyGuess && (
        <section className="rounded-3xl border border-amber-400/35 bg-[#120c1f]/92 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
          {spyGuess.amICaughtSpy ? (
            <div>
              <div className="mb-5 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3.5 py-1 text-xs font-bold text-rose-300">
                  <Flame className="h-3.5 w-3.5" />
                  ВАС ВЫЧИСЛИЛИ НА ГОЛОСОВАНИИ!
                </span>
                <h2 className="font-display mt-2 text-2xl text-white sm:text-3xl">
                  ПОСЛЕДНИЙ ШАНС — УГАДАЙТЕ СЛОВО!
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Если вы назовёте правильное слово категории «{categoryLabel}», победа
                  и +4 очка достанутся вам!
                </p>
              </div>

              {/* Search & Quick Subfilters for Caught Spy */}
              <div className="mb-4 space-y-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-violet-300/75" />
                  <input
                    type="text"
                    value={guessSearch}
                    onChange={(e) => setGuessSearch(e.target.value)}
                    placeholder="Быстрый поиск на русском или английском (Пудж, BKB, Blink...)"
                    className="w-full rounded-2xl border border-violet-400/30 bg-[#090613]/90 py-2.5 pr-9 pl-10 text-xs text-white placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none sm:text-sm"
                  />
                  {guessSearch && (
                    <button
                      type="button"
                      onClick={() => setGuessSearch('')}
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {subfilters.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {subfilters.map((sf) => (
                        <button
                          key={sf.id}
                          type="button"
                          onClick={() => setGuessSubfilter(sf.id)}
                          className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                            guessSubfilter === sf.id
                              ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                              : 'border-violet-500/20 bg-[#090613]/75 text-slate-300 hover:border-violet-400/45'
                          }`}
                        >
                          {sf.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">
                      Найдено: {filteredGuessWords.length} из{' '}
                      {(spyGuess.categoryWords || []).length}
                    </span>
                  </div>
                )}
              </div>

              <div className="max-h-[390px] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {filteredGuessWords.map((w) => {
                    const selected = selectedGuessWordId === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedGuessWordId(w.id)}
                        className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${
                          selected
                            ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                            : 'border-violet-500/20 bg-[#090613]/85 hover:border-violet-400/45'
                        }`}
                      >
                        {w.image && (
                          <img
                            src={w.image}
                            alt=""
                            loading="lazy"
                            className="h-9 w-12 shrink-0 rounded-lg border border-white/10 bg-[#070510] object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-white sm:text-sm">
                            {w.name}
                          </div>
                          {w.hint && (
                            <div className="mt-0.5 truncate text-[11px] text-slate-400">
                              {w.hint}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center gap-3">
                {selectedGuessWordObj && (
                  <div className="inline-flex items-center gap-2.5 rounded-2xl border border-emerald-400/40 bg-emerald-950/45 px-4 py-2 text-xs text-emerald-200 sm:text-sm">
                    {selectedGuessWordObj.image && (
                      <img
                        src={selectedGuessWordObj.image}
                        alt=""
                        className="h-7 w-9 rounded object-cover"
                      />
                    )}
                    <span>
                      Выбрано: <strong>{selectedGuessWordObj.name}</strong>
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  disabled={!selectedGuessWordId || isBusy}
                  onClick={() => onSubmitSpyGuess(selectedGuessWordId)}
                  className="w-full max-w-md rounded-2xl bg-gradient-to-r from-rose-600 via-fuchsia-600 to-emerald-600 py-4 text-sm font-bold text-white shadow-xl transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Подтвердить догадку и раскрыть карты!
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15">
                <HelpCircle className="h-8 w-8 text-amber-300" />
              </div>
              <h2 className="font-display text-2xl text-white sm:text-3xl">
                ШПИОН {spyGuess.caughtSpyNickname?.toUpperCase()} ПОЙМАН!
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-300">
                Отряд вычислил шпиона! Но не спешите праздновать — прямо сейчас{' '}
                <strong className="text-amber-300">
                  {spyGuess.caughtSpyNickname}
                </strong>{' '}
                пытается угадать загаданное слово из списка категории.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* PHASES 1 & 2: DISCUSSION AND VOTING                                   */}
      {/* ===================================================================== */}
      {(status === 'discussion' || status === 'voting') && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left Main Column */}
          <div className="space-y-5 lg:col-span-7">
            {/* Personal Secret Role Card */}
            {myRole && (
              <section
                className={`relative overflow-hidden rounded-3xl border p-5 shadow-xl backdrop-blur-xl ${
                  myRole.isSpy
                    ? 'border-rose-500/40 bg-[#140a1d]/90'
                    : 'border-emerald-400/35 bg-[#0c141d]/90'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className={`h-4 w-4 ${
                        myRole.isSpy ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Ваша секретная роль
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onReopenSmokeModal}
                      className="rounded-xl border border-violet-400/30 bg-violet-950/40 px-2.5 py-1 text-xs font-medium text-violet-200 transition hover:border-emerald-400/40"
                    >
                      Анимация дыма
                    </button>

                    <button
                      type="button"
                      onClick={() => setHideRoleCard((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-[#090613]/80 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-violet-950/60"
                    >
                      {hideRoleCard ? (
                        <>
                          <Eye className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Показать роль</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5 text-violet-300" />
                          <span>Скрыть в дыму</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {hideRoleCard ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-violet-500/30 bg-[#090613]/75 py-8 text-center">
                    <span className="text-sm font-semibold text-violet-200">
                      Карточка скрыта под Смоками от чужих глаз
                    </span>
                    <span className="mt-1 text-xs text-slate-400">
                      Нажмите «Показать роль», когда будете готовы посмотреть
                    </span>
                  </div>
                ) : myRole.isSpy ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/45 via-[#13091e] to-violet-950/45 p-5 text-center sm:flex-row sm:text-left">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-rose-400/45 bg-rose-500/20 shadow-[0_0_25px_rgba(244,63,94,0.3)]">
                      <ShieldAlert className="h-8 w-8 text-rose-300" />
                    </div>
                    <div>
                      <div className="font-display text-2xl text-rose-300 sm:text-3xl">
                        ТЫ ШПИОН
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                        Притворяйтесь, что знаете слово! Используйте список слов
                        категории ниже и нажимайте на слова, чтобы вычёркивать
                        неподходящие варианты.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <WordArtwork word={myRole.word} className="h-36 w-full" />
                    </div>
                    <div className="sm:col-span-7">
                      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                        Загаданное слово отряда
                      </div>
                      <div className="font-display mt-1 text-2xl text-white">
                        {myRole.word?.name}
                      </div>
                      {myRole.word?.hint && (
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
                          {myRole.word.hint}
                        </p>
                      )}
                      {myRole.firstSpeakerNickname && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-950/40 px-2.5 py-1 text-xs text-violet-200">
                          <span>Первый вопрос задаёт:</span>
                          <strong className="text-emerald-300">
                            {myRole.firstSpeakerNickname}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* =============================================================== */}
            {/* ENDLESS TURN-BASED ROUNDS ARENA (Круг #1 -> #2 -> #3 ... ∞)     */}
            {/* =============================================================== */}
            {status === 'discussion' && discussion && (
              <section className="rounded-3xl border border-violet-400/35 bg-gradient-to-br from-[#120b24]/95 via-[#0e0c1f]/95 to-[#091519]/95 p-5 shadow-2xl backdrop-blur-xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/45 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold text-emerald-300">
                        <Repeat className="h-3.5 w-3.5" />
                        КРУГ #{discussion.cycle}
                      </span>
                      <span className="text-xs font-semibold text-violet-200">
                        Бесконечные раунды до голосования
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Игроки по очереди дают намёк/ассоциацию или задают вопрос. После последнего игрока сразу начинается следующий круг!
                    </p>
                  </div>

                  {isHost && !discussion.isMyTurn && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={onSkipTurn}
                      title="Пропустить ход текущего игрока, если он отошёл"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      <span>Пропустить AFK</span>
                    </button>
                  )}
                </div>

                {/* Turn Order Chain for Current Circle */}
                {discussion.turnOrder && discussion.turnOrder.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {discussion.turnOrder.map((tp, idx) => {
                      const isCurrent = tp.id === discussion.currentTurnPlayerId;
                      const alreadyWentInThisCircle = idx < (discussion.turnIndex || 0);
                      const isMeTurnCard = tp.id === myPlayerId;

                      return (
                        <React.Fragment key={tp.id}>
                          <div
                            className={`flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs transition ${
                              isCurrent
                                ? 'border-emerald-400 bg-emerald-500/20 font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.28)]'
                                : alreadyWentInThisCircle
                                  ? 'border-violet-500/20 bg-[#090613]/65 text-slate-400'
                                  : 'border-violet-500/25 bg-[#090613]/90 text-slate-200'
                            }`}
                          >
                            <span className="font-mono-code text-[10px] text-slate-400">
                              {idx + 1}.
                            </span>
                            <RuneAvatar
                              avatarId={tp.avatarId}
                              size="sm"
                              isOnline={tp.isOnline}
                            />
                            <span className="max-w-[110px] truncate">
                              {tp.nickname}
                              {isMeTurnCard ? ' (Вы)' : ''}
                            </span>
                            {isCurrent ? (
                              <span className="rounded-md bg-emerald-400 px-1.5 py-0.5 text-[10px] font-extrabold text-[#06130f]">
                                ХОДИТ
                              </span>
                            ) : alreadyWentInThisCircle ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : null}
                          </div>
                          {idx < discussion.turnOrder.length - 1 && (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-violet-400/50" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {/* Active Turn Action Box */}
                {discussion.isMyTurn ? (
                  <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/25 p-4 shadow-[0_0_30px_rgba(16,185,129,0.16)]">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-display text-sm text-emerald-300 sm:text-base">
                        ВАШ ХОД В КРУГЕ #{discussion.cycle}!
                      </span>
                      <span className="text-[11px] text-emerald-200/80">
                        Не называйте само слово напрямую
                      </span>
                    </div>

                    <form onSubmit={handleTurnSubmit} className="space-y-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          maxLength={180}
                          value={turnInput}
                          onChange={(e) => setTurnInput(e.target.value)}
                          placeholder="Напишите ассоциацию, намёк или вопрос отряду..."
                          className="min-w-0 flex-1 rounded-xl border border-emerald-400/35 bg-[#080612] px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none sm:text-sm"
                        />
                        <button
                          type="submit"
                          disabled={!turnInput.trim() || isBusy}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-extrabold text-[#04120e] shadow-lg transition hover:from-emerald-400 hover:to-teal-400 disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
                        >
                          <Send className="h-4 w-4" />
                          <span>Отправить ход</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] text-slate-400">
                          Играете в голосе / Discord? Скажите вслух и передайте очередь:
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={handleVoiceTurnPass}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-600/20 px-3 py-1.5 text-xs font-bold text-violet-100 transition hover:bg-violet-600/35 disabled:opacity-50"
                        >
                          <Mic className="h-3.5 w-3.5 text-emerald-300" />
                          <span>Сказал вслух — передать ход →</span>
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/25 bg-[#090613]/85 px-4 py-3">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                      <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400" />
                      <span className="text-slate-300">
                        Сейчас ходит игрок{' '}
                        <strong className="text-emerald-300">
                          {discussion.currentTurnNickname || 'отряда'}
                        </strong>{' '}
                        (Круг #{discussion.cycle})
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Готовьте свою ассоциацию или следите за подозрительными ответами!
                    </span>
                  </div>
                )}

                {/* History of Clues Across Endless Circles */}
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      История раундов ({(discussion.turnLog || []).length} ходов)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Все круги сохраняются до голосования
                    </span>
                  </div>

                  <div className="max-h-52 space-y-2 overflow-y-auto rounded-2xl border border-violet-500/15 bg-[#070510]/85 p-3">
                    {(!discussion.turnLog || discussion.turnLog.length === 0) ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        Круг #1 открыт — ждём первый ход от{' '}
                        <strong className="text-violet-200">
                          {discussion.currentTurnNickname}
                        </strong>
                        !
                      </div>
                    ) : (
                      discussion.turnLog.map((entry) => (
                        <div
                          key={entry.id || entry.turnNumber}
                          className="flex items-start justify-between gap-2.5 rounded-xl border border-violet-500/15 bg-[#0d091b]/90 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-200">
                                Круг #{entry.cycle}
                              </span>
                              <span className="font-bold text-emerald-300">
                                {entry.nickname}:
                              </span>
                              <span
                                className={
                                  entry.mode === 'text'
                                    ? 'font-medium text-white'
                                    : 'italic text-slate-400'
                                }
                              >
                                {entry.text}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={turnLogEndRef} />
                  </div>
                </div>

                {/* Ready-to-Vote Bar right inside the Rounds Arena */}
                <div className="mt-4 flex flex-col gap-2.5 border-t border-violet-500/20 pt-4 sm:flex-row">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onStartVotingEarly(false)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 px-4 text-xs font-bold transition sm:text-sm ${
                      iVotedEarly
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                        : 'border-violet-400/40 bg-violet-600/20 text-violet-100 hover:bg-violet-600/35'
                    }`}
                  >
                    <Vote className="h-4 w-4" />
                    <span>
                      {iVotedEarly
                        ? `Вы за голосование (${earlyVoteIds.length}/${majorityNeeded})`
                        : `Перейти к голосованию (${earlyVoteIds.length}/${majorityNeeded})`}
                    </span>
                  </button>

                  {isHost && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onStartVotingEarly(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 via-fuchsia-600 to-emerald-600 py-3 px-4 text-xs font-bold text-white shadow-lg transition hover:opacity-95 sm:text-sm"
                    >
                      <Flame className="h-4 w-4" />
                      <span>Голосовать сейчас (Хост)</span>
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* VOTING SECTION (When status === 'voting') */}
            {status === 'voting' && (
              <section className="rounded-3xl border border-emerald-400/40 bg-[#0e1022]/92 p-5 shadow-2xl backdrop-blur-xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Vote className="h-5 w-5 text-emerald-400" />
                    <h2 className="font-display text-lg text-white">
                      ГОЛОСУЙТЕ ПРОТИВ ШПИОНА
                    </h2>
                  </div>
                  <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200">
                    Проголосовало: {(voting?.votedPlayerIds || []).length} /{' '}
                    {onlinePlayers.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {room.players.map((p) => {
                    const isSelf = p.id === myPlayerId;
                    const isMyTarget = voting?.myVoteTargetId === p.id;
                    const hasVoted = (voting?.votedPlayerIds || []).includes(p.id);

                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isSelf || isBusy}
                        onClick={() => onCastVote(p.id)}
                        className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition ${
                          isMyTarget
                            ? 'border-rose-400 bg-rose-500/20 shadow-[0_0_24px_rgba(244,63,94,0.28)]'
                            : isSelf
                              ? 'cursor-not-allowed border-violet-500/15 bg-[#090613]/50 opacity-60'
                              : 'border-violet-500/20 bg-[#090613]/85 hover:border-emerald-400/45'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <RuneAvatar
                            avatarId={p.avatarId}
                            size="sm"
                            isOnline={p.isOnline}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-white">
                              {p.nickname} {isSelf && '(Вы)'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {hasVoted ? 'Уже проголосовал' : 'Думает...'}
                            </div>
                          </div>
                        </div>

                        {isMyTarget ? (
                          <span className="shrink-0 rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-bold text-white">
                            Ваш голос
                          </span>
                        ) : hasVoted ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Category Words Interactive Grid */}
            {myRole?.categoryWords && (
              <section className="rounded-3xl border border-violet-500/20 bg-[#0f0a1c]/88 p-5 shadow-xl backdrop-blur-xl">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm text-white sm:text-base">
                      ВСЕ СЛОВА КАТЕГОРИИ «{categoryLabel.toUpperCase()}»
                    </h3>
                    <p className="text-xs text-slate-400">
                      Нажмите на карточку, чтобы вычеркнуть неподходящее (видно только вам)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {crossedCount > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setHideCrossed((v) => !v)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                            hideCrossed
                              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                              : 'border-violet-400/25 bg-[#090613]/80 text-slate-300 hover:border-violet-400/50'
                          }`}
                        >
                          {hideCrossed ? 'Показать все' : `Скрыть (${crossedCount})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCrossedWordIds({})}
                          className="rounded-lg border border-rose-500/25 bg-rose-950/30 px-2 py-1 text-xs text-rose-200 transition hover:bg-rose-900/45"
                        >
                          Сброс
                        </button>
                      </>
                    )}
                    <span className="rounded-lg border border-violet-400/25 bg-violet-950/40 px-2.5 py-1 text-xs font-semibold text-violet-200">
                      {filteredDiscussionWords.length} / {myRole.categoryWords.length}
                    </span>
                  </div>
                </div>

                {/* Search & Subfilter Bar */}
                <div className="mb-3 space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-violet-300/70" />
                    <input
                      type="text"
                      value={wordSearch}
                      onChange={(e) => setWordSearch(e.target.value)}
                      placeholder="Поиск героя, предмета или подсказки (Пудж, BKB, Сила...)"
                      className="w-full rounded-xl border border-violet-500/25 bg-[#090613] py-2 pr-8 pl-9 text-xs text-white placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none sm:text-sm"
                    />
                    {wordSearch && (
                      <button
                        type="button"
                        onClick={() => setWordSearch('')}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {subfilters.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {subfilters.map((sf) => (
                        <button
                          key={sf.id}
                          type="button"
                          onClick={() => setWordSubfilter(sf.id)}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition sm:text-xs ${
                            wordSubfilter === sf.id
                              ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                              : 'border-violet-500/20 bg-[#090613]/75 text-slate-300 hover:border-violet-400/45'
                          }`}
                        >
                          {sf.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="max-h-[410px] overflow-y-auto pr-1">
                  {filteredDiscussionWords.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-violet-500/25 bg-[#090613]/60 py-8 text-center text-xs text-slate-400">
                      Ничего не найдено по текущему фильтру
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {filteredDiscussionWords.map((w) => {
                        const crossed = Boolean(crossedWordIds[w.id]);
                        const isSecretMatch = !myRole.isSpy && myRole.word?.id === w.id;

                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => toggleCrossWord(w.id)}
                            className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                              crossed
                                ? 'border-slate-800 bg-[#080610]/50 text-slate-500 line-through opacity-50'
                                : isSecretMatch
                                  ? 'border-emerald-400/55 bg-emerald-950/40 font-bold text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.18)]'
                                  : 'border-violet-500/20 bg-[#090613]/85 font-medium text-slate-200 hover:border-violet-400/45'
                            }`}
                          >
                            {w.image && (
                              <img
                                src={w.image}
                                alt=""
                                loading="lazy"
                                className="h-7 w-10 shrink-0 rounded-md border border-white/10 bg-[#070510] object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate">{w.name}</div>
                              {w.hint && (
                                <div className="truncate text-[10px] font-normal text-slate-400">
                                  {w.hint}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Early Voting Controls during Discussion */}
                {status === 'discussion' && (
                  <div className="mt-5 flex flex-col gap-2.5 border-t border-violet-500/15 pt-4 sm:flex-row">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onStartVotingEarly(false)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 px-4 text-xs font-bold transition sm:text-sm ${
                        iVotedEarly
                          ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                          : 'border-violet-400/35 bg-violet-600/20 text-violet-100 hover:bg-violet-600/35'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                      <span>
                        Голосовать досрочно ({earlyVoteIds.length}/{majorityNeeded})
                      </span>
                    </button>

                    {isHost && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onStartVotingEarly(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 px-4 text-xs font-bold text-white shadow-lg transition hover:from-emerald-500 hover:to-teal-500 sm:text-sm"
                      >
                        <Vote className="h-4 w-4" />
                        <span>Начать голосование (Хост)</span>
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Right Sidebar: Players & Chat */}
          <div className="space-y-5 lg:col-span-5">
            {/* Players & Scores */}
            <section className="rounded-3xl border border-violet-500/20 bg-[#0f0a1c]/88 p-5 shadow-xl backdrop-blur-xl">
              <h3 className="font-display mb-3 text-sm text-white">
                ИГРОКИ В МАТЧЕ ({room.players.length})
              </h3>
              <div className="space-y-2">
                {room.players.map((p) => {
                  const isMe = p.id === myPlayerId;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-violet-500/15 bg-[#090613]/80 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="relative">
                          <RuneAvatar
                            avatarId={p.avatarId}
                            size="sm"
                            isOnline={p.isOnline}
                          />
                          <span
                            className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-[#090613] ${
                              p.isOnline ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-white sm:text-sm">
                              {p.nickname}
                            </span>
                            {p.isHost && (
                              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.score} очк.
                          </div>
                        </div>
                      </div>

                      {isHost && !isMe && p.isOnline && (
                        <button
                          type="button"
                          onClick={() => onTransferHost(p.id)}
                          title={`Передать права хоста игроку ${p.nickname}`}
                          className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-1.5 text-amber-300 transition hover:bg-amber-500/25"
                        >
                          <Crown className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* In-game Chat & Log */}
            <section className="rounded-3xl border border-violet-500/20 bg-[#0f0a1c]/88 p-5 shadow-xl backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-violet-400" />
                <h3 className="font-display text-sm text-slate-200">
                  ЧАТ ОБСУЖДЕНИЯ
                </h3>
              </div>

              <div className="mb-3 max-h-52 space-y-1.5 overflow-y-auto rounded-2xl border border-violet-500/15 bg-[#080510]/85 p-3 text-xs">
                {(room.events || []).map((ev) => (
                  <div key={ev.id} className="leading-relaxed">
                    {ev.type === 'chat' ? (
                      <div>
                        <span className="font-bold text-emerald-300">
                          {ev.author}:{' '}
                        </span>
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
                  placeholder="Задать вопрос в чат..."
                  className="min-w-0 flex-1 rounded-xl border border-violet-500/25 bg-[#090613] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none sm:text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
