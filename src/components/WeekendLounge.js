import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { supabase, SUPABASE_READY } from '../lib/supabase';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── THE CAIRO WEEKEND LOUNGE ────────────────────────────────────────
   Ayser, November 2026: Messages is never empty — pinned on top for
   everybody, one live weekend poll the team asks from the Studio, how
   many people are in on it, and three quick reactions (RUN_ME.sql
   lounge_now). The numbers are the real ones; a new lounge starts at 0. */
const rpc = async (fn, args) => {
  if (!SUPABASE_READY) return null;
  try { const { data, error } = await supabase.rpc(fn, args); return error ? null : data; } catch (e) { return null; }
};
const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const W = {
  en: { title: 'Cairo Weekend Lounge', live: 'Live poll', people: '{n} in on it', first: 'Be the first to vote', votes: '{n} votes', in: 'I’m in', fire: 'Hyped', heart: 'Love it' },
  ar: { title: 'لاونج ويك إند القاهرة', live: 'تصويت لايف', people: '{n} مشاركين', first: 'كن أول واحد يصوّت', votes: '{n} صوت', in: 'أنا جاي', fire: 'متحمّس', heart: 'حبيتها' },
};
const t = (lang, k, n) => { const s = (W[lang === 'ar' ? 'ar' : 'en'][k]); return n == null ? s : s.replace('{n}', lang === 'ar' ? AR(n) : String(n)); };
const REACTS = [['in', 'hand-right-outline', 'hand-right'], ['fire', 'flame-outline', 'flame'], ['heart', 'heart-outline', 'heart']];

export const WeekendLounge = ({ lang }) => {
  const [p, setP] = useState(null);
  useEffect(() => {
    rpc('lounge_now').then((r) => setP(r && r.ok ? r : null));
    const h = setInterval(() => rpc('lounge_now').then((r) => { if (r && r.ok) setP(r); }), 20000);
    return () => clearInterval(h);
  }, []);
  if (!p) return null;
  const total = (p.counts || []).reduce((a, b) => a + b, 0);
  const vote = async (i) => { tapLight(); const r = await rpc('lounge_vote', { p_poll: p.id, p_choice: i }); if (r && r.ok) { tapSuccess(); setP(r); } };
  const react = async (k) => { tapLight(); const r = await rpc('lounge_react', { p_poll: p.id, p_kind: k }); if (r && r.ok) setP(r); };
  const mine = Array.isArray(p.mine) ? p.mine : [];
  return (
    <View testID="weekend-lounge" style={{ marginTop: 16, borderRadius: 18, backgroundColor: '#17131F', padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="pin" size={13} color="#D9C08C" />
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginStart: 6, flex: 1 }}>{'✦ ' + t(lang, 'title')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#3DDC84', marginEnd: 5 }} />
          <Text style={[{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' }, NUM]}>{p.people ? t(lang, 'people', p.people) : t(lang, 'live')}</Text>
        </View>
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 16.5, fontWeight: '700', lineHeight: 22, marginTop: 10 }}>{lang === 'ar' && p.question_ar ? p.question_ar : p.question}</Text>
      {(p.options || []).map((o, i) => {
        const n = (p.counts || [])[i] || 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const on = p.my_vote === i;
        return (
          <Pressable key={i} testID={'lounge-opt-' + i} onPress={() => vote(i)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ marginTop: 8 }}>
            <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: on ? '#D9C08C' : 'rgba(255,255,255,0.18)' }}>
              {p.my_vote != null ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pct + '%', backgroundColor: on ? 'rgba(217,192,140,0.28)' : 'rgba(255,255,255,0.08)' }} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 14.5, fontWeight: on ? '800' : '600' }}>{lang === 'ar' ? o.ar || o.en : o.en}</Text>
                {p.my_vote != null ? <Text style={[{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' }, NUM]}>{(lang === 'ar' ? AR(pct) : pct) + '%'}</Text> : null}
              </View>
            </View>
          </Pressable>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <Text style={[{ color: 'rgba(255,255,255,0.6)', fontSize: 12, flex: 1 }, NUM]}>{total ? t(lang, 'votes', total) : t(lang, 'first')}</Text>
        {REACTS.map(([k, off, on]) => {
          const has = mine.includes(k);
          const n = (p.reacts || {})[k] || 0;
          return (
            <Pressable key={k} testID={'lounge-react-' + k} onPress={() => react(k)} accessibilityRole="button" accessibilityLabel={t(lang, k)} accessibilityState={{ selected: has }} hitSlop={6} style={{ marginStart: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: has ? 'rgba(217,192,140,0.25)' : 'rgba(255,255,255,0.08)' }}>
                <Ionicons name={has ? on : off} size={14} color={has ? '#D9C08C' : '#FFFFFF'} />
                {n ? <Text style={[{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginStart: 4 }, NUM]}>{lang === 'ar' ? AR(n) : n}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
