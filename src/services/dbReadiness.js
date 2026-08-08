import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── WHAT THE DATABASE STILL NEEDS ───────────────────────────────────
   Several features degrade quietly when the database has not been given
   somewhere to keep their data. Each one degrades HONESTLY — a travel
   plan says it went up as an ordinary moment, a reel says the audience
   setting is not switched on — but a person reading those one at a time,
   weeks apart, has no way to see that they all have the same single
   cause and the same single fix.

   This asks the database directly, feature by feature, and says which
   ones are asleep. It is shown in the owner's panel and nowhere else:
   what a database is missing is not something anybody else should be
   made to read about.

   Nothing here writes. Each probe asks for one column, one row, and is
   thrown away.                                                        */

const CHECKS = [
  {
    id: 'plan',
    label: 'Travel plans',
    what: 'A plan posts as an ordinary moment instead of a travel card.',
    table: 'posts',
    column: 'plan',
  },
  {
    id: 'close_only',
    label: 'Close Friends on a post',
    what: 'Choosing who can see a reel has nowhere to be saved.',
    table: 'posts',
    column: 'close_only',
  },
  {
    id: 'thumb_url',
    label: 'Video thumbnails',
    what: 'A posted reel shows as a blank tile in the profile grid.',
    table: 'posts',
    column: 'thumb_url',
  },
  {
    id: 'theme_pref',
    label: 'Settings that follow the account',
    what: 'Dark mode and the message timer stay on one phone.',
    table: 'profiles',
    column: 'theme_pref',
  },
  {
    id: 'bardi_chats',
    label: "Bardi's chat history across devices",
    what: 'The conversation is kept on the device only.',
    table: 'bardi_chats',
    column: 'user_id',
  },
  {
    id: 'groups',
    label: 'Groups',
    what: 'Create a group does nothing at all — there is no table to put one in.',
    table: 'groups',
    column: 'id',
  },
  {
    id: 'groups_with_counts',
    label: 'Group member counts',
    what: 'Groups cannot be listed, so Discover → Groups comes back empty.',
    table: 'groups_with_counts',
    column: 'members_count',
  },
];

/* ── THE ONE THAT IS NOT A COLUMN ─────────────────────────────────
   The storage bucket has a size limit of its own, and it is what turned
   a 120MB clip into "Could not start the upload (HTTP 413)" — the very
   thing that started all of this. It belongs on this list more than
   anything else on it. It is not a table, so it is asked a different
   way: the bucket itself is asked how big a file it takes. */
const MIN_BUCKET = 200 * 1024 * 1024;

async function probeBucket() {
  const base = {
    id: 'bucket',
    label: 'Big video uploads',
    what: 'A long clip is refused before it is sent, however small the app makes it.',
  };
  try {
    const { data, error } = await supabase.storage.getBucket('media');
    if (error || !data) return { ...base, state: 'unknown', detail: (error && error.message) || 'the bucket did not answer' };
    const limit = data.file_size_limit;
    if (limit == null) return { ...base, state: 'ready' };     // no limit set at all
    if (limit >= MIN_BUCKET) return { ...base, state: 'ready' };
    return {
      ...base,
      state: 'missing',
      what: 'The bucket takes ' + Math.round(limit / 1048576) + 'MB at most, so anything larger is refused before it is sent.',
    };
  } catch (e) {
    return { ...base, state: 'unknown', detail: (e && e.message) || 'no answer' };
  }
}

/* One probe. A missing table and a missing column both come back as an
   error we can read; anything else — no connection, a refused request —
   is not an answer, and saying "not switched on" would be a guess. */
async function probe(check) {
  try {
    const { error } = await supabase.from(check.table).select(check.column).limit(1);
    if (!error) return { ...check, state: 'ready' };
    const msg = String((error && error.message) || '').toLowerCase();
    if (/does not exist|could not find|schema cache|relation/.test(msg)) {
      return { ...check, state: 'missing' };
    }
    return { ...check, state: 'unknown', detail: error.message };
  } catch (e) {
    return { ...check, state: 'unknown', detail: (e && e.message) || 'no answer' };
  }
}

export async function checkDatabase() {
  if (!SUPABASE_READY) return [];
  return Promise.all(CHECKS.map(probe).concat([probeBucket()]));
}
