import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  isSupabaseConfigured,
  fetchPlatformStats,
  gameApi,
  subscribeToRoomChannel,
} from './lib/supabase.js';
import {
  getSavedProfile,
  getTabSession,
  getLastBrowserSession,
  saveActiveSession,
  clearActiveSession,
} from './lib/session.js';
import { SmokeBackground, RoleSmokeRevealModal } from './components/SmokeBackground.jsx';
import { HeaderBar } from './components/HeaderBar.jsx';
import { ToastStack } from './components/ToastStack.jsx';
import { HomeView } from './components/HomeView.jsx';
import { LobbyView } from './components/LobbyView.jsx';
import { GameView } from './components/GameView.jsx';

function getInitialRoomCodeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
    }
  } catch {
    // ignore
  }
  return '';
}

function getSeenRoundKey(roomCode) {
  return `spy_dota2_seen_round_${roomCode}`;
}

export default function App() {
  const savedProfile = getSavedProfile();

  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [discussion, setDiscussion] = useState(null);
  const [voting, setVoting] = useState(null);
  const [spyGuess, setSpyGuess] = useState(null);
  const [results, setResults] = useState(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  const [smokeModalOpen, setSmokeModalOpen] = useState(false);

  const [urlJoinCode, setUrlJoinCode] = useState(getInitialRoomCodeFromUrl);
  const [multiTabRoomHint, setMultiTabRoomHint] = useState(null);
  const [reconnectCandidate, setReconnectCandidate] = useState(null);

  const [platformStats, setPlatformStats] = useState(null);
  const [toasts, setToasts] = useState([]);

  const meRef = useRef(null);
  meRef.current = me;

  const channelHandleRef = useRef(null);
  const lastSignalVersionRef = useRef(0);
  const refreshInFlightRef = useRef(false);

  const pushToast = useCallback(({ type = 'info', message }) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4300);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const syncUrlWithRoom = useCallback((code) => {
    try {
      const url = new URL(window.location.href);
      if (code) {
        url.searchParams.set('room', code);
      } else {
        url.searchParams.delete('room');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }, []);

  const applyServerState = useCallback(
    (payload) => {
      if (!payload?.ok || !payload.room || !payload.me) return false;

      if (payload.serverNow) {
        const serverMs = new Date(payload.serverNow).getTime();
        if (!Number.isNaN(serverMs)) {
          setClockOffsetMs(serverMs - Date.now());
        }
      }

      setRoom(payload.room);
      setMe(payload.me);
      setMyRole(payload.myRole || null);
      setDiscussion(payload.discussion || null);
      setVoting(payload.voting || null);
      setSpyGuess(payload.spyGuess || null);
      setResults(payload.results || null);

      saveActiveSession(payload.me);
      syncUrlWithRoom(payload.room.code);

      // Trigger Smoke of Deceit role reveal modal automatically once per new round!
      if (
        payload.room.status === 'discussion' &&
        payload.myRole?.roundNumber
      ) {
        const seenKey = getSeenRoundKey(payload.room.code);
        const alreadySeenRound = Number(sessionStorage.getItem(seenKey) || 0);
        if (alreadySeenRound < payload.myRole.roundNumber) {
          sessionStorage.setItem(seenKey, String(payload.myRole.roundNumber));
          setSmokeModalOpen(true);
        }
      } else if (payload.room.status === 'lobby' || payload.room.status === 'results') {
        setSmokeModalOpen(false);
      }

      return true;
    },
    [syncUrlWithRoom]
  );

  const refreshRoomState = useCallback(async () => {
    const activeMe = meRef.current;
    if (!activeMe?.roomCode || !activeMe?.sessionToken) return;
    if (refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    const res = await gameApi.getRoomState({
      roomCode: activeMe.roomCode,
      sessionToken: activeMe.sessionToken,
    });
    refreshInFlightRef.current = false;

    if (res.ok) {
      applyServerState(res);
    } else if (
      res.error &&
      (res.error.includes('Сессия игрока не найдена') ||
        res.error.includes('Комната не найдена'))
    ) {
      clearActiveSession(activeMe.roomCode);
      setRoom(null);
      setMe(null);
      setMyRole(null);
      syncUrlWithRoom(null);
      pushToast({
        type: 'info',
        message: 'Комната закрыта или вы были исключены из лобби',
      });
    }
  }, [applyServerState, pushToast, syncUrlWithRoom]);

  // Initial load: platform stats + automatic session recovery
  useEffect(() => {
    let mounted = true;

    fetchPlatformStats().then((stats) => {
      if (mounted && stats) setPlatformStats(stats);
    });

    const restore = async () => {
      // 1. Same-tab session (survives F5 page reload!)
      const tabSession = getTabSession();
      if (tabSession?.roomCode && tabSession?.sessionToken) {
        const res = await gameApi.joinRoom({
          roomCode: tabSession.roomCode,
          sessionToken: tabSession.sessionToken,
        });
        if (!mounted) return;
        if (res.ok && applyServerState(res)) {
          setIsBootstrapping(false);
          return;
        }
        clearActiveSession(tabSession.roomCode);
      }

      // 2. Last browser session from localStorage (closed tab or second tab check)
      const lastSession = getLastBrowserSession();
      if (lastSession?.roomCode && lastSession?.sessionToken) {
        const check = await gameApi.checkSession({
          roomCode: lastSession.roomCode,
          sessionToken: lastSession.sessionToken,
        });
        if (!mounted) return;

        if (check.ok && check.valid) {
          if (!check.isOnline) {
            const urlCode = getInitialRoomCodeFromUrl();
            if (!urlCode || urlCode === check.roomCode) {
              const rec = await gameApi.joinRoom({
                roomCode: lastSession.roomCode,
                sessionToken: lastSession.sessionToken,
              });
              if (mounted && rec.ok && applyServerState(rec)) {
                pushToast({
                  type: 'emerald',
                  message: `Вы автоматически вернулись в комнату ${rec.room.code}`,
                });
                setIsBootstrapping(false);
                return;
              }
            } else {
              setReconnectCandidate(check);
            }
          } else {
            // Active in neighbor tab -> show quick 2nd-player join helper!
            setMultiTabRoomHint({
              roomCode: check.roomCode,
              nickname: check.nickname,
            });
          }
        } else {
          clearActiveSession(lastSession.roomCode);
        }
      }

      if (mounted) {
        setIsBootstrapping(false);
      }
    };

    restore();
    return () => {
      mounted = false;
    };
  }, [applyServerState, pushToast]);

  // Subscribe to Supabase Realtime channel + 5s heartbeat while inside a room
  useEffect(() => {
    if (!me?.roomCode || !me?.sessionToken) {
      setIsRealtimeConnected(true);
      return;
    }

    lastSignalVersionRef.current = 0;

    const handle = subscribeToRoomChannel(me.roomCode, {
      onSignal: (signalRow) => {
        if (signalRow?.version && signalRow.version > lastSignalVersionRef.current) {
          lastSignalVersionRef.current = signalRow.version;
          if (signalRow.toast_message) {
            pushToast({
              type: signalRow.toast_type || 'info',
              message: signalRow.toast_message,
            });
          }
        }
        refreshRoomState();
      },
      onStatusChange: (status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsRealtimeConnected(false);
        }
      },
    });

    channelHandleRef.current = handle;

    const heartbeat = setInterval(() => {
      refreshRoomState();
    }, 5000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshRoomState();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibility);
      handle.unsubscribe();
      channelHandleRef.current = null;
    };
  }, [me?.roomCode, me?.sessionToken, pushToast, refreshRoomState]);

  const notifyRoomPeers = () => {
    channelHandleRef.current?.notifyPeers();
  };

  // Actions
  const handleCreateRoom = async ({ nickname, avatarId }) => {
    setIsBusy(true);
    const res = await gameApi.createRoom({ nickname, avatarId });
    setIsBusy(false);

    if (!res.ok) {
      return res.error || 'Не удалось создать комнату';
    }

    applyServerState(res);
    pushToast({
      type: 'emerald',
      message: `Комната ${res.room.code} создана! Скопируйте код для друзей.`,
    });
    fetchPlatformStats().then((s) => s && setPlatformStats(s));
    return null;
  };

  const handleJoinRoom = async ({ roomCode, nickname, avatarId }) => {
    setIsBusy(true);
    const res = await gameApi.joinRoom({ roomCode, nickname, avatarId });
    setIsBusy(false);

    if (!res.ok) {
      return res.error || 'Не удалось войти в комнату';
    }

    applyServerState(res);
    setTimeout(() => notifyRoomPeers(), 120);
    pushToast({
      type: 'smoke',
      message: res.reconnected
        ? `С возвращением в комнату ${res.room.code}!`
        : `Вы подключились к комнате ${res.room.code}`,
    });
    return null;
  };

  const handleManualReconnect = async () => {
    const last = getLastBrowserSession();
    if (!last) return;
    setIsBusy(true);
    const res = await gameApi.joinRoom({
      roomCode: last.roomCode,
      sessionToken: last.sessionToken,
    });
    setIsBusy(false);

    if (res.ok && applyServerState(res)) {
      setReconnectCandidate(null);
      notifyRoomPeers();
      pushToast({
        type: 'emerald',
        message: `Вы вернулись в комнату ${res.room.code}!`,
      });
    } else {
      clearActiveSession(last.roomCode);
      setReconnectCandidate(null);
      pushToast({
        type: 'error',
        message: res.error || 'Сессия истекла',
      });
    }
  };

  const handleLeaveRoom = async () => {
    if (!me) return;
    const code = me.roomCode;
    await gameApi.leaveRoom({
      roomCode: me.roomCode,
      sessionToken: me.sessionToken,
    });
    notifyRoomPeers();
    clearActiveSession(code);
    setRoom(null);
    setMe(null);
    setMyRole(null);
    setVoting(null);
    setSpyGuess(null);
    setResults(null);
    setUrlJoinCode('');
    syncUrlWithRoom(null);
    pushToast({ type: 'info', message: 'Вы покинули комнату' });
  };

  const runRoomAction = async (rpcPromise) => {
    const res = await rpcPromise;
    if (!res.ok) {
      if (res.error) pushToast({ type: 'error', message: res.error });
      return false;
    }
    applyServerState(res);
    notifyRoomPeers();
    return true;
  };

  const handleToggleReady = () => {
    if (!me) return;
    runRoomAction(
      gameApi.toggleReady({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
      })
    );
  };

  const handleUpdateSettings = (patch) => {
    if (!me) return;
    runRoomAction(
      gameApi.updateSettings({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
        category: patch.category ?? null,
        roundTimeSeconds: patch.roundTimeSeconds ?? null,
        spyCount: patch.spyCount ?? null,
      })
    );
  };

  const handleTransferHost = (targetPlayerId) => {
    if (!me) return;
    runRoomAction(
      gameApi.transferHost({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
        targetPlayerId,
      })
    );
  };

  const handleKickPlayer = (targetPlayerId) => {
    if (!me) return;
    runRoomAction(
      gameApi.kickPlayer({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
        targetPlayerId,
      })
    );
  };

  const handleSendChat = (text) => {
    if (!me) return;
    runRoomAction(
      gameApi.sendChat({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
        text,
      })
    );
  };

  const handleStartGame = async () => {
    if (!me) return;
    setIsBusy(true);
    await runRoomAction(
      gameApi.startGame({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
      })
    );
    setIsBusy(false);
  };

  const handleSubmitTurn = async (text = '') => {
    if (!me) return;
    setIsBusy(true);
    await runRoomAction(
      gameApi.submitTurn({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
        text,
      })
    );
    setIsBusy(false);
  };

  const handleSkipTurn = async () => {
    if (!me) return;
    setIsBusy(true);
    await runRoomAction(
      gameApi.skipTurn({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
      })
    );
    setIsBusy(false);
  };

  const handleStartVotingEarly = async (forceByHost = false) => {
    if (!me) return;
    setIsBusy(true);
    await runRoomAction(
      gameApi.startVotingEarly({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
        forceByHost,
      })
    );
    setIsBusy(false);
  };

  const handleCastVote = async (targetPlayerId) => {
    if (!me) return;
    setIsBusy(true);
    await runRoomAction(
      gameApi.castVote({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
        targetPlayerId,
      })
    );
    setIsBusy(false);
  };

  const handleSubmitSpyGuess = async (wordId) => {
    if (!me) return;
    setIsBusy(true);
    await runRoomAction(
      gameApi.submitSpyGuess({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
        wordId,
      })
    );
    setIsBusy(false);
  };

  const handleReturnToLobby = async () => {
    if (!me) return;
    setIsBusy(true);
    await runRoomAction(
      gameApi.returnToLobby({
        roomCode: me.roomCode,
        sessionToken: me.sessionToken,
      })
    );
    setIsBusy(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col text-slate-100">
      <SmokeBackground />

      <HeaderBar
        isSocketConnected={isRealtimeConnected}
        supabaseStatus={isSupabaseConfigured ? 'synced' : 'offline'}
        roomCode={room?.code || null}
        onLogoClick={() => {
          if (!room) {
            setUrlJoinCode('');
            syncUrlWithRoom(null);
          }
        }}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <RoleSmokeRevealModal
        open={smokeModalOpen}
        myRole={myRole}
        onClose={() => setSmokeModalOpen(false)}
      />

      {isBootstrapping ? (
        <div className="relative z-10 flex flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-violet-500/25 bg-[#100b1e]/85 px-8 py-7 text-center backdrop-blur-xl">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-400 border-t-emerald-400" />
            <p className="text-sm font-medium text-slate-300">
              Подключение к базе данных Supabase...
            </p>
          </div>
        </div>
      ) : room && me ? (
        room.status === 'lobby' ? (
          <LobbyView
            room={room}
            myPlayerId={me.playerId}
            isBusy={isBusy}
            onLeaveRoom={handleLeaveRoom}
            onToggleReady={handleToggleReady}
            onUpdateSettings={handleUpdateSettings}
            onTransferHost={handleTransferHost}
            onKickPlayer={handleKickPlayer}
            onSendChat={handleSendChat}
            onStartGame={handleStartGame}
            onNotify={pushToast}
          />
        ) : (
          <GameView
            room={room}
            myPlayerId={me.playerId}
            myRole={myRole}
            discussion={discussion}
            voting={voting}
            spyGuess={spyGuess}
            results={results}
            clockOffsetMs={clockOffsetMs}
            isBusy={isBusy}
            onReopenSmokeModal={() => setSmokeModalOpen(true)}
            onSubmitTurn={handleSubmitTurn}
            onSkipTurn={handleSkipTurn}
            onStartVotingEarly={handleStartVotingEarly}
            onCastVote={handleCastVote}
            onSubmitSpyGuess={handleSubmitSpyGuess}
            onRematch={handleStartGame}
            onReturnToLobby={handleReturnToLobby}
            onTransferHost={handleTransferHost}
            onSendChat={handleSendChat}
            onLeaveRoom={handleLeaveRoom}
            onTimerExpired={refreshRoomState}
          />
        )
      ) : (
        <HomeView
          initialNickname={savedProfile.nickname}
          initialAvatarId={savedProfile.avatarId}
          initialJoinCode={urlJoinCode}
          multiTabRoomHint={multiTabRoomHint}
          reconnectCandidate={reconnectCandidate}
          platformStats={platformStats}
          isBusy={isBusy}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onManualReconnect={handleManualReconnect}
        />
      )}
    </div>
  );
}
