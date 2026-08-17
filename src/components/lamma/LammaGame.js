import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../../constants/theme';
import { useLang } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { QuestionCard } from './QuestionCard';
import { Strip, leaderboardSegments, StripLabel } from './Strip';
import { Standings, RankChip } from './Standings';
import { LangPicker } from './LangPicker';
import { PLAY_LANGS, playLangFor, say } from './languages';
import { EgyptMeter } from './EgyptMeter';
import { PharaohCam } from './PharaohCam';
import { CharacterSheet } from './CharacterSheet';
import { sendFaceToAlbum } from '../../services/green';
import { Stage, StageBody } from './Stage';
import { Face } from './Face';
import { Podium } from './Podium';
import {
  advance, submitAnswer, reveal as revealRpc, sync as syncRpc,
  fetchPackQuestions, fetchRoomPlayers, subscribeRoom, nudge, claimHost, setConnected,
  roomResults, setFace, setRoom, kick, showOptions,
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

/* The lengths a room may run at. The server accepts exactly these four
   and refuses anything else, so this list and that list have to agree —
   see supabase/schema_v24_lamma_host.sql. */
const TIMERS = [10000, 20000, 30000, 45000];

/* How many questions a round is. 0 means the whole pack — the server
   accepts exactly these four, so this list and that one have to agree
   (supabase/schema_v25_lamma_rounds.sql). Fifteen is the default
   because forty-three was half an hour and people said so. */
const ROUNDS = [10, 15, 25, 0];

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
  const [charOpen, setCharOpen] = useState(false);   // the character maker
  /* The last look they built, kept for the length of this screen so
     reopening the maker starts where they left off rather than back at
     the default. It is not worth storing anywhere: the character on
     the seat is the thing that matters, and the server has that. */
  const [myLook, setMyLook] = useState(null);
  const [stageOpen, setStageOpen] = useState(false); // the shared screen
  const hostGoneSince = useRef(null);

  const isHost = state ? state.is_host : initialHost;

  /* ── HAVE YOU GOT A PHARAOH YET ───────────────────────────────────
     Read off the seat the server knows about, not off a flag this
     screen keeps: a player who built one on another phone, or before
     a reload, already has it and must not be asked again. */
  const me = (players || []).find((p) => p.user_id === (user && user.id)) || null;
  const myName = (me && me.nickname) || (user && user.user_metadata && user.user_metadata.name) || null;
  const hasFace = !!(me && typeof me.avatar_key === 'string'
    && me.avatar_key.indexOf('data:image/jpeg;base64,') === 0);
  const needsFace = !!(state && state.pack_country === 'EG' && !hasFace);

  /* Presenting rather than playing. Read off the server's answer, not
     off a local flag, so a host who set it on one phone and opened the
     room on another gets the same screen. */
  const presenting = !!(state && state.im_playing === false);

  /* ── WHICH QUESTION IS "QUESTION FOUR" ────────────────────────────
     The ROOM decides, not the pack. A room draws fifteen of the pack's
     questions in its own random order when it is made, so the index
     counts along that list — and every phone in the room reads the
     same list, which is why they all see the same question.

     A room made before rounds existed has no list, and falls back to
     the pack in written order. */
  const roundIds = Array.isArray(state && state.question_ids) ? state.question_ids : [];
  const total = roundIds.length || questions.length;
  const q = (() => {
    if (!state || state.question_index < 0) return null;
    if (roundIds.length) {
      const id = roundIds[state.question_index];
      return questions.find((row) => row && row.id === id) || null;
    }
    return questions[state.question_index] || null;
  })();

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
      .then((rows) => {
        if (!alive) return;
        setQuestions(rows);
        /* Some questions are a picture. Fetch them all now, in the
           lobby, while everybody is still arriving — a photograph that
           starts downloading when the question appears is a photograph
           somebody answers around, with the clock already running. */
        (rows || []).forEach((row) => {
          if (row && row.media_url) { try { Image.prefetch(row.media_url); } catch (e) {} }
        });
      })
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
     server decides who actually gets it.

     Unless the host has bolted the seat. Running the evening on a
     shared screen, a phone that locks itself for ninety seconds looked
     exactly like a host who had left, and somebody else was promoted
     mid-round. A bolted seat is refused by the server too — this is
     only about not asking. */
  useEffect(() => {
    if (!state || isHost || state.host_locked || state.status === 'ended') {
      hostGoneSince.current = null; return undefined;
    }
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

  /* Send the code the way the phone knows how — the share sheet if it
     has one, the clipboard if it does not, and the code is on screen
     anyway if neither works. Nothing here can leave somebody with no
     way to pass it on. */
  const [copied, setCopied] = useState(false);
  const shareCode = async () => {
    if (!joinCode) return;
    tapLight();
    const text = t('lamma_share_text').replace('{code}', joinCode);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(joinCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch (e) { /* they can read it off the screen */ }
  };

  /* ── THE HOST'S LEVERS ────────────────────────────────────────────
     Asked for, never assumed: each of these is refused by the server
     unless the person tapping is the host, so the button being on
     screen is a convenience and not the permission. */
  const chooseTimer = async (ms) => {
    tapLight();
    const r = await setRoom(roomId, ms, null, null, null, null, null);
    if (r && r.ok) refresh();
  };
  const toggleLock = async () => {
    tapLight();
    const r = await setRoom(roomId, null, !state.locked, null, null, null, null);
    if (r && r.ok) refresh();
  };
  /* Bolting the seat: this room has one host and it is not up for
     grabs. Off by default and never inherited — a bolted seat and a
     host who really has gone is a room nobody can advance, which is a
     worse evening than the one it prevents. So it is a choice made by
     somebody sitting in front of the screen. */
  const toggleHostLock = async () => {
    tapLight();
    const r = await setRoom(roomId, null, null, null, null, !state.host_locked, null);
    if (r && r.ok) refresh();
  };
  /* "I read them out, I don't answer." Takes the host off the board,
     out of the final ranking, and makes the server refuse their
     answers — see supabase/schema_v38_presenter.sql. Their score goes
     with them: a presenter who played the first three questions must
     not keep three questions' worth of points on a ranking they are
     no longer on. */
  const togglePresenting = async () => {
    tapLight();
    const r = await setRoom(roomId, null, null, null, null, null, presenting);
    if (r && r.ok) refresh();
  };
  /* Re-draws the round, so it is a different fifteen as well as a
     different length. Only in the lobby — the server refuses to change
     the questions under a game that has started. */
  const chooseRound = async (n) => {
    tapLight();
    const r = await setRoom(roomId, null, null, n, null, null, null);
    if (r && r.ok) refresh();
  };
  const removePlayer = async (id) => {
    tapLight();
    const r = await kick(roomId, id);
    if (r && r.ok) refresh();          // sync carries the player list
  };

  /* Sharing the screen turns the reading step on for the room: the
     question goes up alone, the host reads it out, and the choices —
     and the clock — arrive on the second tap. Closing the stage leaves
     it on, because a host who was presenting a moment ago is usually
     still presenting. */
  const openStage = async () => {
    tapLight();
    setStageOpen(true);
    if (isHost && !state.read_first) {
      const r = await setRoom(roomId, null, null, null, true, null, null);
      if (r && r.ok) refresh();
    }
  };

  const revealChoices = async () => {
    setBusy(true);
    const r = await showOptions(roomId);
    if (r && r.ok) nudge(roomId, { phase: 'question' });
    await refresh();
    setBusy(false);
  };

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
        {/* THE SHARED SCREEN. Only the host gets it: it is the view for
            somebody reading the questions out to a call, and it turns
            on the read-first step for the whole room. */}
        {isHost ? (
          <Pressable onPress={openStage} hitSlop={8} style={{ marginEnd: 8 }}>
            <View style={{ backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Ionicons name="tv-outline" size={15} color={C.text} />
            </View>
          </Pressable>
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
            /* And to the album, which the camera screen said it would
               do before the shutter. Sent second and allowed to fail on
               its own: an album that does not answer must never cost
               somebody their seat. */
            if (r && r.ok) {
              try { await sendFaceToAlbum(dataUrl, 'photo', myName, roomId, packId); } catch (e) {}
              refresh();
            }
          }}
        />
      ) : null}

      {/* The character maker. Mounted only while open, same as the
          camera — and it needs no permission from anybody, which is
          the point of having both. */}
      {charOpen ? (
        <CharacterSheet
          roomId={roomId}
          packId={packId}
          nickname={myName}
          initial={myLook}
          onClose={() => setCharOpen(false)}
          onSaved={(look) => { setMyLook(look); refresh(); }}
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
          {/* THE CODE IS THE INVITATION, so it is the biggest thing on
              the screen and it can be sent in one tap. Everybody who
              types it lands in this room, sees the same question at the
              same second, and finishes on the same ranking. */}
          <Text style={{ color: C.faint, fontSize: 13, marginBottom: 4 }}>{t('lamma_code_label')}</Text>
          <Text style={{ color: C.text, fontSize: 40, fontWeight: '900', letterSpacing: 8 }}>
            {joinCode || '—'}
          </Text>
          <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 2, marginBottom: 12 }}>
            {t('lamma_code_hint')}
          </Text>
          {/* Sending the code is the door, so it belongs to the host
              with every other lever. Everybody else can still SEE the
              code — they are in the room, and a room whose own name is
              hidden from the people in it is just confusing. */}
          {joinCode && isHost ? (
            <Pressable onPress={shareCode} style={{ alignSelf: 'flex-start', marginBottom: 18 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: C.purpleSoft, borderRadius: 999,
                paddingHorizontal: 16, paddingVertical: 9,
              }}>
                <Ionicons name={copied ? 'checkmark' : 'share-outline'} size={15} color={C.purple} />
                <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900', marginStart: 7 }}>
                  {copied ? t('added_check') : t('lamma_share')}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {/* Before anybody starts: what will you be reading? Everyone
              in the room answers the same question at the same moment,
              each in the language they think fastest in. */}
          <View style={{ marginBottom: 18 }}>
            <LangPicker value={playLang} onChange={setPlayLang} label={t('lamma_question_lang')} />
          </View>

          {/* ── AND WHO WILL YOU BE ─────────────────────────────────
              Two ways, and neither is the lesser one. BUILD is a
              pharaoh drawn from parts — no camera, no photograph of
              you in a room full of people, and it works on a phone
              that has refused the camera permission. PHOTO is your own
              face under the headdress.

              Only where the regalia belongs. A nemes headcloth on a
              European football night is fancy dress, and this is not
              that.

              ── AND IN AN EGYPT ROOM IT IS REQUIRED ──────────────
              Ayser asked for it, and it makes the room better: a
              podium of six pharaohs is the picture; a podium of six
              grey initials is a spreadsheet.

              Required, and satisfied EITHER WAY. That distinction is
              the whole design. "You must be a pharaoh" is a costume
              everybody can wear; "you must photograph your face" is
              something else entirely, and it would quietly exclude
              anybody who does not want their picture taken in a room
              full of people — which is most people, some of the time.
              So the drawn one counts, and it is the button on the
              left. */}
          {needsFace && !presenting ? (
            <View style={{
              backgroundColor: C.goldSoft, borderWidth: 1.5, borderColor: C.gold,
              borderRadius: 18, padding: 14, marginBottom: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="crown-outline" size={19} color={C.gold} />
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', marginStart: 9, flex: 1, minWidth: 0 }}>
                  {t('lamma_face_needed')}
                </Text>
              </View>
              <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 18, marginTop: 6 }}>
                {t('lamma_face_needed_sub')}
              </Text>
            </View>
          ) : null}

          {state.pack_country === 'EG' && !presenting ? (
            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              <Pressable onPress={() => { tapLight(); setCharOpen(true); }} style={{ flex: 1, marginEnd: 8 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: C.goldSoft, borderWidth: 1.5, borderColor: C.gold,
                  borderRadius: 999, paddingVertical: 12, paddingHorizontal: 12,
                }}>
                  <Text style={{ fontSize: 16 }}>👑</Text>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900', marginStart: 7, flexShrink: 1 }} numberOfLines={1}>
                    {t('lamma_char_cta')}
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); setCamOpen(true); }} style={{ flex: 1 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                  borderRadius: 999, paddingVertical: 12, paddingHorizontal: 12,
                }}>
                  <Text style={{ fontSize: 16 }}>📸</Text>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900', marginStart: 7, flexShrink: 1 }} numberOfLines={1}>
                    {t('lamma_face_cta')}
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* ── ONE HOST, AND THESE ARE THEIRS ──────────────────────
              How long a question lasts, how long the round is, whether
              the door is open, and whether the host's seat can be
              taken. Every one of them is refused by the server from
              anybody who is not hosting.

              THEY ARE NOT DRAWN FOR ANYBODY ELSE. They used to be —
              greyed out at 45% and dead to the touch — and Ayser sent
              a photograph of what that looks like on somebody else's
              phone: four time buttons and four round buttons that
              simply do not work. A disabled control is still a control
              on the screen; it says "you may do this" and then does
              not. Better to not be there at all.

              What replaces it is one line saying what the host chose,
              because a room where only one person knows the rules is
              worse than one where nobody does. */}
          {!isHost ? (
            <View style={{
              backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
              borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20,
            }}>
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>
                {t('lamma_the_rules')}
              </Text>
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', lineHeight: 20 }}>
                {t('lamma_rules_line')
                  .replace('{secs}', Math.round((state.timer_ms || 20000) / 1000))
                  .replace('{n}', roundIds.length || total || 15)}
              </Text>
              <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '700', marginTop: 5 }}>
                {state.host_locked ? t('lamma_one_host') : t('lamma_host_decides')}
              </Text>
            </View>
          ) : null}

          {isHost ? (
          <>
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>
              {t('lamma_time_per_q')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {TIMERS.map((ms) => {
                const on = (state.timer_ms || 20000) === ms;
                return (
                  <Pressable key={ms} onPress={() => chooseTimer(ms)} disabled={!isHost} style={{ marginEnd: 8, marginBottom: 8 }}>
                    <View style={{
                      backgroundColor: on ? C.purple : C.glass,
                      borderWidth: 1, borderColor: on ? C.purple : C.line,
                      borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8,
                      opacity: isHost || on ? 1 : 0.45,
                    }}>
                      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 13, fontWeight: '900' }}>
                        {Math.round(ms / 1000)}s
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {isHost ? (
              <Pressable onPress={toggleLock} style={{ marginTop: 4 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: state.locked ? C.coralSoft : C.glass,
                  borderWidth: 1, borderColor: state.locked ? C.coral : C.line,
                  borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11,
                }}>
                  <Ionicons name={state.locked ? 'lock-closed' : 'lock-open-outline'} size={16} color={state.locked ? C.coral : C.faint} />
                  <Text style={{ color: state.locked ? C.coral : C.text, fontSize: 13, fontWeight: '800', marginStart: 9, flex: 1, minWidth: 0 }}>
                    {state.locked ? t('lamma_locked') : t('lamma_open_room')}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '700', marginTop: 2 }}>
                {state.locked ? t('lamma_locked') : t('lamma_host_decides')}
              </Text>
            )}

            {/* ── AND WHOSE ROOM IT IS ────────────────────────────
                The door and the seat are two different things. The
                lock above stops new people walking in. This stops the
                room handing itself to somebody else when the host's
                phone goes dark for a minute — which is what happened
                on the shared screen, mid-round. */}
            {isHost ? (
              <Pressable onPress={toggleHostLock} style={{ marginTop: 8 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: state.host_locked ? C.goldSoft : C.glass,
                  borderWidth: 1, borderColor: state.host_locked ? C.gold : C.line,
                  borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11,
                }}>
                  <MaterialCommunityIcons
                    name={state.host_locked ? 'crown' : 'crown-outline'}
                    size={17} color={state.host_locked ? C.gold : C.faint} />
                  <Text style={{ color: state.host_locked ? C.gold : C.text, fontSize: 13, fontWeight: '800', marginStart: 9, flex: 1, minWidth: 0 }}>
                    {state.host_locked ? t('lamma_my_room_on') : t('lamma_my_room_off')}
                  </Text>
                </View>
              </Pressable>
            ) : state.host_locked ? (
              <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '700', marginTop: 8 }}>
                {t('lamma_one_host')}
              </Text>
            ) : null}

            {/* ── READING THEM OUT, OR ANSWERING THEM ──────────────
                Holding the phone that shows the questions and being
                on the leaderboard is not a competition. Off by
                default: somebody playing at a table with four friends
                is the host AND a player, and that is most rooms. */}
            {isHost ? (
              <Pressable onPress={togglePresenting} style={{ marginTop: 8 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: presenting ? C.blueSoft : C.glass,
                  borderWidth: 1, borderColor: presenting ? C.blue : C.line,
                  borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11,
                }}>
                  <MaterialCommunityIcons
                    name={presenting ? 'presentation' : 'account-multiple-outline'}
                    size={17} color={presenting ? C.blue : C.faint} />
                  <View style={{ flex: 1, minWidth: 0, marginStart: 9 }}>
                    <Text style={{ color: presenting ? C.blue : C.text, fontSize: 13, fontWeight: '800' }}>
                      {presenting ? t('lamma_presenting_on') : t('lamma_presenting_off')}
                    </Text>
                    {presenting ? (
                      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700', marginTop: 2 }}>
                        {t('lamma_presenting_note')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ) : null}
          </View>

          {/* ── HOW LONG IS THE ROUND ───────────────────────────────
              A fresh draw each time it changes, so a shorter round is
              also a different one. */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>
              {t('lamma_round_len')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {ROUNDS.map((n) => {
                const on = n === 0 ? roundIds.length > 25 : roundIds.length === n;
                return (
                  <Pressable key={n} onPress={() => chooseRound(n)} disabled={!isHost} style={{ marginEnd: 8, marginBottom: 8 }}>
                    <View style={{
                      backgroundColor: on ? C.purple : C.glass,
                      borderWidth: 1, borderColor: on ? C.purple : C.line,
                      borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8,
                      opacity: isHost || on ? 1 : 0.45,
                    }}>
                      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 13, fontWeight: '900' }}>
                        {n === 0 ? t('lamma_round_all') : n}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          </>
          ) : null}

          <Text style={{ color: C.faint, fontSize: 13, marginBottom: 10 }}>
            {(players || []).length} {t('lamma_players_here')}
          </Text>
          {(players || []).map((p) => (
            <View key={p.user_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
              <Face player={p} size={34} />
              <Text numberOfLines={1} style={{ color: C.text, fontSize: 15, fontWeight: '800', marginStart: 11, flex: 1, minWidth: 0 }}>
                {p.nickname}
              </Text>
              {p.user_id === state.host_user_id ? (
                <Text style={{ color: C.purple, fontSize: 11.5, fontWeight: '900' }}>{t('lamma_host')}</Text>
              ) : isHost ? (
                <Pressable onPress={() => removePlayer(p.user_id)} hitSlop={8}>
                  <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800' }}>{t('lamma_remove')}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {/* ── THE HOST GOES LAST ──────────────────────────────────
              Nobody starts an Egypt room without a pharaoh, and the
              host is nobody's exception — the person running it is the
              one everybody copies. Unless they are not playing: a
              presenter has no seat on the board and no face to put on
              it, so the rule does not apply to them.

              The button says what is missing rather than going grey
              and leaving them to guess, which is the difference
              between a rule and a broken screen.

              It only holds the HOST back. Blocking the start until
              every last person in the room has one would hand any
              player the power to stop the evening by not tapping, and
              in a real room the answer to that is somebody saying
              "yalla, make your pharaoh" out loud — not software
              refusing to begin. */}
          {isHost ? (
            <Pressable
              onPress={() => (needsFace && !presenting ? setCharOpen(true) : next())}
              disabled={busy}
              style={{ marginTop: 20 }}>
              <View style={{
                backgroundColor: needsFace && !presenting ? C.goldSoft : C.purple,
                borderWidth: needsFace && !presenting ? 1.5 : 0, borderColor: C.gold,
                borderRadius: 999, paddingVertical: 15, alignItems: 'center',
              }}>
                <Text style={{ color: needsFace && !presenting ? C.gold : '#FFF', fontSize: 16, fontWeight: '900' }}>
                  {needsFace && !presenting ? t('lamma_face_first') : t('lamma_start_game')}
                </Text>
              </View>
            </Pressable>
          ) : (
            <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', marginTop: 24 }}>{t('lamma_host_starts')}</Text>
          )}
        </ScrollView>
      ) : null}

      {/* ── THE SHARED SCREEN ── */}
      {stageOpen ? (
        <Stage
          visible={stageOpen}
          onClose={() => setStageOpen(false)}
          question={q}
          lang={playLang}
          status={state.status}
          index={state.question_index}
          total={total}
          joinCode={joinCode}
          playerCount={(players || []).length}
          timerMs={state.timer_ms || (q && q.timer_ms)}
          result={result}
          isHost={isHost}
          onShowOptions={revealChoices}
          onNext={next}
          t={t}
        />
      ) : null}

      {/* ── THE QUESTION, BEING READ OUT ────────────────────────────
          No options and no clock: the host is reading it aloud, and
          the seconds that takes belong to nobody's timer. Everybody
          sees the same words at the same moment; the choices, and the
          clock, arrive together when the host says so. */}
      {!ended && !presenting && state.status === 'reading' && q ? (
        <View style={{ flex: 1, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', marginBottom: 10, textAlign: 'center' }}>
            {(state.question_index + 1)} / {total}
          </Text>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', lineHeight: 34, textAlign: 'center' }}>
            {say(q, playLang)}
          </Text>
          <Text style={{ color: C.faint, fontSize: 13.5, fontWeight: '700', textAlign: 'center', marginTop: 18 }}>
            {t('lamma_reading_now')}
          </Text>
          {isHost ? (
            <Pressable onPress={revealChoices} disabled={busy} style={{ marginTop: 26 }}>
              <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('lamma_show_choices')}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── THE PRESENTER'S OWN SCREEN ──────────────────────────────
          Somebody reading the questions out needs the question big and
          the four choices readable across a room — not four buttons to
          tap, because they are not answering. That view already exists
          for the shared screen, so it is the same component here,
          inline rather than in a modal, and it sizes itself off the
          window: portrait on a phone being held up, wide on a laptop
          plugged into a television.

          They still get the reveal and the standings underneath, which
          is what makes them able to say "four of you got that" out
          loud. */}
      {!ended && presenting && state.status !== 'lobby' && q ? (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <StageBody
              question={q}
              lang={playLang}
              status={state.status}
              index={state.question_index}
              total={total}
              joinCode={joinCode}
              playerCount={(players || []).length}
              timerMs={state.timer_ms}
              result={result}
              isHost={isHost}
              onShowOptions={revealChoices}
              onNext={next}
              inline
              t={t}
            />
          </View>
          {result && (players || []).length > 1 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: insets.bottom + 8 }}>
              <Standings players={players} meId={null} questionIndex={state.question_index} t={t} />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── A QUESTION, AND ITS REVEAL ── */}
      {!ended && !presenting && state.status !== 'lobby' && state.status !== 'reading' && q ? (
        <View style={{ flex: 1 }}>
          <QuestionCard
            question={q}
            timerMs={state.timer_ms}
            index={state.question_index}
            total={total}
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
          <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginBottom: 16 }}>{t('lamma_final_rank')}</Text>

          {/* The three on blocks, rising, with the room watching. Only
              when there IS a room: a podium with one person on it is a
              sad picture, and playing alone is a perfectly good way to
              play. */}
          <View onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
            {(players || []).length > 1 ? (
              <Podium players={players} meId={user && user.id} width={barW} t={t} />
            ) : null}
          </View>
          <View style={{ marginBottom: 18 }}>
            <StripLabel>{t('lamma_final')}</StripLabel>
            <Strip mode="leaderboard" width={barW} segments={leaderboardSegments(players)} />
          </View>
          {(players || []).length > 1 ? (
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 10 }}>
              {t('lamma_everyone')}
            </Text>
          ) : null}
          {/* EVERY PLAYER IS ON IT, in order, with their number. Three
              medals and then a thinner list underneath was two
              different screens: the people below third came out looking
              like a footnote to somebody else's win, when they had just
              played the same twenty minutes. Same row, same face, same
              size — the medal is the only difference. */}
          {(players || []).map((p, i) => {
            const top = i < 3;
            const mine = user && p.user_id === user.id;
            return (
              <View key={p.user_id} style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: mine ? C.purpleSoft : C.glass,
                borderWidth: 1, borderColor: mine ? C.purple : C.line,
                borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 9,
              }}>
                <Text style={{ fontSize: top ? 20 : 14, fontWeight: '900', color: C.faint, width: 26 }}>
                  {top ? ['🥇', '🥈', '🥉'][i] : (i + 1)}
                </Text>
                <View style={{ marginStart: 6 }}>
                  <Face player={p} size={36} ring={top ? C.gold : null} />
                </View>
                <Text numberOfLines={1} style={{ color: C.text, fontSize: 15.5, fontWeight: mine ? '900' : '800', marginStart: 10, flex: 1, minWidth: 0 }}>
                  {p.nickname}
                </Text>
                <Text style={{ color: mine ? C.purple : C.text, fontSize: 15.5, fontWeight: '900', marginStart: 8 }}>
                  {p.score}
                </Text>
              </View>
            );
          })}
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
