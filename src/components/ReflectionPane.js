import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { reflectionToday, reflect, fallbackPrompt, MOODS } from '../services/reflection';
import { uploadMediaSmart } from '../lib/storage';
import { addToPage } from '../services/memory';
import { lazyOverlay } from '../lib/lazyScreen';
const DrawSheet = lazyOverlay(() => import('./DrawSheet').then((m) => ({ default: m.DrawSheet })));
import { goToTab } from '../lib/mapBus';
import { mw } from '../constants/memoryWords';
import { earnBonus } from '../lib/feedGate';
import { usePrivacyShield, NO_SAVE } from '../hooks/usePrivacyShield';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { AV_NEUTRAL } from '../constants/mockData';


/* ─── REFLECTION · TODAY'S QUESTION ───────────────────────────────────
   One question for everybody today. Answer it first — then the others'
   answers open, like a door you walked through yourself. They are
   today's only; your own goes on today's page of your Moments Book. */

const ago = (iso, t) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? t('pv_min').replace('{n}', String(m)) : t('pv_hours').replace('{n}', String(Math.round(m / 60)));
};

export const ReflectionPane = ({ user }) => {
  const { t, lang } = useLang();
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [mood, setMood] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draw, setDraw] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const saveDrawing = async ({ blob, ext, type }) => {
    setDraw(false);
    if (!user) return;
    try {
      const url = await uploadMediaSmart(user.id, blob, ext, type);
      const day = (() => { try { return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }); } catch (e) { return new Date().toISOString().slice(0, 10); } })();
      const r = await addToPage(day, 'drawing', url);
      if (r && r.ok) setDrawn(true); else setErr(t('rf_err'));
    } catch (e) { setErr(t('rf_err')); }
  };

  /* other people's answers are theirs: no screenshots in the apps, and
     covered on the web when the page loses focus */
  const { covered } = usePrivacyShield(!!(data && data.mine && (data.answers || []).length));
  const load = () => reflectionToday().then((r) => setData(r || { prompt: fallbackPrompt(), mine: null, count: 0, answers: null })).catch(() => setData({ prompt: fallbackPrompt(), mine: null, count: 0, answers: null }));
  useEffect(() => { load(); }, []);

  if (!data) return <ActivityIndicator color={C.dim} style={{ marginTop: 40 }} />;
  const p = data.prompt || fallbackPrompt();
  const question = lang === 'ar' && p.body_ar ? p.body_ar : p.body;
  const mine = data.mine;
  const showForm = !mine || editing;

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    if (!user) { setErr(t('rf_sign_in')); return; }
    tapMedium(); setBusy(true); setErr(null);
    const r = await reflect(body, mood);
    setBusy(false);
    if (r && r.ok) { tapSuccess(); earnBonus('reflect'); setEditing(false); load(); return; }
    setErr(r && r.reason === 'light_mood' ? t('lt_mood') : r && r.reason === 'long' ? t('rf_long') : t('rf_err'));
  };

  return (
    <View>
      <View style={{ borderRadius: 24, padding: 22, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
        <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.4 }}>{t('rf_kicker').toUpperCase()}</Text>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '800', lineHeight: 31, marginTop: 10 }}>{question}</Text>
        {p.by ? <Text style={{ color: C.purple, fontSize: 13, fontWeight: '700', marginTop: 8 }}>{t('rf_by').replace('{name}', p.by)}</Text> : null}

        {showForm ? (
          <View style={{ marginTop: 16 }}>
            <TextInput value={text} onChangeText={setText} maxLength={500} multiline placeholder={t('rf_ph')} placeholderTextColor={C.faint}
              style={{ color: C.text, fontSize: 16, lineHeight: 22, minHeight: 84, borderRadius: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, padding: 12, textAlignVertical: 'top', outlineStyle: 'none' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 8, marginTop: 12 }}>
              {MOODS.map((m, i) => (
                <Pressable key={m} onPress={() => { tapLight(); setMood(mood === i + 1 ? null : i + 1); }} accessibilityRole="radio" accessibilityState={{ checked: mood === i + 1 }} hitSlop={4}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginEnd: 6, backgroundColor: mood === i + 1 ? C.glassHi : 'transparent', borderWidth: mood === i + 1 ? 1 : 0, borderColor: C.line }}>
                  <Text style={{ fontSize: 22, opacity: mood && mood !== i + 1 ? 0.45 : 1 }}>{m}</Text>
                </Pressable>
              ))}
              {/* a drawing for today's page of the book (DrawSheet → page_add) */}
              <Pressable testID="rf-draw" onPress={() => { tapLight(); setDraw(true); }} accessibilityRole="button" accessibilityLabel={lang === 'ar' ? 'ارسم ذكرى' : 'Draw a memory'} hitSlop={4}
                style={{ height: 40, borderRadius: 20, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line }}>
                <Ionicons name="brush-outline" size={16} color={C.text} />
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700', marginStart: 5 }}>{drawn ? (lang === 'ar' ? 'اترسمت' : 'Drawn') : (lang === 'ar' ? 'ارسم' : 'Draw')}</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable onPress={send} disabled={busy || !text.trim()} accessibilityRole="button">
                <View style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: text.trim() ? C.text : C.glassHi }}>
                  <Text style={{ color: text.trim() ? C.bg : C.faint, fontSize: 14, fontWeight: '800' }}>{busy ? '…' : t('rf_share')}</Text>
                </View>
              </Pressable>
            </View>
            {err ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 10, lineHeight: 18 }}>{err}</Text> : null}
          </View>
        ) : (
          <View style={{ marginTop: 16, borderRadius: 16, padding: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800' }}>{t('rf_yours') + (mine.mood ? '  ' + MOODS[mine.mood - 1] : '')}</Text>
            <Text style={{ color: C.text, fontSize: 15.5, lineHeight: 21, marginTop: 4 }}>{mine.body}</Text>
            <Pressable onPress={() => { tapLight(); setText(mine.body); setMood(mine.mood || null); setEditing(true); }} accessibilityRole="button" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700' }}>{t('edit')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* what the others said — open only once you answered */}
      {!mine ? (
        /* no counts, no empty lock box: one warm line (Ayser, November 2026) */
        <Text testID="rf-teaser" style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 14, paddingHorizontal: 10 }}>
          {lang === 'ar' ? '✦ شارك تأملك عشان تفتح دايرة النهارده وتتحفظ في كتاب مومنتس بتاعك' : "✦ Share your reflection to unlock today's community circle and save it to your Moments Book"}
        </Text>
      ) : (
        <View style={[{ marginTop: 14 }, NO_SAVE]}>
          {covered ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Ionicons name="eye-off-outline" size={26} color={C.faint} />
              <Text style={{ color: C.faint, fontSize: 13, fontWeight: '700', marginTop: 6 }}>{t('vo_covered')}</Text>
            </View>
          ) : (data.answers || []).length ? (data.answers || []).map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Image source={{ uri: a.avatar || AV_NEUTRAL }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.glassHi }} />
              <View style={{ flex: 1, minWidth: 0, marginStart: 10 }}>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{(a.name || '') + (a.mood ? '  ' + MOODS[a.mood - 1] : '')}<Text style={{ color: C.faint, fontWeight: '600' }}>{'  · ' + ago(a.at, t)}</Text></Text>
                {a.prompt && a.prompt !== p.body && a.prompt !== p.body_ar ? <Text style={{ color: C.faint, fontSize: 12, fontStyle: 'italic', marginTop: 2 }} numberOfLines={2}>{a.prompt}</Text> : null}
                <Text style={{ color: C.text, fontSize: 15, lineHeight: 21, marginTop: 2 }}>{a.body}</Text>
              </View>
            </View>
          )) : <Text style={{ color: C.dim, fontSize: 14, textAlign: 'center', marginTop: 8 }}>{t('rf_first')}</Text>}
          <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 12 }}>{t('rf_24h').replace('{h}', String(data.hours || 48))}</Text>
        </View>
      )}

      {/* your answer is kept on today's page of your Moments Book (Space), with the day's photo */}
      <Pressable testID="btn-open-book" onPress={() => { tapLight(); goToTab('SPACE'); setTimeout(() => { try { window.dispatchEvent(new CustomEvent('mm-open-book')); } catch (e) {} }, 400); }} accessibilityRole="button" style={{ marginTop: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
          <Ionicons name="book-outline" size={20} color={C.text} />
          <View style={{ flex: 1, marginStart: 12 }}>
            <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800' }}>{mw(lang, 'kicker2')}</Text>
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{mw(lang, 'fromReflect')}</Text>
          </View>
          <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color={C.faint} />
        </View>
      </Pressable>
      {draw ? <DrawSheet lang={lang} onClose={() => setDraw(false)} onDone={saveDrawing} /> : null}
    </View>
  );
};
