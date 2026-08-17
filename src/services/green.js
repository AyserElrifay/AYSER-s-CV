import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';

/* ─── أخضر · THE GREEN CORNER ─────────────────────────────────────────
   Two halves, and the app must never blur them:

   GATHERINGS are real. Somebody made them, with a place and an hour,
   and the people counted as coming are rows with names on them. The
   list is empty until a person starts something, and that empty is
   honest — a wall of invented clean-ups is a lie the first person to
   turn up discovers alone, by a canal, on a Saturday morning.

   SPARKS are ideas. No date, no place, nobody attending. They exist to
   answer "what could I even do?", and the screen calls them ideas.  */

const rpc = async (name, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args));
    if (error) return { ok: false, reason: 'server', detail: error.message };
    return data || { ok: false, reason: 'empty' };
  } catch (e) {
    return { ok: false, reason: 'offline', detail: (e && e.message) || '' };
  }
};

/* Everything coming up, or one country's worth. */
export async function listGatherings(country) {
  if (!SUPABASE_READY) return [];
  const { data, error } = await withDeadline(
    supabase.rpc('green_list', { p_country: country || null }),
  );
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/* The ideas. Read straight from the table — there is nothing private
   in them and nothing to decide. */
export async function listSparks(country) {
  if (!SUPABASE_READY) return [];
  let q = supabase.from('green_sparks').select('*').order('sort');
  if (country) q = q.or('country.eq.' + country + ',country.is.null');
  const { data, error } = await withDeadline(q);
  if (error) throw error;
  return data || [];
}

export const createGathering = (g) =>
  rpc('green_create', {
    p_kind: g.kind,
    p_title: g.title,
    p_about: g.about || null,
    p_country: g.country,
    p_city: g.city || null,
    p_place: g.place || null,
    p_lat: g.lat == null ? null : g.lat,
    p_lng: g.lng == null ? null : g.lng,
    p_starts_at: g.startsAt,
    p_minutes: g.minutes == null ? null : g.minutes,
    p_capacity: g.capacity == null ? null : g.capacity,
    p_language: g.language || null,
  });

export const joinGathering = (id, going) => rpc('green_join', { p_id: id, p_going: !!going });

export const cancelGathering = (id) => rpc('green_cancel', { p_id: id });

/* ── THE PHARAOH ALBUM ──────────────────────────────────────────────
   The pharaoh somebody keeps — photographed or drawn — goes to the
   room AND here, where the person running the evening can look through
   them and save the ones they want.

   The screens that call this say so first, in the player's own
   language, before anything is sent. That sentence is not decoration:
   it is the whole difference between an album and a collection
   somebody did not know they were in.

   The server refuses to hand this album to anybody but the owner, by
   policy rather than by the app hiding a button — see
   supabase/schema_v35_pharaoh_album.sql, and the test that opens it as
   a stranger. */
export const sendFaceToAlbum = (image, kind, nickname, roomId, packId) =>
  rpc('green_send_face', {
    p_image: image,
    p_kind: kind === 'drawn' ? 'drawn' : 'photo',
    p_nickname: nickname || null,
    p_room_id: roomId || null,
    p_pack_id: packId || null,
  });

export const fetchAlbum = (limit) => rpc('green_album', { p_limit: limit || 200 });

/* Taking one out. A person may remove their own; the owner may remove
   any. The row goes, not a flag on it. */
export async function removeFace(id) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  const { error } = await withDeadline(supabase.from('green_faces').delete().eq('id', id));
  if (error) return { ok: false, reason: 'server', detail: error.message };
  return { ok: true };
}

/* The title and the line under it, in the reader's language, falling
   back the same way the quiz does. */
export const sparkText = (row, lang, prefix) => {
  if (!row) return '';
  const i18n = row[prefix + '_i18n'];
  const mine = (i18n && typeof i18n === 'object' ? i18n[lang] : null) || row[prefix + '_' + lang];
  return mine || row[prefix + '_en'] || row[prefix + '_ar'] || '';
};
