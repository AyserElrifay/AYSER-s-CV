import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, Platform, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { submitScore } from '../services/games';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

/* ─── ROCK PAPER SCISSORS ──────────────────────────────────────────
   A quick hand, on your own. The other hand is picked BEFORE you tap
   — it is decided the moment the round opens and only revealed after
   you choose — so it cannot read you and cannot cheat. It says so on
   the screen, because a game that claims to be fair should be
   checkable rather than trusted.

   Your run of wins is your score, and it goes to the same real global
   leaderboard the other games use. To play a person instead of the
   app, start a call with a mate — the same game is in there. */

const HANDS = [
  { k: 'rock', e: '✊', label: 'Rock' },
  { k: 'paper', e: '✋', label: 'Paper' },
  { k: 'scissors', e: '✌️', label: 'Scissors' },
];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const BEST_KEY = 'mm_rps_best';

const loadBest = () => {
  try { return parseInt((Platform.OS === 'web' && window.localStorage.getItem(BEST_KEY)) || '0', 10) || 0; }
  catch (e) { return 0; }
};
const saveBest = (n) => {
  try { if (Platform.OS === 'web') window.localStorage.setItem(BEST_KEY, String(n)); } catch (e) {}
};

export const RockPaperScissors = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // the other hand for THIS round, decided now — before you have picked
  const theirs = useRef(HANDS[Math.floor(Math.random() * 3)].k);
  const [mine, setMine] = useState(null);
  const [shown, setShown] = useState(null);      // their hand, once it's fair to show it
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [draws, setDraws] = useState(0);
  const [note, setNote] = useState(null);

  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  const outcome = mine && shown
    ? (mine === shown ? 'draw' : BEATS[mine] === shown ? 'win' : 'lose')
    : null;

  const play = (k) => {
    if (mine) return;
    tapMedium(); sfxPop();
    const their = theirs.current;
    setMine(k);
    setShown(their);

    const res = k === their ? 'draw' : BEATS[k] === their ? 'win' : 'lose';
    if (res === 'win') {
      tapSuccess(); sfxSuccess();
      setWins((n) => n + 1);
      setStreak((s) => {
        const next = s + 1;
        if (next > best) { setBest(next); saveBest(next); }
        return next;
      });
      setNote('You take it 🎉');
    } else if (res === 'lose') {
      setLosses((n) => n + 1);
      setStreak((s) => {
        // a run that ends is a run worth recording
        if (s > 0 && user) submitScore(user.id, 'rps', s);
        return 0;
      });
      setNote('Theirs 😅');
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]).start();
    } else {
      setDraws((n) => n + 1);
      setNote('Same hand 🤝');
    }

    Animated.sequence([
      Animated.timing(pop, { toValue: 1.16, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  const nextRound = () => {
    tapLight();
    theirs.current = HANDS[Math.floor(Math.random() * 3)].k;   // decided before you tap
    setMine(null); setShown(null); setNote(null);
  };

  // an unfinished run still counts when you walk away
  useEffect(() => () => { if (streak > 0 && user) submitScore(user.id, 'rps', streak); }, [streak, user]);

  const close = () => { onClose && onClose(); };

  const myHand = HANDS.find((h) => h.k === mine);
  const theirHand = HANDS.find((h) => h.k === shown);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <LinearGradient colors={['#1B1035', '#2B1055', '#160B2B']} style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={close} hitSlop={12}>
            <Ionicons name="chevron-down" size={26} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900', letterSpacing: 1 }}>ROCK PAPER SCISSORS</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>✊ ✋ ✌️</Text>
          </View>
          <View style={{ width: 26 }} />
        </View>

        {/* the run you're on, and the best you've ever had */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
          <View style={{ alignItems: 'center', marginHorizontal: 22 }}>
            <Text style={{ color: '#FFD23F', fontSize: 36, fontWeight: '900' }}>{streak}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>STREAK</Text>
          </View>
          <View style={{ alignItems: 'center', marginHorizontal: 22 }}>
            <Text style={{ color: '#7EE0D2', fontSize: 36, fontWeight: '900' }}>{best}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>BEST</Text>
          </View>
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5, textAlign: 'center', marginTop: 8 }}>
          {wins}W · {losses}L · {draws}D
        </Text>

        {/* the two hands */}
        <Animated.View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 34,
          transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) }],
        }}>
          <Animated.View style={{
            width: 108, height: 108, borderRadius: 54, backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 2, borderColor: outcome === 'win' ? '#FFD23F' : 'rgba(255,255,255,0.2)',
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: outcome === 'win' ? pop : 1 }],
          }}>
            <Text style={{ fontSize: 48 }}>{myHand ? myHand.e : '❔'}</Text>
          </Animated.View>

          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '900', marginHorizontal: 16 }}>VS</Text>

          <Animated.View style={{
            width: 108, height: 108, borderRadius: 54, backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 2, borderColor: outcome === 'lose' ? '#FF6B6B' : 'rgba(255,255,255,0.2)',
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: outcome === 'lose' ? pop : 1 }],
          }}>
            <Text style={{ fontSize: 48 }}>{theirHand ? theirHand.e : '❔'}</Text>
          </Animated.View>
        </Animated.View>

        <Text style={{
          color: outcome === 'win' ? '#FFD23F' : outcome === 'lose' ? '#FF9B9B' : '#FFF',
          fontSize: 17, fontWeight: '900', textAlign: 'center', marginTop: 22, height: 24,
        }}>
          {note || ''}
        </Text>

        {/* your three choices */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
          {HANDS.map((h) => (
            <Pressable key={h.k} onPress={() => play(h.k)} disabled={!!mine}>
              <View style={{
                width: 92, height: 92, borderRadius: 24, marginHorizontal: 7,
                backgroundColor: mine === h.k ? C.purple : 'rgba(255,255,255,0.12)',
                borderWidth: 1.5, borderColor: mine === h.k ? '#FFF' : 'rgba(255,255,255,0.22)',
                opacity: mine && mine !== h.k ? 0.35 : 1,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 36 }}>{h.e}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '900', marginTop: 3 }}>{h.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {mine ? (
          <Pressable onPress={nextRound} style={{ alignSelf: 'center', marginTop: 26 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 30, paddingVertical: 14 }}>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>Next hand 🔁</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 18 }}>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
            The other hand is picked before you tap and only shown after — it can't read you.
            {'\n'}Want a real opponent? Start a call with a mate: the same game is in there.
          </Text>
        </View>
      </LinearGradient>
    </Modal>
  );
};
