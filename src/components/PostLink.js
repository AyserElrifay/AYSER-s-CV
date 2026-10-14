import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { C } from '../constants/theme';
import { activityOf } from '../lib/activityMatch';
import { listGatherings, joinGathering } from '../services/green';
import { listOffers } from '../services/offers';
import { showOnMap } from '../lib/mapBus';
import { openTrip } from '../lib/tripLink';
import { titleFor } from '../lib/activityPins';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
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

const whenOf = (iso, lang) => {
  try { return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
  catch (e) { return ''; }
};

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
        if (g) { if (alive) setLink({ kind: 'plan', emoji: act.emoji, label: titleFor(g.title, lang), g }); return; }
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
  /* a plan is joined right here: the post is often open in a sheet
     (a profile, a notification) and a tab switch behind it showed
     nothing — Ayser: "الزرار مش شغال" */
  const [open, setOpen] = useState(false);
  const [going, setGoing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!link) return null;
  const g = link.g;
  const isGoing = going == null ? !!(g && g.im_going) : going;
  const count = g ? Math.max(0, (Number(g.going) || 0) + (going == null ? 0 : (going ? 1 : 0) - (g.im_going ? 1 : 0))) : 0;
  const join = async () => {
    if (busy) return;
    tapMedium(); setBusy(true); setMsg(null);
    const yes = !isGoing;
    const r = await joinGathering(g.id, yes);
    setBusy(false);
    if (r && r.ok) { setGoing(yes); if (yes) tapSuccess(); return; }
    const why = (r && r.reason) || '';
    setMsg(/^audience_/.test(why) ? t('au_err_' + why.slice(9)) : /^age_/.test(why) ? t('ag_err_' + why.slice(4))
      : why === 'signed_out' ? t('sign_in_first') : why === 'plus' ? '' : t('pl_join_failed'));
  };
  const go = () => {
    tapLight();
    if (link.kind === 'plan') setOpen((v) => !v);
    else if (link.kind === 'trip') openTrip(link.id);
    else showOnMap({ lat: link.d.lat, lng: link.d.lng, placeId: link.d.id });
  };
  return (
    <View style={{ marginTop: 12 }}>
    <Pressable onPress={go} accessibilityRole="button">
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.purple, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 16, marginEnd: 8 }}>{link.emoji}</Text>
        <Text style={{ flex: 1, color: C.purple, fontSize: 13.5, fontWeight: '900' }} numberOfLines={1}>
          {(link.kind === 'plan' ? t('pl_link_join') : link.kind === 'trip' ? t('pl_link_trip') : '') + link.label}
        </Text>
        <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>{link.kind === 'plan' && open ? '⌄' : '›'}</Text>
      </View>
    </Pressable>
      {link.kind === 'plan' && open ? (
        <View style={{ marginTop: 8, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, backgroundColor: C.glass }}>
          <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={2}>
            {[whenOf(g.starts_at, lang), g.place_name || g.city].filter(Boolean).join(' · ')}
          </Text>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{'👥 ' + count + ' ' + t('green_going')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Pressable onPress={join} disabled={busy} accessibilityRole="button"
              style={{ borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18, backgroundColor: isGoing ? 'transparent' : C.purple, borderWidth: 1.5, borderColor: isGoing ? C.green : C.purple, opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: isGoing ? C.green : '#FFF', fontSize: 14, fontWeight: '900' }}>{isGoing ? '✓ ' + t('green_joined') : t('green_coming')}</Text>
            </Pressable>
          </View>
          {msg ? <Text style={{ color: '#E11D48', fontSize: 12.5, marginTop: 8 }}>{msg}</Text> : null}
        </View>
      ) : null}
    </View>
  );
};
