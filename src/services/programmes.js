import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';

/* ─── EXCHANGES · A GROUP FOR THE ONE YOU WERE ON ────────────────────
   Ayser asked for a group per exchange programme people have actually
   attended — Erasmus and everything like it.

   A programme IS a squad. Moments already has group chats with members
   and messages and a thread that works, so joining a programme is
   joining its squad, and every chat screen already knows how to open
   it. Nothing here invents a second kind of conversation.

   The list starts empty and fills as people say where they have been.
   There is no seeded catalogue of famous programmes: a directory of
   exchanges nobody in this app went on would be a brochure, and the
   ask was the ones people were really on.                            */

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

/* The kinds, and the order they are offered in. Erasmus first because
   it is the one most people will be looking for; "something else" last
   so nobody is forced to mislabel what they went on. */
export const KINDS = [
  { id: 'erasmus',        emoji: '🇪🇺', key: 'prog_kind_erasmus' },
  { id: 'youth_exchange', emoji: '🎒', key: 'prog_kind_youth' },
  { id: 'esc',            emoji: '🤝', key: 'prog_kind_esc' },
  { id: 'training',       emoji: '📘', key: 'prog_kind_training' },
  { id: 'volunteering',   emoji: '🌱', key: 'prog_kind_volunteering' },
  { id: 'workcamp',       emoji: '🛠️', key: 'prog_kind_workcamp' },
  { id: 'study',          emoji: '🎓', key: 'prog_kind_study' },
  { id: 'other',          emoji: '🌍', key: 'prog_kind_other' },
];

export const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[KINDS.length - 1];

/* Search, or the whole list when nothing is typed. */
export const findProgrammes = (q, country, kind) =>
  rpc('programme_list', {
    p_q: q || null,
    p_country: country || null,
    p_kind: kind || null,
    p_limit: 60,
  });

export const myProgrammes = () => rpc('programme_mine', {});

/* Create-or-join, and the server decides which. The reply says
   joined_existing so the screen can tell somebody they have walked
   into a group that was already there — which is the good outcome and
   should not look like a failure to create something. */
export const addProgramme = (p) =>
  rpc('programme_add', {
    p_kind: p.kind,
    p_title: p.title,
    p_org: p.org || null,
    p_country: p.country || null,
    p_city: p.city || null,
    p_year: p.year == null ? null : Number(p.year),
  });

/* Joining and leaving are ordinary squad membership — the policies
   already say you may only add and remove yourself, so there is no
   function to go through and nothing extra to check. */
export async function joinProgramme(squadId, userId) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  const { error } = await withDeadline(
    supabase.from('squad_members').insert({ squad_id: squadId, user_id: userId }),
  );
  if (error && !/duplicate|conflict/i.test(error.message || '')) {
    return { ok: false, reason: 'server', detail: error.message };
  }
  return { ok: true };
}

export async function leaveProgramme(squadId, userId) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  const { error } = await withDeadline(
    supabase.from('squad_members').delete().eq('squad_id', squadId).eq('user_id', userId),
  );
  if (error) return { ok: false, reason: 'server', detail: error.message };
  return { ok: true };
}

/* "Erasmus Budapest · Budapest, HU · 2024" — whatever of that is
   actually known, and nothing invented to fill a gap. */
export const whereWhen = (p) => {
  if (!p) return '';
  const bits = [];
  if (p.city) bits.push(p.city);
  if (p.country) bits.push(p.country);
  const place = bits.join(', ');
  return [place, p.year ? String(p.year) : ''].filter(Boolean).join(' · ');
};
