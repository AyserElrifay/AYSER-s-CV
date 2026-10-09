import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';

/* ─── HOME KITCHENS ───────────────────────────────────────────────────
   Home-cooked food from a neighbour's kitchen. Every rule that matters
   — portions left, the order deadline, who may move an order along —
   is enforced by the database (supabase/RUN_ME.sql, HOME KITCHENS), so
   a phone can only ask. Cash on delivery: no card details pass through
   this app until a payment provider is connected. */

const rpc = async (name, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args));
    if (error) return { ok: false, reason: 'server' };
    return data == null ? { ok: false, reason: 'empty' } : data;
  } catch (e) { return { ok: false, reason: 'offline' }; }
};

export async function fetchMenu(country = 'EG') {
  if (!SUPABASE_READY) return [];
  const { data, error } = await withDeadline(supabase.rpc('food_menu', { p_country: country, p_city: null }));
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export const placeOrder = (o) => rpc('food_order', {
  p_dish: o.dishId, p_date: o.date, p_qty: o.qty, p_delivery: !!o.delivery,
  p_address: o.address || null, p_phone: o.phone || null, p_own_box: !!o.ownBox, p_note: o.note || null,
});

export const setOrderStatus = (id, status) => rpc('food_set_status', { p_id: id, p_status: status });

const ORDER_COLS = '*, dish:dishes(title, price), kitchen:kitchens(name, area, owner_id, currency), buyer:profiles!food_orders_buyer_id_fkey(name)';

export async function fetchMyOrders(userId) {
  if (!SUPABASE_READY || !userId) return [];
  const { data, error } = await withDeadline(
    supabase.from('food_orders').select(ORDER_COLS).eq('buyer_id', userId).order('created_at', { ascending: false }).limit(50));
  if (error) throw error;
  return data || [];
}

export async function fetchMyKitchen(userId) {
  if (!SUPABASE_READY || !userId) return null;
  const { data, error } = await withDeadline(supabase.from('kitchens').select('*').eq('owner_id', userId).limit(1));
  if (error) throw error;
  const k = (data || [])[0] || null;
  if (!k) return null;
  const [dishes, orders] = await Promise.all([
    withDeadline(supabase.from('dishes').select('*').eq('kitchen_id', k.id).order('created_at')),
    withDeadline(supabase.from('food_orders').select(ORDER_COLS).eq('kitchen_id', k.id)
      .gte('for_date', new Date(Date.now() - 86400000).toISOString().slice(0, 10))
      .order('for_date').order('created_at')),
  ]);
  return { ...k, dishes: dishes.data || [], orders: orders.data || [] };
}

export async function saveKitchen(userId, k) {
  const row = {
    owner_id: userId, name: k.name, about: k.about || null, how_we_cook: k.how_we_cook || null,
    country: k.country || 'EG', city: k.city || null, area: k.area || null,
    delivers: !!k.delivers, delivery_fee: Number(k.delivery_fee) || 0, delivery_note: k.delivery_note || null,
    currency: k.currency || 'EGP', reusable: !!k.reusable, open: k.open !== false,
  };
  const q = k.id ? supabase.from('kitchens').update(row).eq('id', k.id).select().single()
                 : supabase.from('kitchens').insert(row).select().single();
  const { data, error } = await withDeadline(q);
  if (error) throw error;
  return data;
}

export async function saveDish(kitchenId, d) {
  const row = {
    kitchen_id: kitchenId, title: d.title, about: d.about || null, price: Number(d.price) || 0,
    portions_per_day: Math.max(1, parseInt(d.portions_per_day, 10) || 1), days: d.days,
    order_by_hour: Math.min(23, Math.max(0, parseInt(d.order_by_hour, 10) || 12)), veg: !!d.veg, active: d.active !== false,
  };
  const q = d.id ? supabase.from('dishes').update(row).eq('id', d.id).select().single()
                 : supabase.from('dishes').insert(row).select().single();
  const { data, error } = await withDeadline(q);
  if (error) throw error;
  return data;
}
