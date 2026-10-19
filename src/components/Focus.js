import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { setFocus } from '../services/bardiFocus';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { lazyOverlay } from '../lib/lazyScreen';
import { getPlus } from '../lib/plus';

/* ─── FOCUS: THE KITE CLIMBS WHILE YOU WORK ───────────────────────────
   Ayser: "حاجة زي الـ pomodoro technique لما تعمل focus · studying mood
   … بلاش أشكال وحشة، ممكن تعمل الكايت والنجمة". The Moments kite (the
   same one that opens the app) rises toward the gold star as the round
   goes by; at the star, the round is done and it is time for a short
   break — breathe, water, stretch. Every finished round is a small star
   kept for today. Nothing to read but the time.

   Rounds: 25 + 5 (the classic), 50 + 10, or 90 + 15. The clock is the
   wall clock (an end time, not a counter), so a locked phone or a
   switched tab does not stretch it. Studying or deep work is shared as
   one word, so people near you doing the same can be found
   (setFocus, the same signal the brain dump uses) — nothing else. */

const PlusSheet = lazyOverlay(() => import('./PlusSheet').then((m) => ({ default: m.PlusSheet })));
const LOG = 'mm.focus.log';
const rd = () => { try { return JSON.parse(localStorage.getItem(LOG) || '{}'); } catch (e) { return {}; } };
const dayKey = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const LENGTHS = [[25, 5], [50, 10], [90, 15]];
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

/* the kite, the star and the string, drawn — web only, like the intro */
const Sky = ({ frac, resting }) => {
  if (Platform.OS !== 'web') return null;
  const h = React.createElement;
  const y = 250 - frac * 190;                       // from the ground to just under the star
  const sway = resting ? 0 : Math.sin(frac * 18) * 6;
  return h('svg', { viewBox: '0 0 200 300', width: '100%', height: '100%', style: { display: 'block' } },
    h('defs', null, h('radialGradient', { id: 'fglow' }, h('stop', { offset: '0', stopColor: '#F5B301', stopOpacity: 0.55 }), h('stop', { offset: '1', stopColor: '#F5B301', stopOpacity: 0 }))),
    h('circle', { cx: 100, cy: 34, r: 30 + frac * 10, fill: 'url(#fglow)' }),
    h('path', { d: 'M100,10 C102,28 106,30 124,34 C106,38 102,40 100,58 C98,40 94,38 76,34 C94,30 98,28 100,10Z', fill: '#F5B301' }),
    h('path', { d: 'M' + (100 + sway) + ',' + (y + 38) + ' C' + (90 + sway) + ',' + (y + 80) + ' 120,' + (y + 110) + ' 100,300', stroke: '#C4B5FD', strokeWidth: 1.5, fill: 'none', strokeDasharray: '3 4' }),
    h('g', { transform: 'translate(' + (100 + sway) + ' ' + y + ') rotate(' + (sway * 1.5) + ')' },
      h('path', { d: 'M0,-30 L21,-3 L0,30 L-21,-3 Z', fill: '#7C3AED' }),
      h('path', { d: 'M0,-30 L21,-3 L0,-3 Z', fill: '#A78BFA' }),
      h('path', { d: 'M0,-3 L-21,-3 L0,30 Z', fill: '#5B21B6' }),
      h('path', { d: 'M0,-30 L0,30 M-21,-3 L21,-3', stroke: '#F5B301', strokeWidth: 1.6 }),
      h('path', { d: 'M0,30 C-8,38 8,45 0,53 C-8,61 6,67 -2,75', stroke: '#F5B301', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' })));
};

export const Focus = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [kind, setKind] = useState('studying');
  const [len, setLen] = useState(0);                 // index into LENGTHS
  const [phase, setPhase] = useState('ready');       // ready | work | break
  const [endAt, setEndAt] = useState(0);
  const [pausedLeft, setPausedLeft] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [today, setToday] = useState(() => rd()[dayKey()] || { min: 0, rounds: 0 });
  const lock = useRef(null);
  // the long rounds (50 and 90 minutes) are Moments Plus
  const [plus, setPlus] = useState(false);
  const [plusSheet, setPlusSheet] = useState(false);
  useEffect(() => { getPlus().then((r) => setPlus(!!(r && r.plus))); }, []);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  // the screen stays on while a round runs, where the phone allows it
  useEffect(() => {
    const on = phase !== 'ready' && pausedLeft == null;
    try {
      if (on && navigator.wakeLock && !lock.current) navigator.wakeLock.request('screen').then((l) => { lock.current = l; }).catch(() => {});
      if (!on && lock.current) { lock.current.release().catch(() => {}); lock.current = null; }
    } catch (e) {}
  }, [phase, pausedLeft]);
  useEffect(() => () => { try { if (lock.current) lock.current.release(); } catch (e) {} }, []);

  const [work, rest] = LENGTHS[len];
  const total = (phase === 'break' ? rest : work) * 60000;
  const left = pausedLeft != null ? pausedLeft : Math.max(0, endAt - now);
  const frac = phase === 'ready' ? 0 : 1 - left / total;

  const ping = (title) => {
    try {
      if (typeof window.Notification !== 'undefined' && window.Notification.permission === 'granted' && navigator.serviceWorker) {
        navigator.serviceWorker.ready.then((r) => r.showNotification(title, { tag: 'mm-focus', icon: '/icon-192.png' })).catch(() => {});
      }
    } catch (e) {}
  };

  // a round ends on its own: work → a break (and a star), break → ready again
  useEffect(() => {
    if (phase === 'ready' || pausedLeft != null || left > 0) return;
    if (phase === 'work') {
      tapSuccess();
      const all = rd(); const d = all[dayKey()] || { min: 0, rounds: 0 };
      const n = { min: d.min + work, rounds: d.rounds + 1 };
      all[dayKey()] = n; try { localStorage.setItem(LOG, JSON.stringify(all)); } catch (e) {}
      setToday(n);
      ping('🌟 ' + t('fo_round_done'));
      setPhase('break'); setEndAt(Date.now() + rest * 60000);
    } else {
      ping('🪁 ' + t('fo_break_done'));
      setPhase('ready');
    }
  }, [left, phase, pausedLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    tapSuccess();
    try { if (typeof window.Notification !== 'undefined' && window.Notification.permission === 'default') window.Notification.requestPermission().catch(() => {}); } catch (e) {}
    setPhase('work'); setPausedLeft(null); setEndAt(Date.now() + work * 60000);
    setFocus(kind, work).catch(() => {});
  };
  const pause = () => { tapLight(); if (pausedLeft == null) setPausedLeft(left); else { setEndAt(Date.now() + pausedLeft); setPausedLeft(null); } };
  const stop = () => { tapLight(); setPhase('ready'); setPausedLeft(null); setFocus(null).catch(() => {}); };

  const bg = phase === 'break' ? '#ECFDF5' : '#F5F3FF';
  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { if (phase !== 'ready') setFocus(null).catch(() => {}); onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>
            {'🌟 '.repeat(Math.min(today.rounds, 8)).trim() || ' '}{today.min ? '  ' + t('fo_today').replace('{n}', String(today.min)) : ''}
          </Text>
        </View>

        <Text style={{ color: phase === 'break' ? C.green : C.purple, fontSize: 12, fontWeight: '900', letterSpacing: 1.4, textAlign: 'center', marginTop: 10 }}>
          {(phase === 'break' ? t('fo_break') : t(kind === 'studying' ? 'bd_kind_studying' : 'bd_kind_deep_work')).toUpperCase()}
        </Text>
        <Text style={{ color: C.text, fontSize: 64, fontWeight: '900', textAlign: 'center', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
          {mmss(phase === 'ready' ? work * 60000 : left)}
        </Text>
        {phase === 'break' ? <Text style={{ color: C.dim, fontSize: 15, textAlign: 'center', fontWeight: '700' }}>{t('fo_break_sub')}</Text> : null}

        <View style={{ flex: 1, marginVertical: 8 }}>
          <Sky frac={frac} resting={phase !== 'work' || pausedLeft != null} />
        </View>

        {phase === 'ready' ? (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 10 }}>
              {['studying', 'deep_work'].map((k) => (
                <Pressable key={k} onPress={() => { tapSelection(); setKind(k); }} style={{ marginHorizontal: 4 }}>
                  <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: kind === k ? C.purple : C.line, backgroundColor: kind === k ? C.purple : '#FFF', paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Text style={{ color: kind === k ? '#FFF' : C.text, fontSize: 14, fontWeight: '800' }}>{k === 'studying' ? '📚 ' + t('bd_kind_studying') : '💻 ' + t('bd_kind_deep_work')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 14 }}>
              {LENGTHS.map(([w, r], i) => (
                <Pressable key={w} onPress={() => { tapSelection(); if (i > 0 && !plus) setPlusSheet(true); else setLen(i); }} style={{ marginHorizontal: 4 }}>
                  <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: len === i ? C.purple : C.line, backgroundColor: C.glass, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{t('md_min').replace('{n}', String(w)) + (i > 0 && !plus ? ' ✦' : '')}</Text>
                    <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '700' }}>{'+ ' + t('fo_rest').replace('{n}', String(r))}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={start} accessibilityRole="button">
              <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 17, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900' }}>{'🪁 ' + t('fo_start')}</Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <Pressable onPress={pause} accessibilityRole="button" style={{ flex: 1, marginEnd: 8 }}>
              <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{pausedLeft != null ? t('fo_resume') : t('fo_pause')}</Text>
              </View>
            </Pressable>
            <Pressable onPress={stop} accessibilityRole="button" style={{ flex: 1 }}>
              <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.glass, paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: C.dim, fontSize: 16, fontWeight: '800' }}>{t('fo_stop')}</Text>
              </View>
            </Pressable>
          </View>
        )}
        <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 10 }}>{t('fo_shared')}</Text>
      </View>
      {plusSheet ? <PlusSheet why="focus" onClose={() => { setPlusSheet(false); getPlus(true).then((r) => setPlus(!!(r && r.plus))); }} /> : null}
    </Modal>
  );
};
