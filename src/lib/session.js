const PROFILE_KEY = 'spy_dota2_profile_v1';
const TAB_SESSION_KEY = 'spy_dota2_tab_session_v1';
const LAST_SESSION_KEY = 'spy_dota2_last_session_v1';

export function getSavedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { nickname: '', avatarId: 'smoke' };
    const parsed = JSON.parse(raw);
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      avatarId: typeof parsed.avatarId === 'string' ? parsed.avatarId : 'smoke',
    };
  } catch {
    return { nickname: '', avatarId: 'smoke' };
  }
}

export function saveProfile({ nickname, avatarId }) {
  try {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        nickname: nickname || '',
        avatarId: avatarId || 'smoke',
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function getTabSession() {
  try {
    const raw = sessionStorage.getItem(TAB_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.roomCode && parsed?.sessionToken) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function getLastBrowserSession() {
  try {
    const raw = localStorage.getItem(LAST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.roomCode && parsed?.sessionToken) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveActiveSession(me) {
  if (!me?.roomCode || !me?.sessionToken) return;
  const record = {
    roomCode: me.roomCode,
    sessionToken: me.sessionToken,
    playerId: me.playerId,
    nickname: me.nickname,
    avatarId: me.avatarId || 'smoke',
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }

  saveProfile({ nickname: me.nickname, avatarId: me.avatarId });
}

export function clearActiveSession(roomCodeToClear = null) {
  try {
    sessionStorage.removeItem(TAB_SESSION_KEY);
  } catch {
    // ignore
  }

  try {
    if (!roomCodeToClear) {
      localStorage.removeItem(LAST_SESSION_KEY);
    } else {
      const last = getLastBrowserSession();
      if (last && last.roomCode === roomCodeToClear) {
        localStorage.removeItem(LAST_SESSION_KEY);
      }
    }
  } catch {
    // ignore
  }
}
