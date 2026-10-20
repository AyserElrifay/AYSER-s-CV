import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { C } from '../../constants/theme';
import { worldBoard, skyKey } from '../../services/squadGames';
import { gw, fill } from './words';
import { WorldSheet } from './WorldSheet';
import { tapLight } from '../../utils/feedback';

/* ─── TONIGHT'S SKY, IN THE FEED ──────────────────────────────────────
   One quiet card under the plans: the day's golden-hour strip and how
   many places it has reached so far — real photos, real count, and an
   honest "be the first" while it is empty. Opens One world. */
export const WorldCard = ({ userId, lang, city }) => {
  const [b, setB] = useState(null);
  const [open, setOpen] = useState(false);
  const T = (k) => gw(lang, k);
  useEffect(() => { worldBoard(skyKey(), 1).then((r) => r && r.ok && setB(r)); }, [open]);
  return (
    <>
      <Pressable onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 14, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ fontSize: 30, marginEnd: 12 }}>🌅</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{T('world_card')}</Text>
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
              {b && b.count ? fill(T('entries'), { n: b.count, c: b.countries }) : T('world_card_s')}
            </Text>
          </View>
          <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '900' }}>{T('photo') + ' →'}</Text>
        </View>
      </Pressable>
      {open ? <WorldSheet userId={userId} lang={lang} city={city} onClose={() => setOpen(false)} /> : null}
    </>
  );
};
