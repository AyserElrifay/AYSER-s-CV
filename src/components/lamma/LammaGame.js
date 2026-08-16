import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/theme';
import { useLang } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { QuestionCard } from './QuestionCard';
import { Strip, leaderboardSegments, StripLabel } from './Strip';
import { Standings, RankChip } from './Standings';
import { LangPicker } from './LangPicker';
import { PLAY_LANGS, playLangFor } from './languages';
import { EgyptMeter } from './EgyptMeter';
import { PharaohCam } from './PharaohCam';
import { Face } from './Face';
import {
  advance, submitAnswer, reveal as revealRpc, sync as syncRpc,
  fetchPackQuestions, fetchRoomPlayers, subscribeRoom, nudge, claimHost, setConnected,
  roomResults, setFace,
} from '../../services/lamma';
import { tapLight, tapSuccess } from '../../utils/feedback';

/* ─── لمّة · A GAME, START TO FINISH ─────────────────────────────────
   Lobby → question → reveal → leaderboard → question → … → podium.

   THE SERVER IS ASKED, NEVER TOLD. Every phase change here is a request
   that the server may refuse. What arrives back over realtime is a
   nudge to go and look again, not news to be believed — so a tampered
   client can make its own screen lie to its owner and change nothing
   for anybody else.

   COMING BACK IS ORDINARY. sync() is called on mount, whenever the
   connection returns, and whenever a nudge lands. A phone that was in a
   tunnel rejoins at the right question with the right time left, and
   may still answer if the deadline has not passed. Missing a question
   costs that question and nothing else — the room is never held up and
   never restarted.

   EVERYBODY READS IT IN THEIR OWN LANGUAGE. The language of the
   questions is chosen per PHONE, not per room, and it can be changed
   mid-game without leaving — a wrong choice at the lobby should cost
   one tap, not the evening. Nothing about the game changes with it:
   same question, same tiles in the same places, same clock.          */

const HOST_GONE_MS = 10000;

export const LammaGame = ({ roomId, joinCode, packId, isHost: initialHost, onExit }) => {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { user } = useAuth();

  const [state, setState] = useState(null);          // from sync()
  const [questions, setQuestions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [result, setResult] = useState(null);        // the reveal, once it is allowed
  const [barW, setBarW] = useState(0);
  const [busy, setBusy] = useState(false);
  /* The questions are written in five languages; the app speaks
     thirteen. Start on theirs if the pack has it, English if not. */
  const [playLang, setPlayLang] = useState(() => playLangFor(lang));
  const [showLangs, setShowLangs] = useState(false);
  const [results, setResults] = useState(null);      // right answers, at the end
  const [camOpen, setCamOpen] = useState(false);     // the pharaoh camera
  const hostGoneSince = useRef(null);

  const isHost = state ? state.is_host : initialHost;
  const q = state && state.question_index >= 0 ? questions[state.question_index] : null;

  const refresh = useCallback(async () => {
    const s = await syncRpc(roomId);
    if (s && s.ok) {
      setState({ ...s, is_host: s.host_user_id ? s.host_user_id === (user && user.id) : initialHost });
      setPlayers(s.leaderboard || []);
    }
  }, [roomId, user, initialHost]);

  // the questions, WITHOUT their answers — see services/lamma.js
  useEffect(() => {
    let alive = true;
    if (!packId) return undefined;
    fetchPackQuestions(packId)
      .then((rows) => { if (alive) setQuestions(rows); })
      .catch(() => { if (alive) setQuestions([]); });
    return () => { alive = false; };
  }, [packId]);

  useEffect(() => {
    refresh();
    setConnected(roomId, true);
    const off = subscribeRoom(roomId, {
      onPhase: () => { setResult(null); refresh(); },
      onRoom: () => { setResult(null); refresh(); },
      onPlayers: () => { fetchRoomPlayers(roomId).then(setPlayers).catch(() => {}); },
    });
    /* A poll as well as a subscription. A dropped socket is silent, and
       a room that has moved on without you is the one thing this screen
       must never do. Five seconds is cheap and invisible. */
    const tick = setInterval(refresh, 5000);
    return () => { off(); clearInterval(tick); setConnected(roomId, false); };
  }, [roomId, refresh]);

  /* Once the deadline has passed, ask for the reveal. The server
     refuses if it is early, so this can be asked as often as it likes
     without ever leaking an answer. */
  useEffect(() => {
    if (!state || !q || state.status !== 'question' || result) return undefined;
    const deadline = state.deadline_at ? new Date(state.deadline_at).getTime() : 0;
    const wait = Math.max(300, deadline - Date.now() + 400);
    const timer = setTimeout(async () => {
      const r = await revealRpc(roomId, q.id);
      if (r && r.ok) { setResult(r); refresh(); }
    }, wait);
    return () => clearTimeout(timer);
  }, [state && state.status, state && state.question_index, q && q.id, result, roomId, refresh]);

  /* Nobody driving? After ten seconds anybody may take the wheel. The
     server decides who actually gets it. */
  useEffect(() => {
    if (!state || isHost || state.status === 'ended') { hostGoneSince.current = null; return undefined; }
    const hostHere = (players || []).some((p) => p.user_id === state.host_user_id && p.is_connected !== false);
    if (hostHere) { hostGoneSince.current = null; return undefined; }
    if (!hostGoneSince.current) hostGoneSince.current = Date.now();
    const timer = setTimeout(async () => {
      if (hostGoneSince.current && Date.now() - hostGoneSince.current >= HOST_GONE_MS) {
        await claimHost(roomId);
        refresh();
      }
    }, HOST_GONE_MS);
    return () => clearTimeout(timer);
  }, [state, players, isHost, roomId, refresh]);

  /* When it is over, ask what everybody actually KNEW — right answers
     out of the whole pack, which is not the same list as the scores. */
  useEffect(() => {
    if (!state || state.status !== 'ended') return undefined;
    let alive = true;
    roomResults(roomId).then((r) => { if (alive && r && r.ok) setResults(r); });
    return () => { alive = false; };
  }, [state && state.status, roomId]);

  const onAnswer = async (index, elapsedMs) => {
    if (!q) return;
    await submitAnswer(roomId, q.id, index, elapsedMs);
    refresh();
  };

  const next = async () => {
    if (busy) return;
    setBusy(true);
    tapLight();
    const r = await advance(roomId);
    setResult(null);
    if (r && r.ok) nudge(roomId, { phase: r.status });
    await refresh();
    setBusy(false);
  };

  if (!state) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.purple} />
      </View>
    );
  }

  const ended = state.status === 'ended';
  const podium = (players || []).slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
        <Pressable onPress={() => { tapLight(); onExit && onExit(); }} hitSlop={10}>
          <Ionicons name="chevron-down" size={26} color={C.text} />
        </Pressable>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginStart: 10, flex: 1 }}>
          {t('lamma_title')}
        </Text>
        {state.status !== 'lobby' && !ended ? (
          <View style={{ marginEnd: 8 }}>
            <RankChip players={players} meId={user && user.id} t={t} />
          </View>
        ) : null}
        {/* Chose the wrong language at the lobby, or joined late and
            never saw the choice? One tap, mid-question, no leaving. */}
        {state.status !== 'lobby' ? (
          <Pressable onPress={() => { tapLight(); setShowLangs((v) => !v); }} hitSlop={8} style={{ marginEnd: 8 }}>
            <View style={{ backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 13 }}>
                {(PLAY_LANGS.find((l) => l.code === playLang) || PLAY_LANGS[1]).flag}
              </Text>
            </View>
          </Pressable>
        ) : null}
        {joinCode ? (
          <View style={{ backgroundColor: C.purpleSoft, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6 }}>
            <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900', letterSpacing: 2 }}>{joinCode}</Text>
          </View>
        ) : null}
      </View>

      {/* The camera. Mounted only while it is open, so nothing holds the
          camera while a game is being played. */}
      {camOpen ? (
        <PharaohCam
          visible={camOpen}
          t={t}
          onClose={() => setCamOpen(false)}
          onDone={async (dataUrl) => {
            if (!dataUrl) return;
            const r = await setFace(roomId, dataUrl);
            if (r && r.ok) refresh();
          }}
        />
      ) : null}

      {/* Opened from the header pill, closes on choosing. Sits over
          nothing — it pushes the game down for a second rather than
          covering the question somebody is still reading. */}
      {showLangs && state.status !== 'lobby' ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <LangPicker
            value={playLang}
            onChange={(code) => { setPlayLang(code); setShowLangs(false); }}
            label={t('lamma_question_lang')}
          />
        </View>
      ) : null}

      {/* ── LOBBY ── */}
      {state.status === 'lobby' ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ color: C.faint, fontSize: 13, marginBottom: 4 }}>{t('lamma_code_label')}</Text>
          <Text style={{ color: C.text, fontSize: 40, fontWeight: '900', letterSpacing: 8, marginBottom: 18 }}>
            {joinCode || '—'}
          </Text>
          {/* Before anybody starts: what will you be reading? Everyone
              in the room answers the same question at the same moment,
              each in the language they think fastest in. */}
          <View style={{ marginBottom: 18 }}>
            <LangPicker value={playLang} onChange={setPlayLang} label={t('lamma_question_lang')} />
          </View>

          {/* And who will you be? Only where the regalia belongs — a
              nemes headcloth on a European football night is fancy
              dress, and this is not that. */}
          {state.pack_country === 'EG' ? (
            <Pressable onPress={() => { tapLight(); setCamOpen(true); }} style={{ marginBottom: 20 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: C.glass, borderWidth: 1, borderColor: C.gold,
                borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16,
              }}>
                <Text style={{ fontSize: 16 }}>📸</Text>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '900', marginStart: 8, flexShrink: 1 }} numberOfLines={1}>
                  {t('lamma_face_cta')}
                </Text>
              </View>
            </Pressable>
          ) : null}

          <Text style={{ color: C.faint, fontSize: 13, marginBottom: 10 }}>
            {(players || []).length} {t('lamma_players_here')}
          </Text>
          {(players || []).map((p) => (
            <View key={p.user_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
              <Face player={p} size={34} />
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginStart: 11, flex: 1 }}>{p.nickname}</Text>
              {p.user_id === state.host_user_id ? (
                <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800' }}>{t('lamma_host')}</Text>
              ) : null}
            </View>
          ))}
          {isHost ? (
            <Pressable onPress={next} disabled={busy} style={{ marginTop: 20 }}>
              <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingVertical: 15, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{t('lamma_start_game')}</Text>
              </View>
            </Pressable>
          ) : (
            <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', marginTop: 24 }}>{t('lamma_waiting')}</Text>
          )}
        </ScrollView>
      ) : null}

      {/* ── A QUESTION, AND ITS REVEAL ── */}
      {!ended && state.status !== 'lobby' && q ? (
        <View style={{ flex: 1 }}>
          <QuestionCard
            question={q}
            index={state.question_index}
            total={questions.length}
            onAnswer={onAnswer}
            result={result}
            t={t}
            lang={playLang}
          />
          {/* The half second after the answer is why people play this in
              a room together. Show them who moved. */}
          {result && (players || []).length > 1 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
              <Standings players={players} meId={user && user.id} questionIndex={state.question_index} t={t} />
            </View>
          ) : null}
          {result && isHost ? (
            <Pressable onPress={next} disabled={busy} style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 14, paddingTop: 10 }}>
              <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('lamma_next')}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── THE PODIUM ── the same bar, one last job */}
      {ended ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginBottom: 16 }}>{t('lamma_final')}</Text>
          <View onLayout={(e) => setBarW(e.nativeEvent.layout.width)} style={{ marginBottom: 18 }}>
            <StripLabel>{t('lamma_final')}</StripLabel>
            <Strip mode="leaderboard" width={barW} segments={leaderboardSegments(players)} />
          </View>
          {podium.map((p, i) => (
            <View key={p.user_id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 10 }}>
              <Text style={{ fontSize: 22 }}>{['🥇', '🥈', '🥉'][i]}</Text>
              <View style={{ marginStart: 10 }}><Face player={p} size={38} ring={C.gold} /></View>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginStart: 10, flex: 1, minWidth: 0 }} numberOfLines={1}>{p.nickname}</Text>
              <Text style={{ color: C.purple, fontSize: 16, fontWeight: '900' }}>{p.score}</Text>
            </View>
          ))}
          {(players || []).slice(3).map((p) => (
            <View key={p.user_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
              <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700', flex: 1 }}>{p.nickname}</Text>
              <Text style={{ color: C.faint, fontSize: 14, fontWeight: '800' }}>{p.score}</Text>
            </View>
          ))}
          {/* Egypt's pack ends with a second table: not who was fastest,
              but who actually knew. It only appears for the country the
              questions are about. */}
          {results && results.country === 'EG' ? (
            <EgyptMeter results={results} meId={user && user.id} t={t} />
          ) : null}

          <Pressable onPress={() => { tapSuccess(); onExit && onExit(); }} style={{ marginTop: 20 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('lamma_play_again')}</Text>
            </View>
          </Pressable>
        </ScrollView>
      ) : null}
    </View>
  );
};
