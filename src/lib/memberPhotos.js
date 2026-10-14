import { supabase, SUPABASE_READY } from './supabase';
import { activityOf } from './activityMatch';

/* ─── MEMBERS' OWN PICTURES ON THE PLANS ──────────────────────────────
   Ayser: "خلي صورة مدحت تبقى ظاهرة في صور حجز ملعب الكورة بما إنه منزّل
   صورته هناك — وأي حد يعمل زيه". A moment somebody posted publicly on
   Moments, at a pitch, a padel court, a walk…, joins the pictures of
   that activity's plans, first, with their name on it. Only photos
   (no videos), only public posts the database already lets anybody
   signed in read, and fetched once per session for every card. */

const VIDEO = /\.(mp4|mov|webm|m4v)(\?|$)/i;
let byAct = null;
let loading = null;
const subs = new Set();

export function loadMemberPhotos() {
  if (byAct || loading || !SUPABASE_READY) return loading;
  const since = new Date(Date.now() - 180 * 86400000).toISOString();
  loading = supabase.from('posts')
    .select('id, type, media_url, caption, place, user:profiles!posts_user_id_fkey(name)')
    .not('type', 'in', '(reel,vod,travel)').not('media_url', 'is', null).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(200)
    .then(({ data }) => {
      const map = {};
      (data || []).forEach((p) => {
        const url = String(p.media_url || '');
        if (!/^https:\/\//i.test(url) || VIDEO.test(url)) return;
        const act = activityOf([p.place, p.caption].filter(Boolean).join(' '));
        if (!act) return;
        const list = map[act.id] || (map[act.id] = []);
        if (list.length < 4) list.push({ img: 'post-' + p.id, url, credit: '📸 ' + String((p.user && p.user.name) || '').trim(), member: true });
      });
      byAct = map;
    })
    .catch(() => { byAct = {}; })
    .then(() => { loading = null; subs.forEach((fn) => { try { fn(); } catch (e) {} }); });
  return loading;
}

export const memberPhotosFor = (actId) => (byAct && byAct[actId]) || [];
export const memberPhotosReady = () => !!byAct;
export function onMemberPhotos(fn) { subs.add(fn); return () => subs.delete(fn); }
