-- 005: Исправление автоматического переноса короны хоста
--
-- Проблема: _advance_room_timers переносил корону хоста на другого игрока, если
-- last_seen_at хоста устаревало всего 35 секунд. В реальном использовании таймер
-- heartbeat (5 сек) в браузере замедляется на фоне/в фоне-табе, поэтому корона
-- хоста постоянно «перескакивала» между игроками — первый хост лишался прав и
-- не мог менять настройки (время раунда), а после ручной передачи хоста новый
-- хост кратковременно становился хостом и мог настроить время.
--
-- Исправление:
-- 1) Автоматический перенос короны происходит ТОЛЬКО в статусе лобби (lobby),
--    чтобы не переключать хоста во время кругов, голосования или результатов.
-- 2) Порог «хост offline» увеличен с 35 сек до 120 сек.

CREATE OR REPLACE FUNCTION public._advance_room_timers(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

  -- Автоматический перенос короны хоста: только в лобби и только после
  -- 120 секунд отсутствия хоста (не 35 сек, чтобы не «перескакивать» хоста
  -- при фоновой работе браузера).
  IF v_room.status = 'lobby' AND v_room.host_player_id IS NOT NULL THEN
    SELECT * INTO v_host FROM public.room_players WHERE id = v_room.host_player_id;
    IF NOT FOUND OR v_host.last_seen_at < now() - interval '120 seconds' THEN
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
          format('Хост отсутствует — корона автоматически передана игроку %s', v_next_host.nickname)
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
$function$;

REVOKE ALL ON FUNCTION public._advance_room_timers(uuid) FROM PUBLIC, anon, authenticated;
