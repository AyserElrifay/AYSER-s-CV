import { supabase } from '../lib/supabase';

/* ── ADS · Paid Boost + the Feedback Factor ───────────────────
   Three ad products, all shown clearly as "Sponsored":
     - top_search        → first result in Search
     - promoted_pin      → highlighted pin on the Map
     - featured_collection → a spot in a curated collection
   The Feedback Factor rewards quality: a highly-rated place pays LESS
   per click; a badly-rated one pays MORE, and below the floor it's
   blocked from advertising until it improves. */

export const AD_PRODUCTS = [
  { id: 'top_search',          emoji: '🔝', name: 'Top of Search',      desc: 'First result when people search your category', base: 5 },
  { id: 'promoted_pin',        emoji: '📍', name: 'Promoted Pin',       desc: 'A highlighted, always-visible pin on the map',  base: 4 },
  { id: 'featured_collection', emoji: '✨', name: 'Featured Collection', desc: 'A slot in a curated “Best of” collection',      base: 6 },
];

/* The core of the Feedback Factor. Returns the multiplier applied to
   the base CPC, or `blocked:true` when the rating is too low to run
   ads at all. New places (no reviews) run at a neutral 1.0×. */
export function feedbackFactor(rating, ratingCount) {
  if (!ratingCount || ratingCount < 3) return { mult: 1.0, label: 'New — standard rate', blocked: false };
  if (rating < 2.0) return { mult: null, label: 'Rating too low to advertise — improve reviews first', blocked: true };
  if (rating < 3.0) return { mult: 1.6, label: 'Low rating — higher cost until reviews improve', blocked: false };
  if (rating < 4.0) return { mult: 1.0, label: 'Standard rate', blocked: false };
  if (rating < 4.5) return { mult: 0.8, label: 'Good rating — 20% cheaper clicks', blocked: false };
  return { mult: 0.6, label: 'Loved by the community — 40% cheaper clicks', blocked: false };
}

export function quoteBoost(product, rating, ratingCount) {
  const p = AD_PRODUCTS.find((x) => x.id === product) || AD_PRODUCTS[0];
  const f = feedbackFactor(rating, ratingCount);
  return {
    blocked: f.blocked,
    label: f.label,
    baseCpc: p.base,
    cpc: f.blocked ? null : Number((p.base * f.mult).toFixed(2)),
  };
}

export async function createBoost({ venueId, ownerId, product, budget, currency, cpc, provider }) {
  const { data, error } = await supabase
    .from('boosts')
    .insert({ venue_id: venueId, owner_id: ownerId, product, budget, currency, cpc, provider })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Live boosts for a product, so Search / Map can surface Sponsored items
   at the top (most recent active first). */
export async function fetchActiveBoosts(product) {
  const { data, error } = await supabase
    .from('boosts')
    .select('*, venue:venues(*)')
    .eq('product', product)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
