import { supabase } from '../lib/supabase';
import { explain } from '../lib/explain';

/* ─── LANDING — the first thirty days in a European city ─────────────
   The list for where you are: what the EU guarantees no matter which
   of the twenty-seven you landed in, what this country does, and what
   this city does — each step carrying how many people have vouched
   for it, when it was last checked, and whether that was long enough
   ago to stop trusting it.

   Every rule that decides what a newcomer is shown lives in the
   database, not here (supabase/schema_v43_landing.sql). This file
   asks and renders; it does not judge. */

export const explainLanding = explain;

/* ─── WHERE THIS APPLIES ─────────────────────────────────────────────
   Landing is about arriving in the European Union: the rights it ships
   with — a basic bank account, what your EHIC does, that refusing your
   IBAN is illegal — are EU law and are simply not true elsewhere. So
   the sheet is only ever offered for a place inside it, rather than
   being shown everywhere and quietly being wrong in half the world.

   EU 27, plus the three EEA countries and Switzerland, where free
   movement and most of these rules apply too. */
const EU_ISO = {
  Austria: 'AT', Belgium: 'BE', Bulgaria: 'BG', Croatia: 'HR', Cyprus: 'CY',
  Czechia: 'CZ', 'Czech Republic': 'CZ', Denmark: 'DK', Estonia: 'EE', Finland: 'FI',
  France: 'FR', Germany: 'DE', Greece: 'GR', Hungary: 'HU', Ireland: 'IE',
  Italy: 'IT', Latvia: 'LV', Lithuania: 'LT', Luxembourg: 'LU', Malta: 'MT',
  Netherlands: 'NL', Poland: 'PL', Portugal: 'PT', Romania: 'RO', Slovakia: 'SK',
  Slovenia: 'SI', Spain: 'ES', Sweden: 'SE',
  Iceland: 'IS', Liechtenstein: 'LI', Norway: 'NO', Switzerland: 'CH',
};

/* The two-letter code for a country name as the map spells it, or null
   if the place is outside the area these rules cover. */
export const euCode = (countryName) => EU_ISO[String(countryName || '').trim()] || null;

/* Destinations carry an area like "Cluj-Napoca · Transylvania"; the
   city is the part before the separator, and a place with no area is
   its own name. */
export const cityOf = (dest) => {
  const area = String((dest && dest.area) || '').split('·')[0].trim();
  return area || String((dest && dest.name) || '').trim() || null;
};

export async function fetchArrival(country, city) {
  const { data, error } = await supabase.rpc('arrival_list', {
    p_country: country || null,
    p_city: city || null,
  });
  if (error) throw error;
  return (data || []).map((s) => ({
    id: s.id,
    scope: s.scope,
    country: s.country,
    city: s.city,
    slug: s.slug,
    title: s.title,
    body: s.body,
    sort: s.sort,
    authorId: s.author_id,
    author: s.author_name || null,
    confirms: s.confirms || 0,
    disputes: s.disputes || 0,
    lastAt: s.last_at,
    stale: !!s.stale,
    trusted: !!s.trusted,
    mine: !!s.mine,
    done: !!s.done,
  }));
}

/* One tap: still right, or it has changed — with an optional sentence,
   which is the part that turns "register your address" into something
   somebody can act on. */
export async function confirmStep(stepId, stillTrue, note) {
  const { error } = await supabase.rpc('arrival_confirm', {
    p_step: stepId, p_ok: !!stillTrue, p_note: note || null,
  });
  if (error) throw error;
}

export async function fetchStepNotes(stepId) {
  const { data, error } = await supabase.rpc('arrival_notes', { p_step: stepId });
  if (error) throw error;
  return (data || []).map((n) => ({
    name: n.name || 'Someone', note: n.note, at: n.at, stillTrue: !!n.still_true,
  }));
}

/* Ticking a step off is private, so it is fire-and-forget on purpose:
   a failed write must never stop the tick appearing. The next load
   tells the truth either way. */
export function setStepDone(stepId, done) {
  supabase.rpc('arrival_done', { p_step: stepId, p_done: !!done }).then(() => {}, () => {});
}

export async function addStep(authorId, { country, city, slug, title, body }) {
  const row = {
    scope: city ? 'city' : 'country',
    country: String(country || '').toUpperCase().slice(0, 2),
    city: city || null,
    slug: slug || 'other',
    title: title.trim(),
    body: body.trim(),
    author_id: authorId,
  };
  const { data, error } = await supabase.from('arrival_steps').insert(row).select().single();
  if (error) throw error;
  return data;
}
