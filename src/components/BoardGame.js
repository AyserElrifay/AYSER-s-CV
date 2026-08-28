import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { fetchMatch, openBoard, pushMove, subscribeBoard, subscribeMatchLive } from '../services/games';
import { newBoard, applyMove, handFor, gameById, BOARD_META, raceRingIndex } from '../services/boardGames';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

/* ── TWO PEOPLE, ONE BOARD ───────────────────────────────────────────
   The board you're both looking at is one row in the database. Your
   move writes it; their phone hears the write and redraws. That's the
   whole design, and it's why you can close the app mid-game, come back
   tomorrow, and the pieces are exactly where you left them.

   The rules live in services/boardGames.js as pure functions, so both
   phones compute the same board from the same move — this file only
   draws it and takes taps. */

const SEAT_COLORS = ['#7C3AED', '#F5B301'];

/* Where square `i` of the 40-square lap sits on an 11×11 grid. Walking
   the perimeter clockwise: across the top, down the right, back along
   the bottom, up the left. 11 + 9 + 11 + 9 = 40. */
function ringCell(i) {
  const n = ((i % 40) + 40) % 40;
  if (n <= 10) return { r: 0, c: n };
  if (n <= 19) return { r: n - 10, c: 10 };
  if (n <= 30) return { r: 10, c: 30 - n };
  return { r: 40 - n, c: 0 };
}

const Pill = ({ children, tone, on }) => (
  <View style={{
    backgroundColor: on ? tone : 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: on ? tone : 'rgba(255,255,255,0.20)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  }}>
    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{children}</Text>
  </View>
);

export const BoardGame = ({ matchId, kind, isHost, opponent, onClose, onRematch }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const game = gameById(kind);

  const [row, setRow] = useState(null);
  const [state, setState] = useState(null);
  const [turnId, setTurnId] = useState(null);
  const [moveNo, setMoveNo] = useState(0);
  const [done, setDone] = useState(null);      // { winnerSeat }
  const [pickedStep, setPickedStep] = useState(null);
  const [err, setErr] = useState(null);

  const mySeat = isHost ? 1 : 2;
  const myTurn = !!user && turnId === user.id && !done;
  const seenMove = useRef(-1);

  /* Take a row from anywhere — first load, a database change, a
     broadcast — and only move forward. A message that arrives late
     carries an older move number and is simply ignored, which is what
     stops a slow packet from rewinding the board. */
  const absorb = useCallback((r) => {
    if (!r) return;
    const n = r.move_no || 0;
    if (n < seenMove.current) return;
    seenMove.current = n;
    setRow((old) => ({ ...(old || {}), ...r }));
    if (r.state) setState(r.state);
    if (r.turn !== undefined) setTurnId(r.turn);
    setMoveNo(n);
    if (r.status === 'done') {
      setDone({ winnerSeat: r.winner_id ? (r.winner_id === (r.host_id) ? 1 : 2) : 0 });
    }
  }, []);

  /* First load. The host is the one who lays the board out — if both
     sides did it they'd race and one would clobber the other. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await fetchMatch(matchId);
        if (!alive) return;
        if (!m.state && isHost) {
          const fresh = newBoard(kind, matchId);
          const opened = await openBoard(matchId, fresh, m.host_id);
          absorb(opened);
        } else {
          absorb(m);
        }
      } catch (e) {
        if (alive) setErr('Could not open the board — check your signal and try again.');
      }
    })();
    return () => { alive = false; };
  }, [matchId, kind, isHost, absorb]);

  /* Both wires at once: the row change is the one that always arrives,
     the broadcast is the one that arrives instantly. */
  useEffect(() => {
    const sub = subscribeBoard(matchId, absorb);
    const live = subscribeMatchLive(matchId, {
      score: (p) => { if (p && p.board) absorb({ state: p.board, turn: p.turn, move_no: p.moveNo, status: p.over ? 'done' : 'active', winner_id: p.winnerId, host_id: p.hostId }); },
    });
    return () => { sub.leave(); live.leave(); };
  }, [matchId, absorb]);

  const hand = handFor(kind, state);

  const play = async (move) => {
    if (!myTurn || !state) return;
    const out = applyMove(kind, state, mySeat, move);
    if (!out) { tapLight(); return; }              // not a legal move — say nothing, do nothing

    const nextTurn = out.over ? null : (out.nextSeat === mySeat ? user.id : (opponent && opponent.id));
    const winnerId = out.winner ? (out.winner === mySeat ? user.id : (opponent && opponent.id)) : null;
    const n = moveNo + 1;

    // show it immediately on this phone; the wire catches everyone up
    seenMove.current = n;
    setState(out.state);
    setMoveNo(n);
    setTurnId(nextTurn);
    setPickedStep(null);
    if (out.over) { setDone({ winnerSeat: out.winner }); tapSuccess(); sfxSuccess(); }
    else { tapMedium(); sfxPop(); }

    try {
      await pushMove(matchId, { state: out.state, turnId: nextTurn, moveNo: n, over: out.over, winnerId });
    } catch (e) {
      setErr('That move didn\'t reach them — it will retry when you\'re back on signal.');
    }
  };

  /* ── the four boards ─────────────────────────────────────────────── */

  const renderXO = () => (
    <View style={{ width: '86%', aspectRatio: 1, flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center' }}>
      {(state.cells || []).map((v, i) => {
        const won = state.line && state.line.indexOf(i) >= 0;
        return (
          <Pressable key={i} onPress={() => play({ cell: i })} disabled={!myTurn || !!v} style={{ width: '33.33%', aspectRatio: 1, padding: 5 }}>
            <View style={{
              flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
              backgroundColor: won ? 'rgba(245,179,1,0.28)' : 'rgba(255,255,255,0.08)',
              borderWidth: won ? 2 : 1, borderColor: won ? C.gold : 'rgba(255,255,255,0.16)',
            }}>
              <Text style={{ fontSize: 46, fontWeight: '900', color: v === 1 ? SEAT_COLORS[0] : SEAT_COLORS[1] }}>
                {v === 1 ? '✕' : v === 2 ? '◯' : ''}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const renderFour = () => {
    const { cols, rows } = BOARD_META.four;
    return (
      <View style={{ width: '94%', alignSelf: 'center', backgroundColor: 'rgba(37,99,235,0.22)', borderRadius: 18, padding: 5 }}>
        <View style={{ flexDirection: 'row' }}>
          {Array.from({ length: cols }, (_, col) => (
            <Pressable key={col} onPress={() => play({ col })} disabled={!myTurn} style={{ flex: 1 }}>
              {Array.from({ length: rows }, (_, r) => {
                const i = r * cols + col;
                const v = state.cells[i];
                const won = state.line && state.line.indexOf(i) >= 0;
                return (
                  <View key={r} style={{ aspectRatio: 1, padding: 3 }}>
                    <View style={{
                      flex: 1, borderRadius: 999,
                      backgroundColor: v ? SEAT_COLORS[v - 1] : 'rgba(6,10,26,0.55)',
                      borderWidth: won ? 2.5 : 0, borderColor: '#FFF',
                    }} />
                  </View>
                );
              })}
              {myTurn ? (
                <View style={{ alignItems: 'center', paddingVertical: 3 }}>
                  <Ionicons name="caret-down" size={14} color="rgba(255,255,255,0.6)" />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  const renderSnakes = () => {
    const { goal, snakes, ladders } = BOARD_META.snakes;
    // 10 rows of 10, counted the way the board is actually walked:
    // left to right, then right to left on the row above.
    const rows = [];
    for (let r = 9; r >= 0; r--) {
      const line = [];
      for (let k = 0; k < 10; k++) {
        const c = r % 2 === 0 ? k : 9 - k;
        line.push(r * 10 + c + 1);
      }
      rows.push(line);
    }
    return (
      <View style={{ width: '94%', alignSelf: 'center' }}>
        {rows.map((line, ri) => (
          <View key={ri} style={{ flexDirection: 'row' }}>
            {line.map((sq) => {
              const here = [0, 1].filter((s) => state.pos[s] === sq);
              const lad = ladders[sq];
              const snk = snakes[sq];
              return (
                <View key={sq} style={{
                  flex: 1, aspectRatio: 1, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
                  backgroundColor: sq === goal ? 'rgba(245,179,1,0.30)' : lad ? 'rgba(16,185,129,0.20)' : snk ? 'rgba(225,29,72,0.20)' : 'rgba(255,255,255,0.04)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 7, position: 'absolute', top: 1, left: 2 }}>{sq}</Text>
                  {lad ? <Text style={{ fontSize: 10 }}>🪜</Text> : snk ? <Text style={{ fontSize: 10 }}>🐍</Text> : null}
                  <View style={{ flexDirection: 'row', position: 'absolute', bottom: 1 }}>
                    {here.map((s) => (
                      <View key={s} style={{ width: 9, height: 9, borderRadius: 5, marginHorizontal: 0.5, backgroundColor: SEAT_COLORS[s], borderWidth: 1, borderColor: '#FFF' }} />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        {state.last && state.last.via ? (
          <Text style={{ color: state.last.via.kind === 'ladder' ? C.green : C.coral, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 8 }}>
            {state.last.via.kind === 'ladder' ? '🪜 Up the ladder to ' : '🐍 Down the snake to '}{state.last.via.to}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderRace = () => {
    const cells = [];
    for (let i = 0; i < 40; i++) cells.push({ i, ...ringCell(i) });
    const occupants = (ringIdx) => {
      const out = [];
      [1, 2].forEach((seat) => {
        state.pieces[seat - 1].forEach((p, idx) => {
          if (p >= 0 && p < BOARD_META.race.track && raceRingIndex(seat, p) === ringIdx) out.push({ seat, idx });
        });
      });
      return out;
    };

    return (
      <View style={{ width: '94%', alignSelf: 'center' }}>
        {Array.from({ length: 11 }, (_, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {Array.from({ length: 11 }, (_, c) => {
              const cell = cells.find((x) => x.r === r && x.c === c);
              if (!cell) {
                // the middle of the board: each side's home row
                const isHome1 = r === 4 && c >= 4 && c <= 7;
                const isHome2 = r === 6 && c >= 4 && c <= 7;
                if (isHome1 || isHome2) {
                  const seat = isHome1 ? 1 : 2;
                  const slot = c - 4;
                  const filled = state.pieces[seat - 1].filter((p) => p >= BOARD_META.race.home).length > slot;
                  return (
                    <View key={c} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{
                        width: '72%', height: '72%', borderRadius: 999,
                        backgroundColor: filled ? SEAT_COLORS[seat - 1] : 'transparent',
                        borderWidth: 1.5, borderColor: SEAT_COLORS[seat - 1],
                      }} />
                    </View>
                  );
                }
                if (r === 5 && c === 5) {
                  return <View key={c} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18 }}>🏠</Text></View>;
                }
                return <View key={c} style={{ flex: 1, aspectRatio: 1 }} />;
              }
              const isStart = cell.i === 0 || cell.i === 20;
              const who = occupants(cell.i);
              return (
                <View key={c} style={{
                  flex: 1, aspectRatio: 1, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)',
                  backgroundColor: isStart ? (cell.i === 0 ? 'rgba(124,58,237,0.30)' : 'rgba(245,179,1,0.30)') : 'rgba(255,255,255,0.05)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {who.slice(0, 2).map((o, k) => (
                    <View key={k} style={{
                      position: 'absolute', left: 2 + k * 7, bottom: 3,
                      width: 10, height: 10, borderRadius: 5,
                      backgroundColor: SEAT_COLORS[o.seat - 1], borderWidth: 1, borderColor: '#FFF',
                    }} />
                  ))}
                </View>
              );
            })}
          </View>
        ))}

        {/* your pieces still waiting to come out */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: '800', marginRight: 8 }}>Your pieces</Text>
          {state.pieces[mySeat - 1].map((p, idx) => {
            const out = p >= 0;
            const home = p >= BOARD_META.race.home;
            const armed = myTurn && pickedStep !== null;
            return (
              <Pressable key={idx} disabled={!armed || home} onPress={() => play({ pick: pickedStep, piece: idx })} style={{ marginHorizontal: 4 }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: home ? C.green : out ? SEAT_COLORS[mySeat - 1] : 'rgba(255,255,255,0.12)',
                  borderWidth: armed && !home ? 2 : 1, borderColor: armed && !home ? '#FFF' : 'rgba(255,255,255,0.3)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>{home ? '✓' : out ? p + 1 : '·'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {myTurn ? (
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
            {pickedStep === null ? 'Pick a number, then pick the piece to move it.' : 'Now tap the piece that takes it.'}
          </Text>
        ) : null}
      </View>
    );
  };

  /* ── the hand of steps, for the two games that use one ───────────── */
  const renderHand = () => {
    if (!hand.length) return null;
    return (
      <View style={{ alignItems: 'center', marginTop: 14 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10.5, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>
          YOUR STEPS — NO DICE, YOU CHOOSE
        </Text>
        <View style={{ flexDirection: 'row' }}>
          {hand.map((v, i) => {
            const on = pickedStep === i;
            return (
              <Pressable
                key={i}
                disabled={!myTurn}
                onPress={() => {
                  tapLight();
                  if (kind === 'snakes') play({ pick: i });
                  else setPickedStep(on ? null : i);
                }}
                style={{ marginHorizontal: 7 }}
              >
                <View style={{
                  width: 58, height: 58, borderRadius: 18,
                  backgroundColor: on ? C.gold : myTurn ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
                  borderWidth: 2, borderColor: on ? '#FFF' : 'rgba(255,255,255,0.22)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: on ? '#3A2A00' : '#FFF', fontSize: 24, fontWeight: '900' }}>{v}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const oppName = (opponent && opponent.name) || 'Your mate';
  const iWon = done && done.winnerSeat === mySeat;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={['#150F2E', '#0C0A1E', '#07060F']} style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="chevron-down" size={26} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900', letterSpacing: 1 }}>
              {(game && game.title) || 'Game'} {(game && game.emoji) || ''}
            </Text>
          </View>
          <View style={{ width: 26 }} />
        </View>

        {/* who's who, and whose turn it is */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingHorizontal: 16 }}>
          <View style={{ alignItems: 'center', opacity: myTurn ? 1 : 0.45 }}>
            <Image source={{ uri: buildAvatarUrl(user && user.id, (user && user.avatar_dna) || null) }} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2.5, borderColor: SEAT_COLORS[mySeat - 1] }} />
            <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', marginTop: 4 }}>You</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '900', marginHorizontal: 18 }}>vs</Text>
          <View style={{ alignItems: 'center', opacity: !myTurn && !done ? 1 : 0.45 }}>
            <Image source={{ uri: (opponent && opponent.avatar) || buildAvatarUrl(opponent && opponent.id, null) }} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2.5, borderColor: SEAT_COLORS[2 - mySeat] }} />
            <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', marginTop: 4 }} numberOfLines={1}>{oppName.split(' ')[0]}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
          {done ? (
            <Pill tone={iWon ? C.green : done.winnerSeat === 0 ? C.dim : C.coral} on>
              {done.winnerSeat === 0 ? 'A draw 🤝' : iWon ? 'You won 🎉' : oppName.split(' ')[0] + ' won'}
            </Pill>
          ) : (
            <Pill tone={C.purple} on={myTurn}>
              {myTurn ? 'Your turn' : 'Waiting for ' + oppName.split(' ')[0] + '…'}
            </Pill>
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30, paddingTop: 6 }}>
          {!state ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator color={C.purple} />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 12 }}>Setting the board…</Text>
            </View>
          ) : kind === 'xo' ? renderXO()
            : kind === 'four' ? renderFour()
              : kind === 'snakes' ? renderSnakes()
                : kind === 'race' ? renderRace()
                  : null}

          {state && !done ? renderHand() : null}

          {err ? (
            <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginTop: 14, paddingHorizontal: 30, lineHeight: 18 }}>{err}</Text>
          ) : null}

          {done ? (
            <View style={{ alignItems: 'center', marginTop: 22 }}>
              {onRematch ? (
                <Pressable onPress={() => { tapLight(); onRematch(kind); }}>
                  <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13 }}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>Play again ↻</Text>
                  </View>
                </Pressable>
              ) : null}
              <Pressable onPress={onClose} style={{ marginTop: 12 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '800' }}>Back to the chat</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={{ color: 'rgba(255,255,255,0.32)', fontSize: 10.5, textAlign: 'center', marginTop: 24, paddingHorizontal: 34, lineHeight: 16 }}>
            The board is saved as you play — close this and come back whenever, the pieces
            stay exactly where they are.
          </Text>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
};
