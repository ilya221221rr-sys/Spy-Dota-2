import { createClient } from '@supabase/supabase-js';

// Public Supabase URL & publishable anon key (all sensitive data is protected by PostgreSQL RLS & SECURITY DEFINER RPCs)
const DEFAULT_SUPABASE_URL = 'https://jmgrgxvcgykbdsfjxabh.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZ3JneHZjZ3lrYmRzZmp4YWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2OTQ1NDYsImV4cCI6MjExMTI3MDU0Nn0.vnNKUaCqeRpkDLdv-nKr5eUAwCLfngny3pQtQc3Pdq0';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
).trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

async function callRpc(fnName, params = {}) {
  try {
    const { data, error } = await supabase.rpc(fnName, params);
    if (error) {
      return { ok: false, error: error.message || 'Ошибка обращения к базе данных' };
    }
    return data || { ok: false, error: 'Пустой ответ сервера' };
  } catch (err) {
    return {
      ok: false,
      error: 'Нет связи с сервером Supabase. Проверьте интернет-соединение.',
    };
  }
}

export async function fetchPlatformStats() {
  try {
    const { data, error } = await supabase.rpc('get_platform_stats');
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export const gameApi = {
  checkSession: ({ roomCode, sessionToken }) =>
    callRpc('rpc_check_session', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
    }),

  createRoom: ({ nickname, avatarId }) =>
    callRpc('rpc_create_room', {
      p_nickname: nickname,
      p_avatar_id: avatarId,
    }),

  joinRoom: ({ roomCode, nickname, avatarId, sessionToken = null }) =>
    callRpc('rpc_join_room', {
      p_room_code: roomCode,
      p_nickname: nickname,
      p_avatar_id: avatarId,
      p_session_token: sessionToken,
    }),

  getRoomState: ({ roomCode, sessionToken }) =>
    callRpc('rpc_get_room_state', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
    }),

  leaveRoom: ({ roomCode, sessionToken }) =>
    callRpc('rpc_leave_room', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
    }),

  toggleReady: ({ roomCode, sessionToken }) =>
    callRpc('rpc_toggle_ready', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
    }),

  updateSettings: ({
    roomCode,
    sessionToken,
    category = null,
    roundTimeSeconds = null,
    spyCount = null,
  }) =>
    callRpc('rpc_update_settings', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
      p_category: category,
      p_round_time_seconds: roundTimeSeconds,
      p_spy_count: spyCount,
    }),

  transferHost: ({ roomCode, sessionToken, targetPlayerId }) =>
    callRpc('rpc_transfer_host', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
      p_target_player_id: targetPlayerId,
    }),

  kickPlayer: ({ roomCode, sessionToken, targetPlayerId }) =>
    callRpc('rpc_kick_player', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
      p_target_player_id: targetPlayerId,
    }),

  sendChat: ({ roomCode, sessionToken, text }) =>
    callRpc('rpc_send_chat', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
      p_text: text,
    }),

  startGame: ({ roomCode, sessionToken }) =>
    callRpc('rpc_start_game', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
    }),

  submitTurn: ({ roomCode, sessionToken, text = '' }) =>
    callRpc('rpc_submit_turn', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
      p_text: text,
    }),

  skipTurn: ({ roomCode, sessionToken }) =>
    callRpc('rpc_skip_turn', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
    }),

  startVotingEarly: ({ roomCode, sessionToken, forceByHost = false }) =>
    callRpc('rpc_start_voting_early', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
      p_force_by_host: forceByHost,
    }),

  castVote: ({ roomCode, sessionToken, targetPlayerId }) =>
    callRpc('rpc_cast_vote', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
      p_target_player_id: targetPlayerId,
    }),

  submitSpyGuess: ({ roomCode, sessionToken, wordId }) =>
    callRpc('rpc_submit_spy_guess', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
      p_word_id: wordId,
    }),

  returnToLobby: ({ roomCode, sessionToken }) =>
    callRpc('rpc_return_to_lobby', {
      p_room_code: roomCode,
      p_session_token: sessionToken,
    }),
};

export function subscribeToRoomChannel(roomCode, { onSignal, onStatusChange }) {
  const cleanCode = String(roomCode || '').trim().toUpperCase();
  const channel = supabase.channel(`spy-dota-room-${cleanCode}`, {
    config: {
      broadcast: { self: false },
    },
  });

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_sync_signals',
        filter: `room_code=eq.${cleanCode}`,
      },
      (payload) => {
        if (onSignal) {
          onSignal(payload.new || null);
        }
      }
    )
    .on('broadcast', { event: 'room_wake' }, () => {
      if (onSignal) {
        onSignal(null);
      }
    })
    .subscribe((status) => {
      if (onStatusChange) {
        onStatusChange(status);
      }
    });

  return {
    notifyPeers: () => {
      channel
        .send({
          type: 'broadcast',
          event: 'room_wake',
          payload: { t: Date.now() },
        })
        .catch(() => {});
    },
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
