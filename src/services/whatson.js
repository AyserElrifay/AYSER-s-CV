import { fetchLiveCampfires } from './campfires';
import { fetchUpcoming } from './posts';
import { fetchGroups } from './groups';

/* ─── WHAT IS THERE TO JOIN ──────────────────────────────────────────
   Ayser, after using Joiner in Lithuania and an activities app in
   Budapest: "عايز اكتفيتز وحياة وgroups to join".

   ── THE GAP WAS NOT THE DATA ──────────────────────────────────────
   All three of these already existed and all three were already real.
   Live campfires were on the map. Invitations were in the feed, mixed
   in with everything posted that morning, so something on Thursday was
   buried by Tuesday and gone by Thursday. Groups were inside the search
   modal — you had to already be looking for them to find them.

   Nobody opens three different places to ask one question. The question
   is "what can I join", and until now the app had no screen that
   answered it. That is the whole of this file: it asks the three
   sources that already exist and returns one answer.

   ── AND IT STAYS EMPTY WHEN IT IS EMPTY ───────────────────────────
   Nothing here invents an activity to make the screen look alive. A
   city where nothing is happening yet shows that it is, and offers to
   let you be the one who starts something. An app that fills a quiet
   city with made-up events is an app you stop believing the first time
   you turn up to one.                                                */

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
export function kmBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* ── WHEN, WITHOUT BAKING IN A LANGUAGE ──────────────────────────────
   This used to return the finished English string — "in 45m",
   "Monday" — and an Arabic reader got a sheet that was Arabic
   everywhere except the one line telling them when to turn up. Same
   fault I shipped in the scenes with the bracketed actions, and the
   same fix: return the FACTS, let the screen do the words.

   Days and dates are deliberately not translated here by hand. The
   browser already knows the name of Monday in every language the app
   speaks, and Intl gets it right in languages where I would not. */
export function whenParts(startsAt) {
  if (!startsAt) return null;
  const d = new Date(startsAt);
  const mins = Math.round((d - Date.now()) / 60000);
  if (mins <= 0) return { kind: 'now' };
  if (mins < 60) return { kind: 'mins', n: mins };
  if (mins < 20 * 60) return { kind: 'hours', n: Math.round(mins / 60) };
  if (mins < 7 * 24 * 60) return { kind: 'weekday', at: d.toISOString() };
  return { kind: 'date', at: d.toISOString() };
}

/* One call, three questions, and a failure in any one of them does not
   take the other two down with it — a screen that shows two of three
   sections is far better than a screen that shows an error because the
   groups table was slow. */
export async function fetchWhatsOn({ userId, coords, radiusKm = 60 } = {}) {
  const settle = (p) => p.then((v) => v).catch(() => null);
  const [fires, soon, groups] = await Promise.all([
    settle(fetchLiveCampfires()),
    settle(fetchUpcoming({ limit: 30 })),
    settle(fetchGroups(userId)),
  ]);

  const me = coords && coords.latitude != null
    ? { lat: coords.latitude, lng: coords.longitude } : null;

  /* Distance is only a filter when we actually know where you are.
     Guessing a location and then hiding things that are near it is the
     worst of both — so with no fix, nothing is filtered out. */
  const near = (row) => {
    if (!me || row.lat == null || row.lng == null) return { ...row, km: null };
    const km = kmBetween(me, { lat: row.lat, lng: row.lng });
    return { ...row, km };
  };
  const withinRadius = (row) => row.km == null || row.km <= radiusKm;

  return {
    /* Live right now, and someone is already sitting there. */
    now: (fires || []).map(near).filter(withinRadius).map((c) => ({
      kind: 'campfire',
      id: c.id,
      title: c.title || 'Campfire',
      topic: c.topic || null,
      host: (c.host && c.host.name) || null,
      hostAvatar: (c.host && c.host.avatar_url) || null,
      lat: c.lat, lng: c.lng, km: c.km,
      endsAt: c.ends_at || null,
    })),

    /* Has a time on it and the time has not passed. */
    soon: (soon || []).map(near).filter(withinRadius).map((p) => ({
      kind: 'invite',
      id: p.id,
      title: p.caption || 'A moment',
      place: p.place || null,
      host: (p.user && p.user.name) || null,
      hostAvatar: (p.user && p.user.avatar_url) || null,
      flag: (p.user && p.user.country_flag) || null,
      squad: p.squad_name || null,
      startsAt: p.starts_at,
      when: whenParts(p.starts_at),
      media: p.media_url || null,
      lat: p.lat, lng: p.lng, km: p.km,
    })),

    /* Open groups you are not already in, biggest first — fetchGroups
       already orders by member count. A group you are waiting on shows
       as waiting rather than offering a Join that would do nothing. */
    groups: (groups || [])
      .filter((g) => !g.joined)
      .map((g) => ({
        kind: 'group',
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        about: g.about,
        city: g.city,
        privacy: g.privacy,
        members: g.members,
        waiting: g.waiting,
      })),

    /* Which of the three actually answered. A section whose source
       failed must not be drawn as "nothing here" — that would be the
       same lie the feed used to tell before it knew the difference
       between empty and not-loaded. */
    reached: { now: fires != null, soon: soon != null, groups: groups != null },
  };
}
