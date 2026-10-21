import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { circlesNear, joinCircle, createCircle, lastFix } from '../services/squadAdmin';
import { openChat } from '../lib/chatBus';
import { goToTab } from '../lib/mapBus';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── CIRCLES NEAR YOU ─────────────────────────────────────────────────
   Public circles people started at places within 25 km (circles_near in
   RUN_ME.sql), with how many are in each — never who. Join is one tap
   and opens the chat. With none yet: one honest suggestion to start. */
export const CirclesNear = () => {
  const { t } = useLang();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);
  const fix = lastFix();
  useEffect(() => { if (fix) circlesNear(fix.lat, fix.lng).then(setList); else setList([]); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (c) => { openChat({ id: c.id, name: c.name, emoji: c.emoji || '⭕' }); goToTab('CHATS'); };
  const join = async (c) => {
    if (busy) return;
    tapLight(); setBusy(c.id);
    const r = c.mine ? { ok: true } : await joinCircle(c.id);
    setBusy(null);
    if (r && r.ok) { tapSuccess(); open(c); }
  };
  const startSaturday = async () => {
    tapLight();
    const r = await createCircle({ name: t('ci_saturday'), about: t('ci_saturday_about'), lat: fix && fix.lat, lng: fix && fix.lng, isPublic: true });
    if (r && r.ok) { tapSuccess(); open({ id: r.id, name: t('ci_saturday') }); }
  };
  /* nothing near: no section at all. An empty box under the week's empty
     box was the page apologising twice. */
  if (list == null || !list.length) return null;

  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.1, marginBottom: 10 }}>{t('ci_near').toUpperCase()}</Text>
      {list.length ? (
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>
          {list.map((c) => (
            <View key={c.id} style={{ width: 190, marginEnd: 10, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 13 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{c.name}</Text>
              <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }} numberOfLines={1}>{(c.place_name ? c.place_name + ' · ' : '') + c.km + ' km'}</Text>
              {c.about ? <Text style={{ color: C.text, fontSize: 13, marginTop: 6 }} numberOfLines={2}>{c.about}</Text> : null}
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>{t('gc_members_n').replace('{n}', String(c.members))}</Text>
              <Pressable onPress={() => join(c)} style={{ marginTop: 10 }}>
                <View style={{ borderRadius: 999, paddingVertical: 8, alignItems: 'center', backgroundColor: c.mine ? 'transparent' : C.purple, borderWidth: 1, borderColor: c.mine ? C.line : C.purple, opacity: busy === c.id ? 0.6 : 1 }}>
                  <Text style={{ color: c.mine ? C.text : '#FFF', fontSize: 13, fontWeight: '900' }}>{c.mine ? t('ci_open') : t('ci_join')}</Text>
                </View>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={startSaturday} accessibilityRole="button">
          <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{t('ci_none')}</Text>
            <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '900', marginTop: 6 }}>{'＋ ' + t('ci_saturday')}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
};
