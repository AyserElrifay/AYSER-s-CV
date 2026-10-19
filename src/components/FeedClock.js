import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { readGate, TASKS, untilTomorrow } from '../lib/feedGate';
import { buildIcs, openIcs } from '../lib/ics';
import { tapLight } from '../utils/feedback';

/* ─── THE FEED'S CLOCK, ALWAYS IN VIEW ────────────────────────────────
   Ayser: "قلّه فاضل قد إيه … وخلّي في تايمر شغّال — وإنت فاتح، فاضل قد
   إيه ويقفل". While the feed is open: the minutes left today, ticking.
   Once it has closed: when it opens again, and the small things that
   earn a few more minutes today. The counting itself is
   src/lib/feedGate.js; this only shows it. */

const mmss = (sec) => { const s = Math.max(0, Math.round(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export const FeedClock = ({ budget, running }) => {
  const { t } = useLang();
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const g = readGate();
  /* the gate is written every five seconds; between writes, count on */
  /* only while time is really being counted: the last write is recent */
  const since = running && g.at && Date.now() - g.at < 5500 ? (Date.now() - g.at) / 1000 : 0;
  const left = budget - g.used - since;
  const low = left < 120;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 12, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: low ? 'rgba(225,29,72,0.10)' : C.glass, borderWidth: 1, borderColor: low ? 'rgba(225,29,72,0.35)' : C.line }}>
      <Ionicons name="hourglass-outline" size={14} color={low ? '#E11D48' : C.dim} />
      <Text style={{ color: low ? '#E11D48' : C.dim, fontSize: 13, fontWeight: '800', marginStart: 6, fontVariant: ['tabular-nums'] }}>
        {t('fg_left').replace('{t}', mmss(left))}
      </Text>
    </View>
  );
};

/* under the closed feed: when it opens, and how to earn a little more */
export const FeedReopen = ({ onReflect, onPlans }) => {
  const { t } = useLang();
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(id); }, []);
  const g = readGate();
  const u = untilTomorrow();
  const go = { reflect: onReflect, plan: onPlans };
  const [asked, setAsked] = useState(false);
  const remind = () => {
    tapLight();
    const at = new Date(); at.setHours(24, 0, 30, 0);
    try { openIcs(buildIcs([{ uid: 'feed-' + at.toISOString().slice(0, 10), title: t('fg_remind_title'), start: at, minutes: 5, alarm: 0 }]), 'moments-reopens.ics'); setAsked(true); } catch (e) {}
  };
  return (
    <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
      <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', textAlign: 'center' }}>
        {'🌙 ' + t('fg_reopens').replace('{h}', String(u.h)).replace('{m}', String(u.m))}
      </Text>
      {/* the countdown runs with the app closed; the phone's own calendar
          rings when it is over (the same .ics My day uses) */}
      <Pressable onPress={remind} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Ionicons name={asked ? 'checkmark' : 'notifications-outline'} size={15} color={asked ? C.green : C.text} />
          <Text style={{ color: asked ? C.green : C.text, fontSize: 13.5, fontWeight: '800', marginStart: 6 }}>{t(asked ? 'fg_remind_done' : 'fg_remind')}</Text>
        </View>
      </Pressable>
      {TASKS.some((x) => g.earned.indexOf(x.key) < 0) ? (
        <View style={{ marginTop: 14, borderRadius: 16, padding: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>{t('fg_tasks').toUpperCase()}</Text>
          {TASKS.map((x) => {
            const done = g.earned.indexOf(x.key) >= 0;
            return (
              <Pressable key={x.key} onPress={done ? undefined : go[x.key]} disabled={done} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
                <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done ? C.green : C.dim} />
                <Text style={{ flex: 1, color: done ? C.faint : C.text, fontSize: 14, fontWeight: '700', marginStart: 8, textDecorationLine: done ? 'line-through' : 'none' }}>{t('fg_task_' + x.key)}</Text>
                <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900' }}>{'+' + x.minutes + ' min'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};
