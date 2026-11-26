-- 001_init_spy_dota2_schema.sql
-- Базовая схема БД для онлайн-игры «Spy Dota 2»

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.dota_words (
  id text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('heroes', 'items', 'locations')),
  name_ru text NOT NULL,
  name_en text NOT NULL,
  hint text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(4) NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'role_reveal', 'discussion', 'voting', 'spy_guess', 'results', 'closed')),
  category text NOT NULL DEFAULT 'heroes' CHECK (category IN ('heroes', 'items', 'locations')),
  round_time_seconds integer NOT NULL DEFAULT 240 CHECK (round_time_seconds BETWEEN 60 AND 900),
  spy_count integer NOT NULL DEFAULT 1 CHECK (spy_count BETWEEN 1 AND 3),
  current_round integer NOT NULL DEFAULT 0,
  host_player_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  avatar_id text NOT NULL DEFAULT 'smoke',
  session_token text,
  is_host boolean NOT NULL DEFAULT false,
  is_online boolean NOT NULL DEFAULT true,
  is_ready boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON public.room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_session_token ON public.room_players(session_token);

CREATE TABLE IF NOT EXISTS public.game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  category text NOT NULL CHECK (category IN ('heroes', 'items', 'locations')),
  secret_word_id text REFERENCES public.dota_words(id),
  secret_word_name text NOT NULL,
  spy_player_ids uuid[] NOT NULL DEFAULT '{}',
  phase text NOT NULL DEFAULT 'discussion',
  winner text CHECK (winner IN ('civilians', 'spies') OR winner IS NULL),
  win_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_game_rounds_room_id ON public.game_rounds(room_id);

CREATE TABLE IF NOT EXISTS public.round_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  voter_player_id uuid NOT NULL REFERENCES public.room_players(id) ON DELETE CASCADE,
  target_player_id uuid NOT NULL REFERENCES public.room_players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, voter_player_id)
);

ALTER TABLE public.dota_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of dota_words" ON public.dota_words;
CREATE POLICY "Allow public read of dota_words"
  ON public.dota_words
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.sync_room_snapshot(
  p_room_id uuid,
  p_code text,
  p_status text,
  p_category text,
  p_round_time_seconds integer,
  p_spy_count integer,
  p_current_round integer,
  p_host_player_id uuid,
  p_players jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_player jsonb;
  v_keep_ids uuid[] := '{}';
BEGIN
  IF length(trim(p_code)) <> 4 THEN
    RAISE EXCEPTION 'Invalid room code';
  END IF;

  INSERT INTO public.rooms (
    id, code, status, category, round_time_seconds, spy_count, current_round, host_player_id, updated_at
  )
  VALUES (
    p_room_id, upper(trim(p_code)), p_status, p_category, p_round_time_seconds, p_spy_count, p_current_round, p_host_player_id, now()
  )
  ON CONFLICT (code) DO UPDATE SET
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    round_time_seconds = EXCLUDED.round_time_seconds,
    spy_count = EXCLUDED.spy_count,
    current_round = EXCLUDED.current_round,
    host_player_id = EXCLUDED.host_player_id,
    updated_at = now()
  RETURNING id INTO v_room_id;

  FOR v_player IN SELECT * FROM jsonb_array_elements(COALESCE(p_players, '[]'::jsonb))
  LOOP
    v_keep_ids := array_append(v_keep_ids, (v_player->>'id')::uuid);

    INSERT INTO public.room_players (
      id, room_id, nickname, avatar_id, is_host, is_online, is_ready, score, last_seen_at
    )
    VALUES (
      (v_player->>'id')::uuid,
      v_room_id,
      left(COALESCE(v_player->>'nickname', 'Игрок'), 24),
      COALESCE(v_player->>'avatarId', 'smoke'),
      COALESCE((v_player->>'isHost')::boolean, false),
      COALESCE((v_player->>'isOnline')::boolean, true),
      COALESCE((v_player->>'isReady')::boolean, false),
      COALESCE((v_player->>'score')::integer, 0),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      room_id = v_room_id,
      nickname = EXCLUDED.nickname,
      avatar_id = EXCLUDED.avatar_id,
      is_host = EXCLUDED.is_host,
      is_online = EXCLUDED.is_online,
      is_ready = EXCLUDED.is_ready,
      score = EXCLUDED.score,
      last_seen_at = now();
  END LOOP;

  IF array_length(v_keep_ids, 1) IS NOT NULL THEN
    DELETE FROM public.room_players
    WHERE room_id = v_room_id
      AND NOT (id = ANY(v_keep_ids));
  ELSE
    DELETE FROM public.room_players
    WHERE room_id = v_room_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'room_id', v_room_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'active_rooms', (SELECT count(*) FROM public.rooms WHERE status <> 'closed' AND updated_at > now() - interval '24 hours'),
    'online_players', (SELECT count(*) FROM public.room_players WHERE is_online = true AND last_seen_at > now() - interval '2 hours'),
    'words_count', (SELECT count(*) FROM public.dota_words)
  );
$$;

GRANT EXECUTE ON FUNCTION public.sync_room_snapshot(uuid, text, text, text, integer, integer, integer, uuid, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated, service_role;
