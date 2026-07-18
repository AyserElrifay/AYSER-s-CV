import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

/* ── GAMES INSIDE A CALL — really multiplayer ──
   Both sides are already on the call's realtime channel, so every move
   is a genuine broadcast to the other person: XO (tic-tac-toe), a
   tap-sprint race, and air hockey (host simulates the puck, guest's
   paddle streams back). No bots, no fake opponent.

   Wire-up: `send(payload)` broadcasts a game event; the parent routes
   incoming game events into `eventRef.current`. */

const FIELD_W = 260;
const FIELD_H = 340;
const PADDLE_W = 64;
const PUCK = 18;

export const CallGames = ({ role, send, eventRef, onClose }) => {
  const isHost = role === 'host';
  const [game, setGame] = useState(null); // null | 'xo' | 'race' | 'hockey'

  /* ─── XO ─── */
  const myMark = isHost ? 'X' : 'O';
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState('X');
  const xoWin = (b) => {
    const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,x,y] of L) if (b[a] && b[a] === b[x] && b[a] === b[y]) return b[a];
    return b.every(Boolean) ? 'draw' : null;
  };
  const xoResult = xoWin(board);
  const xoPlay = (i) => {
    if (board[i] || xoResult || turn !== myMark) return;
    tapLight();
    const b = board.slice(); b[i] = myMark;
    setBoard(b); setTurn(myMark === 'X' ? 'O' : 'X');
    send({ g: 'xo', i, mark: myMark });
  };
  const xoReset = () => { setBoard(Array(9).fill(null)); setTurn('X'); send({ g: 'xo', reset: true }); };

  /* ─── TAP RACE — 8-second sprint, live scores both ways ─── */
  const [raceEnd, setRaceEnd] = useState(null);   // timestamp when the sprint ends
  const [raceLeft, setRaceLeft] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [peerScore, setPeerScore] = useState(0);
  const raceTimer = useRef(null);
  const startRace = (broadcast) => {
    tapMedium();
    const end = Date.now() + 8000;
    setRaceEnd(end); setMyScore(0); setPeerScore(0);
    if (broadcast !== false) send({ g: 'race', start: true });
    clearInterval(raceTimer.current);
    raceTimer.current = setInterval(() => {
      const left = Math.max(0, end - Date.now());
      setRaceLeft(left);
      if (left <= 0) clearInterval(raceTimer.current);
    }, 100);
  };
  const raceTap = () => {
    if (!raceEnd || Date.now() > raceEnd) return;
    tapLight();
    setMyScore((s) => { const n = s + 1; send({ g: 'race', score: n }); return n; });
  };
  const raceOver = raceEnd && Date.now() > raceEnd;

  /* ─── AIR HOCKEY — host-authoritative puck, both paddles real ───
     Canonical coords: host defends the BOTTOM, guest the TOP. The guest
     renders the field flipped so their own paddle is at the bottom. */
  const [hs, setHs] = useState({ puck: [FIELD_W / 2, FIELD_H / 2], me: FIELD_W / 2, peer: FIELD_W / 2, score: [0, 0] });
  const sim = useRef({ px: FIELD_W / 2, py: FIELD_H / 2, vx: 2.2, vy: 3.1, hostX: FIELD_W / 2, guestX: FIELD_W / 2, score: [0, 0] });
  const rafRef = useRef(null);
  const lastTx = useRef(0);
  useEffect(() => {
    if (game !== 'hockey') { cancelAnimationFrame(rafRef.current); return; }
    if (!isHost) return; // guest just renders host state + streams paddle
    const step = () => {
      const s = sim.current;
      s.px += s.vx; s.py += s.vy;
      if (s.px < PUCK / 2 || s.px > FIELD_W - PUCK / 2) { s.vx = -s.vx; s.px = Math.max(PUCK / 2, Math.min(FIELD_W - PUCK / 2, s.px)); }
      // paddle bands: host y≈FIELD_H-24, guest y≈24
      const hit = (padX) => Math.abs(s.px - padX) < PADDLE_W / 2 + PUCK / 2;
      if (s.py > FIELD_H - 30 && s.vy > 0 && hit(s.hostX)) { s.vy = -Math.abs(s.vy) * 1.03; s.vx += (s.px - s.hostX) * 0.09; }
      if (s.py < 30 && s.vy < 0 && hit(s.guestX)) { s.vy = Math.abs(s.vy) * 1.03; s.vx += (s.px - s.guestX) * 0.09; }
      s.vx = Math.max(-6, Math.min(6, s.vx)); s.vy = Math.max(-7, Math.min(7, s.vy));
      let scored = false;
      if (s.py > FIELD_H + PUCK) { s.score = [s.score[0], s.score[1] + 1]; scored = true; } // past host → guest scores
      if (s.py < -PUCK) { s.score = [s.score[0] + 1, s.score[1]]; scored = true; }          // past guest → host scores
      if (scored) { s.px = FIELD_W / 2; s.py = FIELD_H / 2; s.vx = (Math.random() - 0.5) * 4; s.vy = (Math.random() > 0.5 ? 1 : -1) * 3; tapSuccess(); }
      setHs({ puck: [s.px, s.py], me: s.hostX, peer: s.guestX, score: s.score });
      const now = Date.now();
      if (now - lastTx.current > 90) { // ~11 msgs/s — inside Realtime's comfort zone
        lastTx.current = now;
        send({ g: 'ah', puck: [Math.round(s.px), Math.round(s.py)], hostX: Math.round(s.hostX), score: s.score });
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [game, isHost, send]);

  const guestTx = useRef(0);
  const movePaddle = (x) => {
    const clamped = Math.max(PADDLE_W / 2, Math.min(FIELD_W - PADDLE_W / 2, x));
    if (isHost) sim.current.hostX = clamped;
    else {
      setHs((h) => ({ ...h, me: clamped }));
      const now = Date.now();
      if (now - guestTx.current > 90) { guestTx.current = now; send({ g: 'ah', guestX: Math.round(clamped) }); }
    }
  };

  /* ─── incoming events from the other side ─── */
  const handleEvent = useCallback((p) => {
    if (!p || !p.g) return;
    if (p.g === 'open') { setGame(p.game); if (p.game === 'race') setRaceEnd(null); return; }
    if (p.g === 'xo') {
      if (p.reset) { setBoard(Array(9).fill(null)); setTurn('X'); return; }
      setBoard((b) => { const n = b.slice(); n[p.i] = p.mark; return n; });
      setTurn(p.mark === 'X' ? 'O' : 'X');
      return;
    }
    if (p.g === 'race') {
      if (p.start) startRace(false);
      if (typeof p.score === 'number') setPeerScore(p.score);
      return;
    }
    if (p.g === 'ah') {
      if (isHost) { if (typeof p.guestX === 'number') sim.current.guestX = p.guestX; }
      else if (p.puck) {
        setHs((h) => ({ puck: p.puck, me: h.me, peer: typeof p.hostX === 'number' ? p.hostX : h.peer, score: p.score || h.score }));
      }
    }
  }, [isHost]);
  useEffect(() => { eventRef.current = handleEvent; return () => { eventRef.current = null; }; }, [handleEvent, eventRef]);
  useEffect(() => () => clearInterval(raceTimer.current), []);

  const pick = (g) => { tapLight(); setGame(g); send({ g: 'open', game: g }); if (g === 'race') setRaceEnd(null); };

  /* guest sees the field flipped so their own goal is at the bottom */
  const flipY = (y) => (isHost ? y : FIELD_H - y);
  const myScoreAH = isHost ? hs.score[0] : hs.score[1];
  const peerScoreAH = isHost ? hs.score[1] : hs.score[0];

  return (
    <View style={{ position: 'absolute', left: 12, right: 12, top: 90, bottom: 130, borderRadius: 22, backgroundColor: 'rgba(10,6,20,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        {game ? (
          <Pressable onPress={() => { tapLight(); setGame(null); }} hitSlop={8}><Ionicons name="chevron-back" size={22} color="#FFF" /></Pressable>
        ) : null}
        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', flex: 1, marginLeft: game ? 6 : 2 }}>
          {game === 'xo' ? 'XO ✖️⭕' : game === 'race' ? 'Tap Race 🏁' : game === 'hockey' ? 'Air Hockey 🏒' : 'Games 🎮'}
        </Text>
        <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" /></Pressable>
      </View>

      {!game ? (
        <View>
          {[
            { k: 'xo', e: '✖️⭕', t: 'XO', s: 'Tic-tac-toe — you are ' + myMark },
            { k: 'race', e: '🏁', t: 'Tap Race', s: '8-second finger sprint, live vs them' },
            { k: 'hockey', e: '🏒', t: 'Air Hockey', s: 'Slide your paddle, defend your goal' },
          ].map((g) => (
            <Pressable key={g.k} onPress={() => pick(g.k)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 16, padding: 14, marginBottom: 10 }}>
                <Text style={{ fontSize: 26 }}>{g.e}</Text>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{g.t}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 2 }}>{g.s}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
              </View>
            </Pressable>
          ))}
        </View>
      ) : game === 'xo' ? (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: xoResult ? C.gold : 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '800', marginBottom: 12 }}>
            {xoResult === 'draw' ? 'Draw 🤝' : xoResult ? (xoResult === myMark ? 'You win! 🎉' : 'They win 😅') : turn === myMark ? 'Your turn (' + myMark + ')' : 'Their turn…'}
          </Text>
          <View style={{ width: 234, flexDirection: 'row', flexWrap: 'wrap' }}>
            {board.map((cell, i) => (
              <Pressable key={i} onPress={() => xoPlay(i)}>
                <View style={{ width: 74, height: 74, margin: 2, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 34, fontWeight: '900', color: cell === 'X' ? C.gold : '#7EE0D2' }}>{cell || ''}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          {xoResult ? (
            <Pressable onPress={xoReset} style={{ marginTop: 14 }}>
              <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 }}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>Play again 🔁</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : game === 'race' ? (
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            <View style={{ alignItems: 'center', marginHorizontal: 18 }}>
              <Text style={{ color: C.gold, fontSize: 34, fontWeight: '900' }}>{myScore}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>You</Text>
            </View>
            <View style={{ alignItems: 'center', marginHorizontal: 18 }}>
              <Text style={{ color: '#7EE0D2', fontSize: 34, fontWeight: '900' }}>{peerScore}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Them</Text>
            </View>
          </View>
          {!raceEnd ? (
            <Pressable onPress={() => startRace(true)}>
              <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13 }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>Start the sprint 🏁</Text>
              </View>
            </Pressable>
          ) : raceOver ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: C.gold, fontSize: 17, fontWeight: '900' }}>
                {myScore > peerScore ? 'You win! 🏆' : myScore < peerScore ? 'They win 🏆' : 'Dead heat 🤝'}
              </Text>
              <Pressable onPress={() => startRace(true)} style={{ marginTop: 12 }}>
                <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 }}>
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>Rematch 🔁</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={raceTap}>
              <View style={{ width: 150, height: 150, borderRadius: 75, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#FFF' }}>
                <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '900' }}>TAP!</Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '800', marginTop: 2 }}>{(raceLeft / 1000).toFixed(1)}s</Text>
              </View>
            </Pressable>
          )}
        </View>
      ) : (
        /* air hockey */
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, fontWeight: '800', marginBottom: 8 }}>
            You <Text style={{ color: C.gold, fontWeight: '900' }}>{myScoreAH}</Text> — <Text style={{ color: '#7EE0D2', fontWeight: '900' }}>{peerScoreAH}</Text> Them
          </Text>
          <View
            style={{ width: FIELD_W, height: FIELD_H, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => movePaddle(e.nativeEvent.locationX)}
            onResponderMove={(e) => movePaddle(e.nativeEvent.locationX)}
          >
            <View style={{ position: 'absolute', top: FIELD_H / 2 - 1, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            {/* puck */}
            <View style={{ position: 'absolute', left: hs.puck[0] - PUCK / 2, top: flipY(hs.puck[1]) - PUCK / 2, width: PUCK, height: PUCK, borderRadius: PUCK / 2, backgroundColor: C.gold, shadowColor: C.gold, shadowOpacity: 0.8, shadowRadius: 8 }} />
            {/* my paddle (always drawn at the bottom of MY view) */}
            <View style={{ position: 'absolute', left: hs.me - PADDLE_W / 2, bottom: 10, width: PADDLE_W, height: 13, borderRadius: 8, backgroundColor: C.coral }} />
            {/* their paddle */}
            <View style={{ position: 'absolute', left: hs.peer - PADDLE_W / 2, top: 10, width: PADDLE_W, height: 13, borderRadius: 8, backgroundColor: '#7EE0D2' }} />
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10.5, marginTop: 8 }}>Slide anywhere on the field to move your paddle</Text>
        </View>
      )}
    </View>
  );
};
