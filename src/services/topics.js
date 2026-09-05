import { supabase } from '../lib/supabase';
import { suggestRooms, roomFor, FYP } from '../lib/classify';

/* ── TOPICS ─────────────────────────────────────────────────────────
   A topic is a real hashtag with a name and a home. Tap one and you
   get the moments that actually carry that tag — nothing curated by
   hand behind the scenes, nothing inflated.

   The counts are counted, not stored: "12 moments" means twelve posts
   in this database contain that tag right now. A quiet topic is
   allowed to look quiet; that is the difference between a real room
   and a poster of one. */

export const TOPIC_CATEGORIES = ['Travel', 'Lifestyle', 'Foodie', 'Learning', 'Help Me', 'Events'];

/* Our own covers: an emoji on a gradient we paint. No stock photos, so
   there is nothing here anyone can send us a letter about. */
export const TINTS = {
  violet: ['#7C3AED', '#4C1D95'],
  indigo: ['#4338CA', '#1E1B4B'],
  sky:    ['#0EA5E9', '#075985'],
  teal:   ['#0D9488', '#134E4A'],
  green:  ['#16A34A', '#14532D'],
  amber:  ['#F59E0B', '#92400E'],
  orange: ['#F97316', '#7C2D12'],
  coral:  ['#F43F5E', '#881337'],
  rose:   ['#EC4899', '#831843'],
  brown:  ['#92400E', '#451A03'],
  red:    ['#DC2626', '#7F1D1D'],
};
export const tintOf = (name) => TINTS[name] || TINTS.violet;

/* Every topic, with the real number of moments and real number of
   people behind each one. */
export async function fetchTopics() {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('sort', { ascending: true });
  if (error) return [];
  const topics = data || [];
  let counts = {};
  try {
    const { data: rows } = await supabase.rpc('topic_counts');
    (rows || []).forEach((r) => { counts[r.slug] = { moments: Number(r.moments) || 0, people: Number(r.people) || 0 }; });
  } catch (e) { counts = {}; }
  return topics.map((t) => ({
    ...t,
    moments: (counts[t.slug] && counts[t.slug].moments) || 0,
    people: (counts[t.slug] && counts[t.slug].people) || 0,
    isNew: t.created_at ? (Date.now() - new Date(t.created_at)) < 14 * 86400000 : false,
  }));
}

export async function fetchTopic(slug) {
  const { data, error } = await supabase.from('topics').select('*').eq('slug', slug).single();
  if (error) return null;
  return data;
}

/* The moments inside a topic. "Recent" is what it says. "Recommend"
   is the crowd's own answer — the ones people actually starred and
   talked about — not an editor's pick. */
export async function fetchTopicPosts(tag, mode = 'recommend', limit = 40, slug = null) {
  const clean = String(tag || '').replace(/[%_(),]/g, ' ').trim();
  if (!clean) return [];
  const flat = (rows) => (rows || []).map((r) => ({
    ...r,
    vibes: (r.vibe_rows && r.vibe_rows[0] && r.vibe_rows[0].count) || 0,
    comments: (r.comment_rows && r.comment_rows[0] && r.comment_rows[0].count) || 0,
  }));
  const cols = '*, user:profiles!posts_user_id_fkey(*), vibe_rows:post_vibes(count), comment_rows:comments(count)';

  const { data, error } = await supabase
    .from('posts').select(cols)
    .ilike('caption', '%' + clean + '%')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = flat(data);

  /* ── AND THE ONES NOBODY TAGGED ──────────────────────────────────
     "خلي الاب يحاول يعمل [يحدد] حتي للفديوز من غير هستاج من الكبشنز".

     A room used to contain exactly the posts whose caption had the
     literal hashtag in it, which is a small fraction of the posts that
     are ABOUT it — most people never write a tag. So a second pass
     reads recent captions and adds the ones this room's own words
     match, marked `guessed` so the screen can say so rather than
     pretending somebody filed them here.

     Read on the phone rather than in the database on purpose: a
     keyword list that lives in one file and can be corrected in one
     place is worth more than a faster query, at this size. */
  let guessed = [];
  if (slug) {
    const seen = new Set(rows.map((r) => r.id));
    const { data: recent } = await supabase
      .from('posts').select(cols)
      .order('created_at', { ascending: false })
      .limit(120);
    guessed = flat(recent)
      .filter((r) => !seen.has(r.id))
      .filter((r) => {
        /* the caption, not the place — see the note on roomFor in
           src/lib/classify.js */
        const hit = suggestRooms(r.caption || '', { limit: 2 });
        return hit.some((h) => h.slug === slug);
      })
      .map((r) => ({ ...r, guessed: true }));
  }

  const all = rows.concat(guessed).slice(0, limit);
  if (mode === 'recent') return all;
  return all.slice().sort((a, b) => (b.vibes + 2 * b.comments) - (a.vibes + 2 * a.comments));
}

/* ── FOR YOU — the room for everything nobody could file ─────────────
   The last resort he asked for by name: a post with no hashtag and no
   word we recognise is not left in nowhere, it goes here. It is not a
   category, it is an admission, and calling it that is the honest
   version of what every large app means by "For you". */
export async function fetchFypPosts(limit = 40) {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:profiles!posts_user_id_fkey(*), vibe_rows:post_vibes(count), comment_rows:comments(count)')
    .order('created_at', { ascending: false })
    .limit(120);
  if (error) throw error;
  return (data || [])
    .map((r) => ({
      ...r,
      vibes: (r.vibe_rows && r.vibe_rows[0] && r.vibe_rows[0].count) || 0,
      comments: (r.comment_rows && r.comment_rows[0] && r.comment_rows[0].count) || 0,
    }))
    .filter((r) => roomFor(r).slug === FYP)
    .slice(0, limit);
}

/* Pull the hashtags out of a caption so a card can offer them as
   chips — the same regex the trending algorithm uses, so a tag that
   trends is a tag you can tap. */
const HASHTAG_RE = /#[\p{L}\p{N}_]{2,30}/gu;
export const hashtagsIn = (text) => Array.from(new Set(String(text || '').match(HASHTAG_RE) || []));
