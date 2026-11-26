-- 004_endless_turn_rounds.sql
-- Бесконечные пошаговые раунды (круги ходов) обсуждения до тех пор, пока игроки не решат голосовать

-- 1. Разрешаем round_time_seconds = 0 (режим без таймера — бесконечные раунды до голосования)
--    или 30..300 секунд как опциональное время на ОДИН ход игрока (с авто-передачей хода, без завершения игры)
ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_round_time_seconds_check;

ALTER TABLE public.rooms
  ALTER COLUMN round_time_seconds SET DEFAULT 0;

UPDATE public.rooms
SET round_time_seconds = 0
WHERE round_time_seconds > 120;

ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_round_time_seconds_check
  CHECK (round_time_seconds = 0 OR (round_time_seconds BETWEEN 15 AND 300));

-- 2. Добавляем поля пошаговых раундов (кругов) в game_rounds
ALTER TABLE public.game_rounds
  ADD COLUMN IF NOT EXISTS discussion_cycle integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS turn_order uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS turn_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_turn_player_id uuid,
  ADD COLUMN IF NOT EXISTS turn_log jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Бэкфилл для уже активных раундов в статусе discussion
DO $$
DECLARE
  r record;
  v_order uuid[];
  v_first uuid;
  v_idx int;
BEGIN
  FOR r IN
    SELECT gr.id AS round_id, gr.room_id, gr.first_speaker_id
    FROM public.game_rounds gr
    JOIN public.rooms rm ON rm.id = gr.room_id
    WHERE rm.status = 'discussion'
      AND gr.round_number = rm.current_round
      AND (gr.turn_order IS NULL OR COALESCE(array_length(gr.turn_order, 1), 0) = 0)
  LOOP
    SELECT array_agg(p.id ORDER BY p.joined_at ASC)
    INTO v_order
    FROM public.room_players p
    WHERE p.room_id = r.room_id;

    IF v_order IS NOT NULL AND array_length(v_order, 1) > 0 THEN
      v_first := COALESCE(r.first_speaker_id, v_order[1]);
      v_idx := COALESCE(array_position(v_order, v_first), 1) - 1;
      UPDATE public.game_rounds
      SET
        discussion_cycle = 1,
        turn_order = v_order,
        turn_index = v_idx,
        current_turn_player_id = v_order[v_idx + 1]
      WHERE id = r.round_id;

      UPDATE public.rooms
      SET phase_ends_at = NULL
      WHERE id = r.room_id AND round_time_seconds = 0;
    END IF;
  END LOOP;
END;
$$;

-- 4. Внутренняя функция продвижения хода по кругу (Круг 1 -> Круг 2 -> Круг 3 ... бесконечно)
CREATE OR REPLACE FUNCTION public._step_discussion_turn(
  p_room_id uuid,
  p_actor_id uuid,
  p_text text DEFAULT '',
  p_mode text DEFAULT 'text' -- 'text' | 'voice' | 'skip' | 'timeout'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_round public.game_rounds%ROWTYPE;
  v_actor public.room_players%ROWTYPE;
  v_next_player public.room_players%ROWTYPE;
  v_valid_order uuid[];
  v_cur_pos int;
  v_next_idx int;
  v_next_cycle int;
  v_clean_text text := trim(COALESCE(p_text, ''));
  v_entry jsonb;
  v_turn_num int;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  IF NOT FOUND OR v_room.status <> 'discussion' THEN
    RETURN;
  END IF;

  SELECT * INTO v_round
  FROM public.game_rounds
  WHERE room_id = p_room_id AND round_number = v_room.current_round
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Оставляем в очереди ходов только актуальных игроков комнаты (с сохранением порядка)
  SELECT COALESCE(array_agg(u.player_id ORDER BY u.ord), '{}'::uuid[])
  INTO v_valid_order
  FROM unnest(v_round.turn_order) WITH ORDINALITY AS u(player_id, ord)
  JOIN public.room_players rp ON rp.id = u.player_id AND rp.room_id = p_room_id;

  -- Добавляем новых/вернувшихся игроков комнаты, если их ещё не было в turn_order
  SELECT v_valid_order || COALESCE(array_agg(rp.id ORDER BY rp.joined_at ASC), '{}'::uuid[])
  INTO v_valid_order
  FROM public.room_players rp
  WHERE rp.room_id = p_room_id
    AND NOT (rp.id = ANY(v_valid_order));

  IF COALESCE(array_length(v_valid_order, 1), 0) = 0 THEN
    RETURN;
  END IF;

  IF p_actor_id IS NOT NULL THEN
    SELECT * INTO v_actor FROM public.room_players WHERE id = p_actor_id;
  END IF;

  v_turn_num := jsonb_array_length(COALESCE(v_round.turn_log, '[]'::jsonb)) + 1;

  v_entry := jsonb_build_object(
    'id', gen_random_uuid(),
    'turnNumber', v_turn_num,
    'cycle', v_round.discussion_cycle,
    'playerId', COALESCE(v_actor.id, v_round.current_turn_player_id),
    'nickname', COALESCE(v_actor.nickname, 'Игрок'),
    'avatarId', COALESCE(v_actor.avatar_id, 'smoke'),
    'text', CASE
      WHEN p_mode = 'text' AND v_clean_text <> '' THEN left(v_clean_text, 200)
      WHEN p_mode = 'voice' THEN 'Сказал ассоциацию / вопрос вслух'
      WHEN p_mode = 'timeout' THEN 'Время хода истекло — пропуск хода'
      ELSE 'Ход пропущен'
    END,
    'mode', p_mode,
    'createdAt', now()
  );

  v_cur_pos := COALESCE(array_position(v_valid_order, v_round.current_turn_player_id), v_round.turn_index + 1, 1);
  IF v_cur_pos >= array_length(v_valid_order, 1) THEN
    v_next_idx := 0;
    v_next_cycle := v_round.discussion_cycle + 1;
  ELSE
    v_next_idx := v_cur_pos; -- 0-based индекс следующего элемента (v_cur_pos + 1 в 1-based массиве Postgres)
    v_next_cycle := v_round.discussion_cycle;
  END IF;

  SELECT * INTO v_next_player
  FROM public.room_players
  WHERE id = v_valid_order[v_next_idx + 1];

  UPDATE public.game_rounds
  SET
    turn_order = v_valid_order,
    turn_index = v_next_idx,
    discussion_cycle = v_next_cycle,
    current_turn_player_id = v_valid_order[v_next_idx + 1],
    turn_log = COALESCE(v_round.turn_log, '[]'::jsonb) || jsonb_build_array(v_entry)
  WHERE id = v_round.id;

  UPDATE public.rooms
  SET
    phase_ends_at = CASE
      WHEN v_room.round_time_seconds > 0 THEN now() + make_interval(secs => v_room.round_time_seconds)
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_room_id;

  IF v_next_cycle > v_round.discussion_cycle THEN
    PERFORM public._append_room_event(
      p_room_id,
      'system',
      format('Круг #%s завершён! Начался Круг #%s — ход переходит к %s.', v_round.discussion_cycle, v_next_cycle, COALESCE(v_next_player.nickname, 'следующему игроку'))
    );
    PERFORM public._touch_room_signal(
      v_room.code,
      'discussion',
      format('Начался Круг #%s! Ход игрока %s', v_next_cycle, COALESCE(v_next_player.nickname, '')),
      'emerald'
    );
  ELSE
    PERFORM public._touch_room_signal(
      v_room.code,
      'discussion',
      format('Круг #%s: теперь ход игрока %s', v_next_cycle, COALESCE(v_next_player.nickname, '')),
      'violet'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._step_discussion_turn(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- 5. Обновляем _advance_room_timers: в фазе discussion таймер НЕ завершает игру,
--    а лишь передаёт ход следующему игроку (если включён лимит секунд на ход)!
CREATE OR REPLACE FUNCTION public._advance_room_timers(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_round public.game_rounds%ROWTYPE;
  v_host public.room_players%ROWTYPE;
  v_next_host public.room_players%ROWTYPE;
  v_deltas jsonb := '{}'::jsonb;
  v_p record;
  v_pts int;
  v_voted_spy boolean;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR v_room.status = 'closed' THEN
    RETURN;
  END IF;

  UPDATE public.room_players
  SET is_online = false
  WHERE room_id = p_room_id
    AND is_online = true
    AND last_seen_at < now() - interval '20 seconds';

  IF v_room.host_player_id IS NOT NULL THEN
    SELECT * INTO v_host FROM public.room_players WHERE id = v_room.host_player_id;
    IF NOT FOUND OR v_host.last_seen_at < now() - interval '35 seconds' THEN
      SELECT * INTO v_next_host
      FROM public.room_players
      WHERE room_id = p_room_id
        AND last_seen_at >= now() - interval '20 seconds'
      ORDER BY joined_at ASC
      LIMIT 1;

      IF FOUND AND v_next_host.id IS DISTINCT FROM v_room.host_player_id THEN
        UPDATE public.room_players
        SET is_host = (id = v_next_host.id),
            is_ready = CASE WHEN id = v_next_host.id THEN true ELSE is_ready END
        WHERE room_id = p_room_id;

        UPDATE public.rooms
        SET host_player_id = v_next_host.id, updated_at = now()
        WHERE id = p_room_id
        RETURNING * INTO v_room;

        PERFORM public._append_room_event(
          p_room_id,
          'host',
          format('Хост потерял связь — корона автоматически передана игроку %s', v_next_host.nickname)
        );
        PERFORM public._touch_room_signal(
          v_room.code,
          v_room.status,
          format('Новый хост комнаты: %s', v_next_host.nickname),
          'gold'
        );
      END IF;
    END IF;
  END IF;

  IF v_room.phase_ends_at IS NOT NULL AND now() >= v_room.phase_ends_at THEN
    IF v_room.status = 'discussion' THEN
      -- Бесконечные раунды: истечение таймера хода просто передаёт ход следующему игроку!
      SELECT * INTO v_round
      FROM public.game_rounds
      WHERE room_id = p_room_id AND round_number = v_room.current_round
      ORDER BY started_at DESC
      LIMIT 1;

      IF FOUND THEN
        PERFORM public._step_discussion_turn(p_room_id, v_round.current_turn_player_id, '', 'timeout');
      ELSE
        UPDATE public.rooms SET phase_ends_at = NULL WHERE id = p_room_id;
      END IF;

    ELSIF v_room.status = 'voting' THEN
      PERFORM public._resolve_voting(p_room_id);

    ELSIF v_room.status = 'spy_guess' THEN
      SELECT * INTO v_round
      FROM public.game_rounds
      WHERE room_id = p_room_id AND round_number = v_room.current_round
      ORDER BY started_at DESC
      LIMIT 1;

      IF FOUND THEN
        FOR v_p IN SELECT * FROM public.room_players WHERE room_id = p_room_id LOOP
          IF v_p.id = ANY(v_round.spy_player_ids) THEN
            v_deltas := v_deltas || jsonb_build_object(v_p.id::text, 0);
          ELSE
            SELECT EXISTS (
              SELECT 1 FROM public.round_votes rv
              WHERE rv.round_id = v_round.id
                AND rv.voter_player_id = v_p.id
                AND rv.target_player_id = ANY(v_round.spy_player_ids)
            ) INTO v_voted_spy;

            v_pts := 2 + CASE WHEN v_voted_spy THEN 1 ELSE 0 END;
            UPDATE public.room_players SET score = score + v_pts WHERE id = v_p.id;
            v_deltas := v_deltas || jsonb_build_object(v_p.id::text, v_pts);
          END IF;
        END LOOP;

        UPDATE public.game_rounds
        SET
          phase = 'results',
          winner = 'civilians',
          win_reason = 'Шпион раскрыт и не успел угадать слово за отведённое время! Победа мирных!',
          score_deltas = v_deltas,
          ended_at = now()
        WHERE id = v_round.id;
      END IF;

      UPDATE public.rooms
      SET status = 'results', phase_ends_at = NULL, updated_at = now()
      WHERE id = p_room_id;

      PERFORM public._append_room_event(p_room_id, 'system', 'Время на догадку вышло — победа мирных игроков!');
      PERFORM public._touch_room_signal(v_room.code, 'results', 'Шпион не успел назвать слово — победа мирных!', 'emerald');
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._advance_room_timers(uuid) FROM PUBLIC, anon, authenticated;

-- 6. Обновляем rpc_update_settings (разрешаем round_time_seconds = 0 или 15..300 сек на ход)
CREATE OR REPLACE FUNCTION public.rpc_update_settings(
  p_room_code text,
  p_session_token text,
  p_category text DEFAULT NULL,
  p_round_time_seconds integer DEFAULT NULL,
  p_spy_count integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(COALESCE(p_room_code, '')));
  v_room public.rooms%ROWTYPE;
  v_me public.room_players%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE code = v_code AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Комната не найдена');
  END IF;

  SELECT * INTO v_me
  FROM public.room_players
  WHERE room_id = v_room.id AND session_token = p_session_token;

  IF NOT FOUND OR NOT v_me.is_host THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Только хост может менять настройки комнаты');
  END IF;

  IF v_room.status <> 'lobby' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Настройки можно менять только в лобби');
  END IF;

  UPDATE public.rooms
  SET
    category = CASE
      WHEN p_category IN ('heroes', 'items', 'locations') THEN p_category
      ELSE category
    END,
    round_time_seconds = CASE
      WHEN p_round_time_seconds IS NOT NULL AND (p_round_time_seconds = 0 OR p_round_time_seconds BETWEEN 15 AND 300)
        THEN p_round_time_seconds
      ELSE round_time_seconds
    END,
    spy_count = CASE
      WHEN p_spy_count IS NOT NULL AND p_spy_count BETWEEN 1 AND 2 THEN p_spy_count
      ELSE spy_count
    END,
    updated_at = now()
  WHERE id = v_room.id;

  PERFORM public._touch_room_signal(v_room.code, 'lobby', 'Хост обновил настройки матча', 'violet');
  RETURN public.rpc_get_room_state(v_code, p_session_token);
END;
$$;

-- 7. Обновляем rpc_start_game: формируем случайную очередь ходов (turn_order), Круг #1 и бесконечное обсуждение до голосования
CREATE OR REPLACE FUNCTION public.rpc_start_game(
  p_room_code text,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(COALESCE(p_room_code, '')));
  v_room public.rooms%ROWTYPE;
  v_me public.room_players%ROWTYPE;
  v_player_count int;
  v_actual_spies int;
  v_spy_ids uuid[];
  v_turn_order uuid[];
  v_first_speaker uuid;
  v_word public.dota_words%ROWTYPE;
  v_next_round int;
  v_first_name text;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE code = v_code AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Комната не найдена');
  END IF;

  SELECT * INTO v_me
  FROM public.room_players
  WHERE room_id = v_room.id AND session_token = p_session_token;

  IF NOT FOUND OR NOT v_me.is_host THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Только хост комнаты может запустить игру');
  END IF;

  IF v_room.status NOT IN ('lobby', 'results') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Игра уже идёт');
  END IF;

  SELECT count(*) INTO v_player_count FROM public.room_players WHERE room_id = v_room.id;
  IF v_player_count < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Для старта игры нужно минимум 3 игрока в комнате');
  END IF;

  v_actual_spies := LEAST(v_room.spy_count, GREATEST(1, v_player_count - 2));

  -- Случайно выбираем секретное слово (стараясь не повторять слово прошлого раунда)
  SELECT * INTO v_word
  FROM public.dota_words w
  WHERE w.category = v_room.category
    AND w.id NOT IN (
      SELECT COALESCE(gr.secret_word_id, '')
      FROM public.game_rounds gr
      WHERE gr.room_id = v_room.id
      ORDER BY gr.round_number DESC
      LIMIT 3
    )
  ORDER BY random()
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_word
    FROM public.dota_words w
    WHERE w.category = v_room.category
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Случайно выбираем шпиона(ов)
  SELECT array_agg(id) INTO v_spy_ids
  FROM (
    SELECT id FROM public.room_players
    WHERE room_id = v_room.id
    ORDER BY random()
    LIMIT v_actual_spies
  ) s;

  -- Случайный порядок ходов игроков на все круги партии
  SELECT array_agg(id) INTO v_turn_order
  FROM (
    SELECT id FROM public.room_players
    WHERE room_id = v_room.id
    ORDER BY random()
  ) t;

  v_first_speaker := v_turn_order[1];
  SELECT nickname INTO v_first_name FROM public.room_players WHERE id = v_first_speaker;

  v_next_round := v_room.current_round + 1;

  INSERT INTO public.game_rounds (
    room_id,
    round_number,
    category,
    secret_word_id,
    secret_word_name,
    spy_player_ids,
    phase,
    first_speaker_id,
    early_vote_player_ids,
    discussion_cycle,
    turn_order,
    turn_index,
    current_turn_player_id,
    turn_log
  )
  VALUES (
    v_room.id,
    v_next_round,
    v_room.category,
    v_word.id,
    v_word.name_ru,
    v_spy_ids,
    'discussion',
    v_first_speaker,
    '{}'::uuid[],
    1,
    v_turn_order,
    0,
    v_first_speaker,
    '[]'::jsonb
  );

  UPDATE public.rooms
  SET
    status = 'discussion',
    current_round = v_next_round,
    phase_ends_at = CASE
      WHEN v_room.round_time_seconds > 0 THEN now() + make_interval(secs => v_room.round_time_seconds)
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = v_room.id;

  PERFORM public._append_room_event(
    v_room.id,
    'system',
    format('Партия #%s началась! Круг #1 — первым ходит %s.', v_next_round, COALESCE(v_first_name, 'игрок'))
  );
  PERFORM public._touch_room_signal(
    v_room.code,
    'discussion',
    format('Смоки раскрыты! Круг #1 — ход игрока %s', COALESCE(v_first_name, '')),
    'emerald'
  );

  RETURN public.rpc_get_room_state(v_code, p_session_token);
END;
$$;

-- 8. Новые RPC для пошаговых раундов: отправка хода (текстом или голосом) и пропуск хода хостом
CREATE OR REPLACE FUNCTION public.rpc_submit_turn(
  p_room_code text,
  p_session_token text,
  p_text text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(COALESCE(p_room_code, '')));
  v_room public.rooms%ROWTYPE;
  v_me public.room_players%ROWTYPE;
  v_round public.game_rounds%ROWTYPE;
  v_clean text := trim(COALESCE(p_text, ''));
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE code = v_code AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Комната не найдена');
  END IF;

  SELECT * INTO v_me
  FROM public.room_players
  WHERE room_id = v_room.id AND session_token = p_session_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Сессия игрока не найдена');
  END IF;

  IF v_room.status <> 'discussion' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Сейчас не фаза раундов обсуждения');
  END IF;

  SELECT * INTO v_round
  FROM public.game_rounds
  WHERE room_id = v_room.id AND round_number = v_room.current_round
  ORDER BY started_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Активный раунд не найден');
  END IF;

  IF v_round.current_turn_player_id IS NOT NULL AND v_round.current_turn_player_id <> v_me.id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Сейчас ход другого игрока');
  END IF;

  PERFORM public._step_discussion_turn(
    v_room.id,
    v_me.id,
    v_clean,
    CASE WHEN v_clean <> '' THEN 'text' ELSE 'voice' END
  );

  RETURN public.rpc_get_room_state(v_code, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_skip_turn(
  p_room_code text,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(COALESCE(p_room_code, '')));
  v_room public.rooms%ROWTYPE;
  v_me public.room_players%ROWTYPE;
  v_round public.game_rounds%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE code = v_code AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Комната не найдена');
  END IF;

  SELECT * INTO v_me
  FROM public.room_players
  WHERE room_id = v_room.id AND session_token = p_session_token;

  IF NOT FOUND OR NOT v_me.is_host THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Только хост может пропустить ход AFK-игрока');
  END IF;

  IF v_room.status <> 'discussion' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Сейчас не фаза обсуждения');
  END IF;

  SELECT * INTO v_round
  FROM public.game_rounds
  WHERE room_id = v_room.id AND round_number = v_room.current_round
  ORDER BY started_at DESC
  LIMIT 1;

  IF FOUND THEN
    PERFORM public._step_discussion_turn(v_room.id, v_round.current_turn_player_id, '', 'skip');
  END IF;

  RETURN public.rpc_get_room_state(v_code, p_session_token);
END;
$$;

-- 9. Обновляем rpc_get_room_state: возвращаем discussionState (текущий круг, очередь ходов, чей ход, история всех кругов)
CREATE OR REPLACE FUNCTION public.rpc_get_room_state(p_room_code text, p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(COALESCE(p_room_code, '')));
  v_room public.rooms%ROWTYPE;
  v_me public.room_players%ROWTYPE;
  v_round public.game_rounds%ROWTYPE;
  v_word public.dota_words%ROWTYPE;
  v_guessed_word public.dota_words%ROWTYPE;
  v_is_spy boolean := false;
  v_players_json jsonb;
  v_categories_meta jsonb;
  v_category_words jsonb;
  v_my_role jsonb := NULL;
  v_discussion jsonb := NULL;
  v_turn_order_players jsonb := '[]'::jsonb;
  v_cur_turn_name text := NULL;
  v_voting jsonb := NULL;
  v_spy_guess jsonb := NULL;
  v_results jsonb := NULL;
  v_first_speaker_name text := NULL;
  v_caught_spy_name text := NULL;
  v_accused_name text := NULL;
  v_my_vote uuid := NULL;
  v_voted_ids jsonb := '[]'::jsonb;
  v_votes_breakdown jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE code = v_code AND status <> 'closed';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Комната не найдена или закрыта');
  END IF;

  SELECT * INTO v_me
  FROM public.room_players
  WHERE room_id = v_room.id AND session_token = p_session_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Сессия игрока не найдена в комнате');
  END IF;

  UPDATE public.room_players
  SET is_online = true, last_seen_at = now()
  WHERE id = v_me.id
  RETURNING * INTO v_me;

  PERFORM public._advance_room_timers(v_room.id);

  SELECT * INTO v_room FROM public.rooms WHERE id = v_room.id;
  SELECT * INTO v_me FROM public.room_players WHERE id = v_me.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'avatarId', p.avatar_id,
        'isHost', p.is_host,
        'isOnline', p.is_online,
        'isReady', p.is_ready,
        'score', p.score,
        'joinedAt', p.joined_at
      ) ORDER BY p.joined_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_players_json
  FROM public.room_players p
  WHERE p.room_id = v_room.id;

  SELECT jsonb_build_array(
    jsonb_build_object(
      'id', 'heroes',
      'label', 'Герои',
      'description', 'Все 127 героев Света и Тьмы',
      'wordCount', (SELECT count(*) FROM public.dota_words WHERE category = 'heroes')
    ),
    jsonb_build_object(
      'id', 'items',
      'label', 'Предметы',
      'description', 'Все предметы лавки, Рошана и нейтралки',
      'wordCount', (SELECT count(*) FROM public.dota_words WHERE category = 'items')
    ),
    jsonb_build_object(
      'id', 'locations',
      'label', 'Локации',
      'description', 'Ключевые точки и объекты карты Dota 2',
      'wordCount', (SELECT count(*) FROM public.dota_words WHERE category = 'locations')
    )
  ) INTO v_categories_meta;

  IF v_room.status IN ('discussion', 'voting', 'spy_guess', 'results') AND v_room.current_round > 0 THEN
    SELECT * INTO v_round
    FROM public.game_rounds
    WHERE room_id = v_room.id AND round_number = v_room.current_round
    ORDER BY started_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- Самовосстановление очереди: если текущий активный игрок покинул комнату, передаём ход дальше
      IF v_room.status = 'discussion' AND (
        v_round.current_turn_player_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.room_players rp
          WHERE rp.id = v_round.current_turn_player_id AND rp.room_id = v_room.id
        )
      ) THEN
        PERFORM public._step_discussion_turn(v_room.id, NULL, '', 'skip');
        SELECT * INTO v_round FROM public.game_rounds WHERE id = v_round.id;
        SELECT * INTO v_room FROM public.rooms WHERE id = v_room.id;
      END IF;

      v_is_spy := (v_me.id = ANY(v_round.spy_player_ids));

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', w.id,
            'name', w.name_ru,
            'nameEn', w.name_en,
            'hint', w.hint,
            'image', w.image_url,
            'category', w.category
          ) ORDER BY w.name_ru ASC
        ),
        '[]'::jsonb
      )
      INTO v_category_words
      FROM public.dota_words w
      WHERE w.category = v_round.category;

      SELECT * INTO v_word FROM public.dota_words WHERE id = v_round.secret_word_id;
      SELECT nickname INTO v_first_speaker_name FROM public.room_players WHERE id = v_round.first_speaker_id;
      SELECT nickname INTO v_cur_turn_name FROM public.room_players WHERE id = v_round.current_turn_player_id;

      -- Очередь игроков для текущего круга
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', rp.id,
            'nickname', rp.nickname,
            'avatarId', rp.avatar_id,
            'isOnline', rp.is_online,
            'position', u.ord
          ) ORDER BY u.ord ASC
        ),
        '[]'::jsonb
      )
      INTO v_turn_order_players
      FROM unnest(v_round.turn_order) WITH ORDINALITY AS u(player_id, ord)
      JOIN public.room_players rp ON rp.id = u.player_id AND rp.room_id = v_room.id;

      v_discussion := jsonb_build_object(
        'cycle', COALESCE(v_round.discussion_cycle, 1),
        'turnIndex', COALESCE(v_round.turn_index, 0),
        'currentTurnPlayerId', v_round.current_turn_player_id,
        'currentTurnNickname', v_cur_turn_name,
        'isMyTurn', (v_round.current_turn_player_id = v_me.id),
        'turnOrder', v_turn_order_players,
        'turnLog', COALESCE(v_round.turn_log, '[]'::jsonb)
      );

      IF v_is_spy THEN
        v_my_role := jsonb_build_object(
          'isSpy', true,
          'roundNumber', v_round.round_number,
          'category', v_round.category,
          'totalSpies', COALESCE(array_length(v_round.spy_player_ids, 1), 1),
          'word', NULL,
          'categoryWords', v_category_words,
          'firstSpeakerNickname', v_first_speaker_name,
          'earlyVotePlayerIds', to_jsonb(COALESCE(v_round.early_vote_player_ids, '{}'::uuid[]))
        );
      ELSE
        v_my_role := jsonb_build_object(
          'isSpy', false,
          'roundNumber', v_round.round_number,
          'category', v_round.category,
          'totalSpies', COALESCE(array_length(v_round.spy_player_ids, 1), 1),
          'word', jsonb_build_object(
            'id', v_word.id,
            'name', v_word.name_ru,
            'nameEn', v_word.name_en,
            'hint', v_word.hint,
            'image', v_word.image_url,
            'category', v_word.category
          ),
          'categoryWords', v_category_words,
          'firstSpeakerNickname', v_first_speaker_name,
          'earlyVotePlayerIds', to_jsonb(COALESCE(v_round.early_vote_player_ids, '{}'::uuid[]))
        );
      END IF;

      SELECT target_player_id INTO v_my_vote
      FROM public.round_votes
      WHERE round_id = v_round.id AND voter_player_id = v_me.id;

      SELECT COALESCE(jsonb_agg(voter_player_id), '[]'::jsonb)
      INTO v_voted_ids
      FROM public.round_votes
      WHERE round_id = v_round.id;

      v_voting := jsonb_build_object(
        'myVoteTargetId', v_my_vote,
        'votedPlayerIds', v_voted_ids
      );

      IF v_room.status = 'spy_guess' THEN
        SELECT nickname INTO v_caught_spy_name FROM public.room_players WHERE id = v_round.caught_spy_id;
        v_spy_guess := jsonb_build_object(
          'caughtSpyId', v_round.caught_spy_id,
          'caughtSpyNickname', v_caught_spy_name,
          'amICaughtSpy', (v_me.id = v_round.caught_spy_id),
          'categoryWords', v_category_words
        );
      END IF;

      IF v_room.status = 'results' THEN
        IF v_round.spy_guess_word_id IS NOT NULL THEN
          SELECT * INTO v_guessed_word FROM public.dota_words WHERE id = v_round.spy_guess_word_id;
        END IF;
        SELECT nickname INTO v_caught_spy_name FROM public.room_players WHERE id = v_round.caught_spy_id;
        SELECT nickname INTO v_accused_name FROM public.room_players WHERE id = v_round.accused_player_id;

        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'voterId', rv.voter_player_id,
              'voterNickname', pv.nickname,
              'targetId', rv.target_player_id,
              'targetNickname', pt.nickname
            )
          ),
          '[]'::jsonb
        )
        INTO v_votes_breakdown
        FROM public.round_votes rv
        LEFT JOIN public.room_players pv ON pv.id = rv.voter_player_id
        LEFT JOIN public.room_players pt ON pt.id = rv.target_player_id
        WHERE rv.round_id = v_round.id;

        v_results := jsonb_build_object(
          'roundNumber', v_round.round_number,
          'winner', v_round.winner,
          'winReason', v_round.win_reason,
          'spyPlayerIds', to_jsonb(v_round.spy_player_ids),
          'caughtSpyId', v_round.caught_spy_id,
          'caughtSpyNickname', v_caught_spy_name,
          'accusedPlayerId', v_round.accused_player_id,
          'accusedNickname', v_accused_name,
          'secretWord', jsonb_build_object(
            'id', v_word.id,
            'name', v_word.name_ru,
            'nameEn', v_word.name_en,
            'hint', v_word.hint,
            'image', v_word.image_url,
            'category', v_word.category
          ),
          'spyGuessedWord', CASE
            WHEN v_round.spy_guess_word_id IS NOT NULL THEN jsonb_build_object(
              'id', v_guessed_word.id,
              'name', v_guessed_word.name_ru
            )
            ELSE NULL
          END,
          'scoreDeltas', COALESCE(v_round.score_deltas, '{}'::jsonb),
          'votesBreakdown', v_votes_breakdown
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'serverNow', now(),
    'me', jsonb_build_object(
      'playerId', v_me.id,
      'nickname', v_me.nickname,
      'avatarId', v_me.avatar_id,
      'sessionToken', v_me.session_token,
      'roomCode', v_room.code
    ),
    'room', jsonb_build_object(
      'id', v_room.id,
      'code', v_room.code,
      'status', v_room.status,
      'settings', jsonb_build_object(
        'category', v_room.category,
        'roundTimeSeconds', v_room.round_time_seconds,
        'spyCount', v_room.spy_count
      ),
      'currentRound', v_room.current_round,
      'hostPlayerId', v_room.host_player_id,
      'phaseEndsAt', v_room.phase_ends_at,
      'players', v_players_json,
      'events', COALESCE(v_room.events, '[]'::jsonb),
      'categoriesMeta', v_categories_meta
    ),
    'myRole', v_my_role,
    'discussion', v_discussion,
    'voting', v_voting,
    'spyGuess', v_spy_guess,
    'results', v_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_submit_turn(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_skip_turn(text, text) TO anon, authenticated;
