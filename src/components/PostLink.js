import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { C } from '../constants/theme';
import { activityOf } from '../lib/activityMatch';
import { listGatherings } from '../services/green';
import { listOffers } from '../services/offers';
import { goToTab, showOnMap } from '../lib/mapBus';
import { openTrip } from '../lib/tripLink';
import { titleFor } from '../lib/activityPins';
import { tapLight } from '../utils/feedback';
import { publicMedia } from '../lib/publicMedia';

/* ─── FROM A MOMENT TO THE NEXT ONE ───────────────────────────────────
   Ayser: "فين ميزة join … خلي صورة الملعب تبقى مربوطة مع football event،
   وبتاعة رومانيا في رحلة رومانيا والأكتيفيتيز هناك". Under a post, one
   quiet line that leads somewhere real:
     · the post is about an activity (a pitch, padel, a walk…) and a plan
       of that activity is on this week → that plan;
     · the post is from a country with a trip on Moments → that trip;
     · or with places on the map there → those places.
   Only real plans, real trips and real places; nothing when none fit.
   What it reads is fetched once per session and shared by every card. */

let gatherings = null;
let offers = null;
let dests = null;
const myCode = () => { try { return localStorage.getItem('moments.myCode'); } catch (e) { return null; } };
const loadGatherings = () => (gatherings = gatherings || listGatherings(myCode()).catch(() => []));
const loadOffers = () => (offers = offers || listOffers(null, null).catch(() => []));
/* one place per country, written small by the build (scripts/inject-html.mjs) */
const loadDests = () => (dests = dests || fetch(publicMedia('countries.json').replace(/media\/countries\.json$/, 'countries.json'))
  .then((r) => r.json()).then((rows) => rows.map(([country, flag, id, lat, lng]) => ({ country, flag, id, lat, lng })))
  .catch(() => []));

const countryIn = (list, text) => {
  const s = String(text || '').toLowerCase();
  if (!s) return null;
  const names = Array.from(new Set(list.map((d) => d.country).filter(Boolean)));
  return names.find((n) => s.includes(n.toLowerCase())) || null;
};

export const PostLink = ({ post, t, lang }) => {
  const [link, setLink] = useState(null);
  const text = [post.place, post.caption].filter(Boolean).join(' ');
  useEffect(() => {
    let alive = true;
    (async () => {
      const act = activityOf(text);
      if (act) {
        const rows = await loadGatherings();
        const now = Date.now();
        const g = (rows || []).filter((x) => new Date(x.starts_at).getTime() > now && (activityOf(x.title + ' ' + (x.kind || '')) || {}).id === act.id)
          .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
        if (g) { if (alive) setLink({ kind: 'plan', emoji: act.emoji, label: titleFor(g.title, lang) }); return; }
      }
      const list = await loadDests();
      const country = countryIn(list, post.place) || countryIn(list, post.caption);
      if (!country) return;
      const iso = (list.find((d) => d.country === country && d.flag) || {}).flag;
      const all = await loadOffers();
      const trip = (all || []).find((o) => o.country && iso && String.fromCodePoint(...o.country.split('').map((c) => 0x1F1E6 + c.charCodeAt(0) - 65)) === iso);
      if (trip) { if (alive) setLink({ kind: 'trip', emoji: '🧳', label: (lang === 'ar' && trip.title_ar) || trip.title || country, id: trip.id }); return; }
      const d = list.find((x) => x.country === country);
      if (d && alive) setLink({ kind: 'places', emoji: d.flag || '📍', label: t('pl_link_places').replace('{country}', country), d });
    })().catch(() => {});
    return () => { alive = false; };
  }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!link) return null;
  const go = () => {
    tapLight();
    if (link.kind === 'plan') goToTab('TOGETHER');
    else if (link.kind === 'trip') openTrip(link.id);
    else showOnMap({ lat: link.d.lat, lng: link.d.lng, placeId: link.d.id });
  };
  return (
    <Pressable onPress={go} accessibilityRole="button" style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.purple, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 16, marginEnd: 8 }}>{link.emoji}</Text>
        <Text style={{ flex: 1, color: C.purple, fontSize: 13.5, fontWeight: '900' }} numberOfLines={1}>
          {(link.kind === 'plan' ? t('pl_link_join') : link.kind === 'trip' ? t('pl_link_trip') : '') + link.label}
        </Text>
        <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>›</Text>
      </View>
    </Pressable>
  );
};
