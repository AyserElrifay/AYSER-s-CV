import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { av, GAME_LOCATIONS, USERS } from '../constants/mockData';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxStar, sfxSuccess } from '../utils/sfx';

/* ─── CATCH YOUR MATE — a lane runner you play with friends ───
   You chase a mate through a chosen city; obstacles rush toward you and
   one hit ends your run. Real-time head-to-head rides on Supabase
   presence later — for now you race your mate's ghost and your own best.
   Playable on device and web (tap the left/right half to switch lane). */

const LANES = 3;
const OBSTACLES = ['🚧', '🛵', '🪨', '🛑', '🚗', '🧺'];
const PLAYER_Y_FROM_BOTTOM = 96;
const HIT_BAND = 46;

export const GameRunner = ({ opponent = USERS.nour, onClose }) => {
  const [loc, setLoc] = useState(GAME_LOCATIONS[0]); // Egypt = home base
  const [phase, setPhase] = useState('ready'); // ready | playing | over
  const [lane, setLane] = useState(1);
  const [obstacles, setObstacles] = useState([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [track, setTrack] = useState({ w: 0, h: 0 });

  const laneRef = useRef(1);
  const loop = useRef(null);
  const spawn = useRef(null);
  const idc = useRef(0);
  const speedRef = useRef(4.2);

  useEffect(() => () => { clearInterval(loop.current); clearInterval(spawn.current); }, []);

  const laneX = (l) => {
    const pad = 22;
    const usable = track.w - pad * 2;
    return pad + usable * (l / (LANES - 1));
  };
  const playerY = track.h - PLAYER_Y_FROM_BOTTOM;

  const start = () => {
    if (track.h === 0) return;
    tapMedium(); sfxPop();
    setObstacles([]); setScore(0); setLane(1); laneRef.current = 1;
    speedRef.current = 4.2;
    setPhase('playing');

    loop.current = setInterval(() => {
      setObstacles((prev) => {
        let dead = false;
        const next = [];
        for (const o of prev) {
          const y = o.y + speedRef.current;
          if (Math.abs(y - playerY) < HIT_BAND && o.lane === laneRef.current) dead = true;
          if (y < track.h + 60) next.push({ ...o, y });
        }
        if (dead) { endRun(); return prev; }
        return next;
      });
      setScore((s) => { speedRef.current = 4.2 + s * 0.02; return s + 1; });
    }, 30);

    spawn.current = setInterval(() => {
      idc.current += 1;
      const l = Math.floor(Math.random() * LANES);
      setObstacles((prev) => [...prev, { id: 'o' + idc.current, lane: l, y: -50, e: OBSTACLES[idc.current % OBSTACLES.length] }]);
    }, 720);
  };

  const endRun = () => {
    clearInterval(loop.current); clearInterval(spawn.current);
    tapSuccess(); sfxStar();
    setPhase('over');
    setScore((s) => { setBest((b) => Math.max(b, s)); return s; });
  };

  const move = (dir) => {
    if (phase !== 'playing') return;
    setLane((l) => {
      const n = Math.max(0, Math.min(LANES - 1, l + dir));
      laneRef.current = n;
      if (n !== l) { tapLight(); }
      return n;
    });
  };

  const caughtMate = score >= 260; // playful win condition

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={[loc.colors[0], loc.colors[1], '#0B1020']} style={{ flex: 1 }}>
        {/* top bar */}
        <View style={{ paddingTop: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>CATCH YOUR MATE 🏃</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>{loc.flag} {loc.city}, {loc.country}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>SCORE</Text>
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>{score}</Text>
          </View>
        </View>

        {/* the track */}
        <View
          style={{ flex: 1, marginTop: 14, marginHorizontal: 12, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}
          onLayout={(e) => setTrack({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {/* lane guides */}
          {[0, 1, 2].map((l) => (
            <View key={l} style={{ position: 'absolute', top: 0, bottom: 0, left: laneX(l) - 1, width: 2, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          ))}

          {/* the mate you're chasing (flavor, runs ahead near the top) */}
          {track.h > 0 ? (
            <View style={{ position: 'absolute', top: 40, left: laneX(1) - 18, alignItems: 'center' }}>
              <Image source={{ uri: opponent.avatar }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#FFF', opacity: 0.9 }} />
              <Text style={{ fontSize: 18, marginTop: -4 }}>💨</Text>
            </View>
          ) : null}

          {/* obstacles */}
          {obstacles.map((o) => (
            <Text key={o.id} style={{ position: 'absolute', left: laneX(o.lane) - 17, top: o.y, fontSize: 32 }}>{o.e}</Text>
          ))}

          {/* the player */}
          {track.h > 0 && phase !== 'ready' ? (
            <View style={{ position: 'absolute', left: laneX(lane) - 20, top: playerY - 6 }}>
              <Text style={{ fontSize: 40 }}>🏃</Text>
            </View>
          ) : null}

          {/* tap zones while playing */}
          {phase === 'playing' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
              <Pressable style={{ flex: 1 }} onPress={() => move(-1)} />
              <Pressable style={{ flex: 1 }} onPress={() => move(1)} />
            </View>
          ) : null}

          {/* READY overlay: location picker + opponent + start */}
          {phase === 'ready' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Image source={{ uri: opponent.avatar }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' }} />
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', marginLeft: 10 }}>Racing {opponent.name.split(' ')[0]}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', marginBottom: 18, lineHeight: 19 }}>
                Tap the left or right half of the screen to dodge.{'\n'}One hit and your run is over.
              </Text>

              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>PICK YOUR CITY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 74, flexGrow: 0 }}>
                {GAME_LOCATIONS.map((g) => {
                  const on = g.id === loc.id;
                  return (
                    <Pressable key={g.id} onPress={() => { tapLight(); setLoc(g); }} style={{ alignItems: 'center', marginHorizontal: 6 }}>
                      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: on ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', borderWidth: on ? 2 : 1, borderColor: on ? '#FFF' : 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 24 }}>{g.landmark}</Text>
                      </View>
                      <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: on ? '900' : '600', marginTop: 4 }}>{g.flag} {g.city}</Text>
                      {g.home ? <Text style={{ color: C.gold, fontSize: 8, fontWeight: '900' }}>HOME</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable onPress={start} style={{ marginTop: 20 }}>
                <View style={{ backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 40, paddingVertical: 15, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: loc.colors[1], fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>START RUN</Text>
                  <Ionicons name="play" size={16} color={loc.colors[1]} style={{ marginLeft: 6 }} />
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* GAME OVER overlay */}
          {phase === 'over' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 26 }}>
              <Text style={{ fontSize: 48 }}>{caughtMate ? '🏆' : '💥'}</Text>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 6 }}>
                {caughtMate ? 'You caught ' + opponent.name.split(' ')[0] + '!' : 'Wiped out!'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 }}>Score {score} · Best {Math.max(best, score)}</Text>
              <Pressable onPress={start} style={{ marginTop: 22 }}>
                <View style={{ backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 36, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="refresh" size={16} color={loc.colors[1]} style={{ marginRight: 6 }} />
                  <Text style={{ color: loc.colors[1], fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>REMATCH</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); setPhase('ready'); }} style={{ marginTop: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' }}>Change city / mate</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* footer controls (also tappable) */}
        {phase === 'playing' ? (
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 30 }}>
            <Pressable onPress={() => move(-1)} style={{ flex: 1, marginRight: 8 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 18, paddingVertical: 16, alignItems: 'center' }}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </View>
            </Pressable>
            <Pressable onPress={() => move(1)} style={{ flex: 1, marginLeft: 8 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 18, paddingVertical: 16, alignItems: 'center' }}>
                <Ionicons name="arrow-forward" size={24} color="#FFF" />
              </View>
            </Pressable>
          </View>
        ) : null}
      </LinearGradient>
    </Modal>
  );
};
