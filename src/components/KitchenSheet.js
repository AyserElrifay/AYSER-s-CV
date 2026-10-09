import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import {
  fetchMenu, placeOrder, setOrderStatus, fetchMyOrders, fetchMyKitchen, saveKitchen, saveDish,
} from '../services/kitchen';

/* ─── مطبخ البيت · HOME KITCHENS ──────────────────────────────────────
   Ayser: "زود توصيل وطلب أكل اورجنك مش مضر للبيئة اكل بيتي".

   Three tabs and nothing else: what you can order, what you ordered,
   and your own kitchen if you cook. Every promise on the card is the
   cook's own words, labelled as such — "organic" is a protected word
   in Europe and nobody here inspects a kitchen. What the app can vouch
   for it shows plainly: portions left that day, when orders close, and
   whether the food comes in containers that come back.

   Cash on delivery. No card details pass through this app until a real
   payment provider is connected in Ayser's name. */

const GREEN = '#1F7A5A';
const DAY_KEYS = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'];

const dayLabel = (iso, lang) => {
  try { return new Date(iso + 'T12:00:00').toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch (e) { return iso; }
};
const money = (n, cur) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + (cur || 'EGP');

const Pill = ({ on, children, onPress, disabled }) => (
  <Pressable onPress={disabled ? undefined : onPress} style={{ marginEnd: 8, marginBottom: 8, opacity: disabled ? 0.4 : 1 }}>
    <View style={{ backgroundColor: on ? GREEN : C.glass, borderWidth: 1, borderColor: on ? GREEN : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 12.5, fontWeight: '800' }}>{children}</Text>
    </View>
  </Pressable>
);

const Field = ({ label, ...props }) => (
  <View style={{ marginBottom: 12 }}>
    {label ? <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', marginBottom: 5 }}>{label}</Text> : null}
    <TextInput placeholderTextColor={C.faint} {...props}
      style={[{ color: C.text, fontSize: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, props.style]} />
  </View>
);

const Toggle = ({ label, value, onValueChange }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
    <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1, minWidth: 0 }}>{label}</Text>
    <Switch value={!!value} onValueChange={onValueChange} trackColor={{ true: GREEN }} />
  </View>
);

const Btn = ({ label, onPress, busy, ghost, small }) => (
  <Pressable onPress={busy ? undefined : onPress}>
    <View style={{ backgroundColor: ghost ? 'transparent' : GREEN, borderWidth: ghost ? 1 : 0, borderColor: C.line, borderRadius: 999,
      paddingVertical: small ? 8 : 13, paddingHorizontal: small ? 14 : 18, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
      <Text style={{ color: ghost ? C.text : '#FFF', fontSize: small ? 12.5 : 14.5, fontWeight: '900' }}>{label}</Text>
    </View>
  </Pressable>
);

const STATUS_COLOR = { placed: '#B45309', accepted: '#1D4ED8', ready: GREEN, done: '#6B7280', declined: '#B91C1C', cancelled: '#6B7280' };

export const KitchenSheet = ({ onClose, startTab = 'food' }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [tab, setTab] = useState(startTab);

  const [menu, setMenu] = useState(null);
  const [orders, setOrders] = useState(null);
  const [kitchen, setKitchen] = useState(undefined);  // undefined = loading, null = none
  const [ordering, setOrdering] = useState(null);     // the order form
  const [editK, setEditK] = useState(null);           // the kitchen form
  const [editD, setEditD] = useState(null);           // the dish form
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const offline = !SUPABASE_READY || !user;

  const loadMenu = useCallback(() => { if (offline) { setMenu([]); return; } fetchMenu('EG').then(setMenu, () => setMenu([])); }, [offline]);
  const loadOrders = useCallback(() => { if (offline) { setOrders([]); return; } fetchMyOrders(user.id).then(setOrders, () => setOrders([])); }, [offline, user]);
  const loadKitchen = useCallback(() => { if (offline) { setKitchen(null); return; } fetchMyKitchen(user.id).then(setKitchen, () => setKitchen(null)); }, [offline, user]);

  useEffect(() => { if (tab === 'food') loadMenu(); else if (tab === 'orders') loadOrders(); else loadKitchen(); }, [tab, loadMenu, loadOrders, loadKitchen]);

  const why = (r) => t('food_err_' + ((r && r.reason) || 'server'));

  /* ── ordering ── */
  const startOrder = (d) => {
    tapMedium();
    const first = (d.next_days || []).find((x) => x.left > 0);
    setOrdering({ dish: d, date: first ? first.date : null, qty: 1, delivery: false, address: '', phone: '', ownBox: false, note: '', err: null });
  };
  const submitOrder = async () => {
    const o = ordering; if (!o || busy) return;
    setBusy(true);
    const r = await placeOrder({ dishId: o.dish.id, date: o.date, qty: o.qty, delivery: o.delivery, address: o.address, phone: o.phone, ownBox: o.ownBox, note: o.note });
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setOrdering(null); setMsg(t('food_ordered')); setTab('orders'); loadMenu(); }
    else setOrdering((x) => ({ ...x, err: why(r) }));
  };

  const move = async (o, status) => {
    tapLight();
    const r = await setOrderStatus(o.id, status);
    if (r && r.ok) { if (tab === 'orders') loadOrders(); else loadKitchen(); }
    else setMsg(why(r));
  };

  /* ── your kitchen ── */
  const submitKitchen = async () => {
    if (busy || !editK) return;
    if (!editK.name || editK.name.trim().length < 2) { setEditK((k) => ({ ...k, err: t('food_err_name') })); return; }
    setBusy(true);
    try { await saveKitchen(user.id, editK); tapSuccess(); setEditK(null); loadKitchen(); }
    catch (e) { setEditK((k) => ({ ...k, err: t('food_err_server') })); }
    setBusy(false);
  };
  const submitDish = async () => {
    if (busy || !editD || !kitchen) return;
    if (!editD.title || editD.title.trim().length < 2 || !(Number(editD.price) >= 0) || !editD.days.length) {
      setEditD((d) => ({ ...d, err: t('food_err_dish') })); return;
    }
    setBusy(true);
    try { await saveDish(kitchen.id, editD); tapSuccess(); setEditD(null); loadKitchen(); }
    catch (e) { setEditD((d) => ({ ...d, err: t('food_err_server') })); }
    setBusy(false);
  };

  const total = ordering ? ordering.qty * Number(ordering.dish.price) + (ordering.delivery ? Number(ordering.dish.delivery_fee) || 0 : 0) : 0;

  const byDate = useMemo(() => {
    const m = new Map();
    ((kitchen && kitchen.orders) || []).forEach((o) => { const a = m.get(o.for_date) || []; a.push(o); m.set(o.for_date, a); });
    return [...m.entries()];
  }, [kitchen]);

  /* a function, not a component: one built inside the render would be a
     new component every render and lose its state each time */
  const orderRow = (o, asCook) => (
    <View key={o.id} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', flex: 1, minWidth: 0 }} numberOfLines={1}>
          {o.qty} × {o.dish ? o.dish.title : ''}
        </Text>
        <Text style={{ color: STATUS_COLOR[o.status] || C.dim, fontSize: 12, fontWeight: '900' }}>{t('food_st_' + o.status)}</Text>
      </View>
      <Text style={{ color: C.faint, fontSize: 12, marginTop: 3 }} numberOfLines={2}>
        {dayLabel(o.for_date, lang)} · {o.delivery ? t('food_delivery') : t('food_pickup')}
        {asCook ? ' · ' + ((o.buyer && o.buyer.name) || '') + ' · ' + (o.phone || '') : ' · ' + ((o.kitchen && o.kitchen.name) || '')}
      </Text>
      {asCook && o.delivery && o.address ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }}>{o.address}</Text> : null}
      {o.own_box ? <Text style={{ color: GREEN, fontSize: 12, fontWeight: '800', marginTop: 3 }}>♻︎ {t('food_own_box_yes')}</Text> : null}
      {o.note ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }}>“{o.note}”</Text> : null}
      <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6 }}>
        {money(o.qty * Number(o.unit_price) + Number(o.delivery_fee || 0), o.kitchen && o.kitchen.currency)} · {t('food_cash')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {asCook && o.status === 'placed' ? (<>
          <View style={{ marginEnd: 8 }}><Btn small label={t('food_accept')} onPress={() => move(o, 'accepted')} /></View>
          <Btn small ghost label={t('food_decline')} onPress={() => move(o, 'declined')} />
        </>) : null}
        {asCook && o.status === 'accepted' ? <Btn small label={t('food_mark_ready')} onPress={() => move(o, 'ready')} /> : null}
        {asCook && o.status === 'ready' ? <Btn small label={t('food_mark_done')} onPress={() => move(o, 'done')} /> : null}
        {!asCook && o.status === 'placed' ? <Btn small ghost label={t('food_cancel')} onPress={() => move(o, 'cancelled')} /> : null}
      </View>
    </View>
  );

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 }}>
          <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', marginStart: 10 }}>{t('food_title')}</Text>
        </View>
        <Text style={{ color: C.dim, fontSize: 13, paddingHorizontal: 16, marginBottom: 10 }}>{t('food_tagline')}</Text>

        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 6 }}>
          {[['food', t('food_tab_food')], ['orders', t('food_tab_orders')], ['kitchen', t('food_tab_kitchen')]].map(([k, l]) => (
            <Pill key={k} on={tab === k} onPress={() => { tapLight(); setMsg(null); setTab(k); }}>{l}</Pill>
          ))}
        </View>
        {msg ? <Text style={{ color: GREEN, fontSize: 13, fontWeight: '800', paddingHorizontal: 16, marginBottom: 6 }}>{msg}</Text> : null}

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
          {tab === 'food' ? (
            menu === null ? <ActivityIndicator color={GREEN} style={{ marginTop: 30 }} />
            : menu.length === 0 ? (
              <View style={{ borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', borderRadius: 18, padding: 20, alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', textAlign: 'center' }}>{offline ? t('lamma_conn_hint') : t('food_none')}</Text>
                {!offline ? <View style={{ marginTop: 12 }}><Btn small label={t('food_open_kitchen')} onPress={() => setTab('kitchen')} /></View> : null}
              </View>
            ) : menu.map((d) => (
              <View key={d.id} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{d.title}{d.veg ? '  🌱' : ''}</Text>
                    <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
                      {d.kitchen_name}{d.area ? ' · ' + d.area : ''}{d.city ? ' · ' + d.city : ''}
                    </Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{money(d.price, d.currency)}</Text>
                </View>
                {d.about ? <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{d.about}</Text> : null}
                {d.how_we_cook ? (
                  <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 8 }}>
                    <Text style={{ color: C.faint, fontWeight: '800' }}>{t('food_cook_says')} </Text>“{d.how_we_cook}”
                  </Text>
                ) : null}
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 8 }}>
                  {d.reusable ? '♻︎ ' + t('food_reusable') + ' · ' : ''}
                  {d.delivers ? t('food_delivers') + ' ' + money(d.delivery_fee, d.currency) : t('food_pickup_only')}
                  {' · '}{t('food_order_by')} {String(d.order_by_hour).padStart(2, '0')}:00 {t('food_day_before')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ color: C.faint, fontSize: 12, flex: 1, minWidth: 0 }} numberOfLines={1}>
                    {(d.next_days || []).filter((x) => x.left > 0).length
                      ? (d.next_days || []).filter((x) => x.left > 0).slice(0, 3).map((x) => dayLabel(x.date, lang) + ' (' + x.left + ')').join(' · ')
                      : t('food_full_week')}
                  </Text>
                  {user && d.owner_id !== user.id && (d.next_days || []).some((x) => x.left > 0)
                    ? <Btn small label={t('food_order')} onPress={() => startOrder(d)} /> : null}
                </View>
              </View>
            ))
          ) : null}

          {tab === 'orders' ? (
            orders === null ? <ActivityIndicator color={GREEN} style={{ marginTop: 30 }} />
            : orders.length === 0 ? <Text style={{ color: C.dim, fontSize: 14, textAlign: 'center', marginTop: 20 }}>{t('food_no_orders')}</Text>
            : orders.map((o) => orderRow(o, false))
          ) : null}

          {tab === 'kitchen' ? (
            kitchen === undefined ? <ActivityIndicator color={GREEN} style={{ marginTop: 30 }} />
            : kitchen === null ? (
              <View>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginBottom: 6 }}>{t('food_open_kitchen')}</Text>
                <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>{t('food_open_sub')}</Text>
                <Btn label={t('food_open_kitchen')} onPress={() => setEditK({ name: '', area: '', city: 'Cairo', how_we_cook: '', delivers: false, delivery_fee: '0', delivery_note: '', reusable: false, open: true })} />
              </View>
            ) : (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{kitchen.name}</Text>
                    <Text style={{ color: C.faint, fontSize: 12 }}>{kitchen.open ? t('food_open_now') : t('food_closed_now')}</Text>
                  </View>
                  <Btn small ghost label={t('food_edit')} onPress={() => setEditK({ ...kitchen, delivery_fee: String(kitchen.delivery_fee) })} />
                </View>

                <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>{t('food_incoming')}</Text>
                {byDate.length === 0 ? <Text style={{ color: C.dim, fontSize: 13, marginBottom: 14 }}>{t('food_no_incoming')}</Text>
                  : byDate.map(([date, list]) => (
                    <View key={date} style={{ marginBottom: 6 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '900', marginBottom: 6 }}>{dayLabel(date, lang)}</Text>
                      {list.map((o) => orderRow(o, true))}
                    </View>
                  ))}

                <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 10, marginBottom: 8 }}>{t('food_your_dishes')}</Text>
                {kitchen.dishes.map((d) => (
                  <Pressable key={d.id} onPress={() => setEditD({ ...d, price: String(d.price), portions_per_day: String(d.portions_per_day), order_by_hour: String(d.order_by_hour) })}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 10, opacity: d.active ? 1 : 0.5 }}>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', flex: 1, minWidth: 0 }} numberOfLines={1}>{d.title}</Text>
                      <Text style={{ color: C.dim, fontSize: 13 }}>{money(d.price, kitchen.currency)} · {d.portions_per_day}/{t('food_per_day')}</Text>
                    </View>
                  </Pressable>
                ))}
                <View style={{ marginTop: 12 }}>
                  <Btn label={t('food_add_dish')} onPress={() => setEditD({ title: '', about: '', price: '', portions_per_day: '10', days: [0, 1, 2, 3, 4, 6], order_by_hour: '20', veg: false, active: true })} />
                </View>
              </View>
            )
          ) : null}
        </ScrollView>
      </View>

      {/* ── THE ORDER FORM ── */}
      {ordering ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setOrdering(null)}>
          <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
              <Pressable onPress={() => setOrdering(null)} hitSlop={10}><Ionicons name="close" size={25} color={C.text} /></Pressable>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginStart: 12, flex: 1, minWidth: 0 }} numberOfLines={1}>{ordering.dish.title}</Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', marginBottom: 6 }}>{t('food_which_day')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(ordering.dish.next_days || []).map((x) => (
                  <Pill key={x.date} on={ordering.date === x.date} disabled={x.left <= 0}
                    onPress={() => setOrdering((o) => ({ ...o, date: x.date, qty: Math.min(o.qty, Math.max(1, x.left)) }))}>
                    {dayLabel(x.date, lang)} ({x.left})
                  </Pill>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{t('food_how_many')}</Text>
                <Pressable onPress={() => setOrdering((o) => ({ ...o, qty: Math.max(1, o.qty - 1) }))} hitSlop={8}><Ionicons name="remove-circle-outline" size={28} color={GREEN} /></Pressable>
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginHorizontal: 14 }}>{ordering.qty}</Text>
                <Pressable onPress={() => setOrdering((o) => {
                  const day = (o.dish.next_days || []).find((x) => x.date === o.date);
                  return { ...o, qty: Math.min(o.qty + 1, day ? day.left : 1, 20) };
                })} hitSlop={8}><Ionicons name="add-circle-outline" size={28} color={GREEN} /></Pressable>
              </View>
              {ordering.dish.delivers ? (
                <Toggle label={t('food_deliver_to_me') + ' (+' + money(ordering.dish.delivery_fee, ordering.dish.currency) + ')'}
                  value={ordering.delivery} onValueChange={(v) => setOrdering((o) => ({ ...o, delivery: v }))} />
              ) : <Text style={{ color: C.dim, fontSize: 13, marginBottom: 12 }}>{t('food_pickup_only')}{ordering.dish.area ? ' · ' + ordering.dish.area : ''}</Text>}
              {ordering.delivery ? <Field label={t('food_address')} value={ordering.address} onChangeText={(v) => setOrdering((o) => ({ ...o, address: v }))} multiline /> : null}
              <Field label={t('food_phone')} value={ordering.phone} keyboardType="phone-pad" onChangeText={(v) => setOrdering((o) => ({ ...o, phone: v }))} />
              <Toggle label={'♻︎ ' + t('food_own_box')} value={ordering.ownBox} onValueChange={(v) => setOrdering((o) => ({ ...o, ownBox: v }))} />
              <Field label={t('food_note')} value={ordering.note} onChangeText={(v) => setOrdering((o) => ({ ...o, note: v }))} />
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginVertical: 8 }}>{t('food_total')}: {money(total, ordering.dish.currency)}</Text>
              <Text style={{ color: C.dim, fontSize: 12.5, marginBottom: 12 }}>{t('food_cash_note')}</Text>
              {ordering.err ? <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginBottom: 10 }}>{ordering.err}</Text> : null}
              <Btn label={t('food_place_order')} busy={busy} onPress={submitOrder} />
            </ScrollView>
          </View>
        </Modal>
      ) : null}

      {/* ── YOUR KITCHEN ── */}
      {editK ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEditK(null)}>
          <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
              <Pressable onPress={() => setEditK(null)} hitSlop={10}><Ionicons name="close" size={25} color={C.text} /></Pressable>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginStart: 12 }}>{t('food_your_kitchen')}</Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
              <Field label={t('food_k_name')} value={editK.name} onChangeText={(v) => setEditK((k) => ({ ...k, name: v }))} />
              <Field label={t('food_k_area')} value={editK.area || ''} onChangeText={(v) => setEditK((k) => ({ ...k, area: v }))} />
              <Field label={t('food_k_city')} value={editK.city || ''} onChangeText={(v) => setEditK((k) => ({ ...k, city: v }))} />
              <Field label={t('food_k_how')} value={editK.how_we_cook || ''} multiline placeholder={t('food_k_how_ph')}
                onChangeText={(v) => setEditK((k) => ({ ...k, how_we_cook: v }))} />
              <Toggle label={'♻︎ ' + t('food_k_reusable')} value={editK.reusable} onValueChange={(v) => setEditK((k) => ({ ...k, reusable: v }))} />
              <Toggle label={t('food_k_delivers')} value={editK.delivers} onValueChange={(v) => setEditK((k) => ({ ...k, delivers: v }))} />
              {editK.delivers ? (<>
                <Field label={t('food_k_fee')} value={String(editK.delivery_fee)} keyboardType="decimal-pad" onChangeText={(v) => setEditK((k) => ({ ...k, delivery_fee: v }))} />
                <Field label={t('food_k_where')} value={editK.delivery_note || ''} onChangeText={(v) => setEditK((k) => ({ ...k, delivery_note: v }))} />
              </>) : null}
              {editK.id ? <Toggle label={t('food_k_open')} value={editK.open} onValueChange={(v) => setEditK((k) => ({ ...k, open: v }))} /> : null}
              <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>{t('food_k_rules')}</Text>
              {editK.err ? <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginBottom: 10 }}>{editK.err}</Text> : null}
              <Btn label={t('food_save')} busy={busy} onPress={submitKitchen} />
            </ScrollView>
          </View>
        </Modal>
      ) : null}

      {/* ── A DISH ── */}
      {editD ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEditD(null)}>
          <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
              <Pressable onPress={() => setEditD(null)} hitSlop={10}><Ionicons name="close" size={25} color={C.text} /></Pressable>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginStart: 12 }}>{t('food_add_dish')}</Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
              <Field label={t('food_d_title')} value={editD.title} onChangeText={(v) => setEditD((d) => ({ ...d, title: v }))} />
              <Field label={t('food_d_about')} value={editD.about || ''} multiline onChangeText={(v) => setEditD((d) => ({ ...d, about: v }))} />
              <Field label={t('food_d_price') + ' (' + ((kitchen && kitchen.currency) || 'EGP') + ')'} value={editD.price} keyboardType="decimal-pad" onChangeText={(v) => setEditD((d) => ({ ...d, price: v }))} />
              <Field label={t('food_d_portions')} value={editD.portions_per_day} keyboardType="number-pad" onChangeText={(v) => setEditD((d) => ({ ...d, portions_per_day: v }))} />
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', marginBottom: 6 }}>{t('food_d_days')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                {[6, 0, 1, 2, 3, 4, 5].map((n) => (
                  <Pill key={n} on={editD.days.includes(n)}
                    onPress={() => setEditD((d) => ({ ...d, days: d.days.includes(n) ? d.days.filter((x) => x !== n) : d.days.concat(n) }))}>
                    {t(DAY_KEYS[n])}
                  </Pill>
                ))}
              </View>
              <Field label={t('food_d_by')} value={editD.order_by_hour} keyboardType="number-pad" onChangeText={(v) => setEditD((d) => ({ ...d, order_by_hour: v }))} />
              <Toggle label={'🌱 ' + t('food_d_veg')} value={editD.veg} onValueChange={(v) => setEditD((d) => ({ ...d, veg: v }))} />
              {editD.id ? <Toggle label={t('food_d_active')} value={editD.active} onValueChange={(v) => setEditD((d) => ({ ...d, active: v }))} /> : null}
              {editD.err ? <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginBottom: 10 }}>{editD.err}</Text> : null}
              <Btn label={t('food_save')} busy={busy} onPress={submitDish} />
            </ScrollView>
          </View>
        </Modal>
      ) : null}
    </Modal>
  );
};
