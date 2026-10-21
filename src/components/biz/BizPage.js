import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator, Linking, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/theme';
import { placePage, checkIn, redeem, askPlace, cancelAsk, directory } from '../../services/biz';
import { lazyOverlay } from '../../lib/lazyScreen';
const GreenSheet = lazyOverlay(() => import('../green/GreenSheet').then((m) => ({ default: m.GreenSheet })));
import { bw, dealLine, dealWhen, fill, typeOf, tname, INCLUDES, TYPES } from './words';
import { tapLight, tapSelection, tapSuccess } from '../../utils/feedback';
import { useSheetBack } from '../../hooks/useSheetBack';
import { publicMedia } from '../../lib/publicMedia';
import { openPartner } from '../../lib/partnerLink';

/* ─── A PLACE ON MOMENTS, AS PEOPLE SEE IT ────────────────────────────
   Photos, a few lines, what the place's kind needs you to know, and the
   three things you can do: check in at the counter (stamps), ask for a
   stay / table / group visit, or start a plan there. The guest count is
   people who really checked in. */

const ERR = { code: 'e_code', slow_down: 'e_slow', yours: 'e_yours', date: 'e_date', setup: 'e_setup', offline: 'e_offline', not_yet: 'not_yet' };
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export const BizPage = ({ id, lang, onClose, autoCode }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const B = (k) => bw(lang, k);
  const [p, setP] = useState(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [plan, setPlan] = useState(false);
  const tomorrow = new Date(Date.now() + 86400000);
  const [q, setQ] = useState({ from: iso(tomorrow), to: '', people: '4', note: '' });
  const W = Math.min(Dimensions.get('window').width, 520) - 36;

  const load = () => placePage(id).then((r) => setP(r && r.ok ? r : { gone: true }));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setMsg({ ok: true, t: typeof ok === 'function' ? ok(r) : ok }); load(); return true; }
    setMsg({ ok: false, t: B(ERR[r && r.reason] || 'e_err') });
    return false;
  };

  /* scanned the counter's QR: checked in as soon as the page is here */
  const autoDone = React.useRef(false);
  useEffect(() => {
    if (!autoCode || autoDone.current || !p || p.gone) return;
    autoDone.current = true;
    run(() => checkIn(p.id, autoCode), (r) => (r.deal ? fill(B('deal_got'), { pct: r.deal }) : B('checked')));
  }, [p && p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <Modal visible onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.purple} /><Pressable onPress={onClose} style={{ marginTop: 20 }} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={26} color={C.text} /></Pressable></View></Modal>;
  const ty = typeOf(p.type);
  const d = p.details || {};
  const stamps = Math.max(0, p.my_stamps || 0);
  const priceLabel = ty.fields.includes('price_night') ? 'price_night' : ty.fields.includes('price_pp') ? 'price_pp' : 'price_from';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          {p.gone ? <Text style={{ color: C.dim, fontSize: 14.5, marginTop: 30, textAlign: 'center' }}>{B('none')}</Text> : (
            <>
              {(p.photos || []).length ? (
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 8, borderRadius: 22 }}>
                  {p.photos.map((u) => <Image key={u} source={{ uri: u }} style={{ width: W, height: 230, borderRadius: 22, marginEnd: 0, backgroundColor: C.glassHi }} resizeMode="cover" />)}
                </ScrollView>
              ) : null}
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 14 }}>{(ty.e + ' ' + tname(lang, ty) + (p.city ? ' · ' + p.city : '')).toUpperCase()}</Text>
              <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 2 }}>{p.name}</Text>
              <Text style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>
                {[p.price_from != null ? B(priceLabel) + ' ' + Number(p.price_from).toLocaleString() + ' ' + (p.currency || '') : null, p.hours, p.guests ? fill(B('guests'), { n: p.guests }) : null].filter(Boolean).join(' · ')}
              </Text>
              {p.about ? <Text style={{ color: C.text, fontSize: 15, lineHeight: 22, marginTop: 12 }}>{p.about}</Text> : null}

              {/* what this kind of place tells you */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                {[d.beds && '🛏️ ' + d.beds, d.checkin && '🕑 ' + B('checkin_t') + ' ' + d.checkin, d.group_max && '👥 ' + B('group_max') + ' ' + d.group_max,
                  d.hours && '⏱ ' + d.hours + 'h', d.sells && '🛍️ ' + d.sells]
                  .concat((d.inc || []).map((k) => { const x = INCLUDES.find((i) => i[0] === k); return x ? '✓ ' + (lang === 'ar' ? x[2] : x[1]) : null; }))
                  .filter(Boolean).map((x) => (
                    <View key={x} style={{ borderRadius: 999, backgroundColor: C.glassHi, paddingHorizontal: 11, paddingVertical: 6, marginEnd: 6, marginBottom: 6 }}>
                      <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700' }}>{x}</Text>
                    </View>
                  ))}
              </View>

              {/* the quiet-hours deal: what, when, and whether it runs now */}
              {p.deal && p.deal.pct ? (
                <View style={{ borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: C.goldSoft, marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>{fill(B('deal_here'), { pct: p.deal.pct })}</Text>
                    {p.deal_now ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginStart: 10 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginEnd: 5 }} />
                        <Text style={{ color: C.green, fontSize: 12.5, fontWeight: '900' }}>{B('deal_now')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginTop: 2 }}>{dealWhen(lang, p.deal)}</Text>
                </View>
              ) : null}

              {/* Moments Table: the group perk and the quiet hours */}
              {p.perk || p.quiet ? (
                <View style={{ borderRadius: 20, padding: 14, backgroundColor: C.goldSoft, marginTop: 10 }}>
                  <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900' }}>{'🪑 ' + B('table')}</Text>
                  {p.perk ? <Text style={{ color: C.text, fontSize: 14, marginTop: 4 }}>{'🎁 ' + p.perk}</Text> : null}
                  {p.quiet ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{'🕓 ' + p.quiet}</Text> : null}
                </View>
              ) : null}

              {/* check in at the counter, and the stamps */}
              {ty.counter && !p.mine ? (
                <View style={{ borderRadius: 20, padding: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, marginTop: 14 }}>
                  <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{'✅ ' + B('check_in')}</Text>
                  <View style={{ flexDirection: 'row', marginTop: 10 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <View key={i} style={{ width: 34, height: 34, borderRadius: 17, marginEnd: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: i < Math.min(stamps, 5) ? C.purple : C.glassHi }}>
                        <Text style={{ fontSize: 15 }}>{i < Math.min(stamps, 5) ? '⭐' : ''}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6 }}>{stamps >= 5 ? B('reward_ready') : fill(B('stamps'), { n: Math.min(stamps, 5) })}</Text>
                  {p.here_today && stamps < 5 ? <Text style={{ color: C.green, fontSize: 14, fontWeight: '900', marginTop: 10 }}>{B('checked')}</Text> : (
                    <>
                      <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 10 }}>{B('check_in_s')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <TextInput value={code} onChangeText={(x) => setCode(x.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" placeholder={B('code_ph')} placeholderTextColor={C.faint}
                          style={{ flex: 1, minWidth: 0, color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: code ? 6 : 0, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.bg, outlineStyle: 'none' }} />
                        <Pressable disabled={busy || code.length !== 4} accessibilityRole="button" style={{ marginStart: 10, flexShrink: 0 }}
                          onPress={() => run(() => (stamps >= 5 ? redeem(p.id, code) : checkIn(p.id, code)), stamps >= 5 ? '🎁' : (r) => (r.deal ? fill(B('deal_got'), { pct: r.deal }) : B('checked'))).then((ok) => ok && setCode(''))}>
                          <View style={{ borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: C.purple, opacity: busy || code.length !== 4 ? 0.5 : 1 }}>
                            <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900' }}>{stamps >= 5 ? B('redeem') : B('check_in')}</Text>
                          </View>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              ) : null}

              {msg ? <Text style={{ color: msg.ok ? C.green : C.coral, fontSize: 13.5, fontWeight: '700', marginTop: 10 }}>{msg.t}</Text> : null}

              {/* ask: a stay, a table, a group visit */}
              {ty.ask && !p.mine ? (
                <View style={{ marginTop: 14 }}>
                  {!ask ? (
                    <Pressable onPress={() => { tapLight(); setAsk(true); }} accessibilityRole="button">
                      <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: C.purple }}>
                        <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900' }}>{B('ask_' + ty.ask)}</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View style={{ borderRadius: 20, padding: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                      <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{B('ask_' + ty.ask)}</Text>
                      <View style={{ flexDirection: 'row', marginTop: 10 }}>
                        {[['from', B('from')], ...(ty.ask === 'stay' ? [['to', B('to')]] : []), ['people', B('people')]].map(([k, label]) => (
                          <View key={k} style={{ flex: 1, marginEnd: 6 }}>
                            <Text style={{ color: C.dim, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>{label}</Text>
                            <TextInput value={q[k]} onChangeText={(x) => setQ((o) => ({ ...o, [k]: k === 'people' ? x.replace(/[^0-9]/g, '').slice(0, 2) : x.slice(0, 10) }))}
                              placeholder={k === 'people' ? '4' : 'YYYY-MM-DD'} placeholderTextColor={C.faint} keyboardType={k === 'people' ? 'number-pad' : 'default'}
                              style={{ color: C.text, fontSize: 14.5, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, backgroundColor: C.bg, outlineStyle: 'none' }} />
                          </View>
                        ))}
                      </View>
                      <TextInput value={q.note} onChangeText={(x) => setQ((o) => ({ ...o, note: x }))} maxLength={400} multiline placeholder={B('note_ph')} placeholderTextColor={C.faint}
                        style={{ color: C.text, fontSize: 14.5, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, marginTop: 8, minHeight: 64, textAlignVertical: 'top', backgroundColor: C.bg, outlineStyle: 'none' }} />
                      <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>{B('pay_note')}</Text>
                      <Pressable disabled={busy} accessibilityRole="button" style={{ marginTop: 10 }}
                        onPress={() => run(() => askPlace({ venue: p.id, kind: ty.ask, from: q.from, to: q.to || null, people: Number(q.people) || 0, note: q.note }), B('sent')).then((ok) => ok && setAsk(false))}>
                        <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: C.purple }}>
                          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{B('send')}</Text>}
                        </View>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}

              {(p.my_requests || []).length ? (
                <>
                  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20 }}>{B('my_req').toUpperCase()}</Text>
                  {p.my_requests.map((r) => (
                    <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{B('r_' + r.kind) + ' · ' + r.from + (r.to ? ' → ' + r.to : '') + ' · ' + fill(B('req_people'), { n: r.people })}</Text>
                        {r.reply ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{'↩ ' + r.reply}</Text> : null}
                      </View>
                      <Text style={{ color: r.status === 'accepted' ? C.green : r.status === 'new' ? C.purple : C.faint, fontSize: 12, fontWeight: '900', marginStart: 8 }}>{B('st_' + r.status)}</Text>
                      {r.status === 'new' || r.status === 'accepted' ? (
                        <Pressable onPress={() => { tapLight(); cancelAsk(r.id).then(load); }} hitSlop={8} style={{ marginStart: 10 }} accessibilityRole="button">
                          <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800' }}>{B('cancel')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}

              {/* plan something here, find it, call it */}
              <View style={{ flexDirection: 'row', marginTop: 18, flexWrap: 'wrap' }}>
                <Pressable onPress={() => { tapLight(); setPlan(true); }} accessibilityRole="button" style={{ marginEnd: 8, marginBottom: 8 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: C.purpleSoft }}><Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '900' }}>{'✨ ' + B('plan_with')}</Text></View>
                </Pressable>
                {p.lat != null || p.address ? (
                  <Pressable onPress={() => { tapLight(); Linking.openURL(p.lat != null ? 'https://www.google.com/maps/search/?api=1&query=' + p.lat + ',' + p.lng : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name + ' ' + (p.address || '') + ' ' + (p.city || ''))); }} accessibilityRole="link" style={{ marginEnd: 8, marginBottom: 8 }}>
                    <View style={{ borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: C.glassHi }}><Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900' }}>{'🗺️ ' + B('map')}</Text></View>
                  </Pressable>
                ) : null}
                {p.phone ? (
                  <Pressable onPress={() => { tapLight(); Linking.openURL('tel:' + p.phone.replace(/[^+0-9]/g, '')); }} accessibilityRole="link" style={{ marginEnd: 8, marginBottom: 8 }}>
                    <View style={{ borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: C.glassHi }}><Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900' }}>{'📞 ' + B('call')}</Text></View>
                  </Pressable>
                ) : null}
                {d.link && /^https:\/\//.test(d.link) ? (
                  <Pressable onPress={() => { tapLight(); Linking.openURL(d.link); }} accessibilityRole="link" style={{ marginEnd: 8, marginBottom: 8 }}>
                    <View style={{ borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: C.glassHi }}><Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900' }}>{'🔗 ' + B('link')}</Text></View>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </ScrollView>
      </View>
      {plan && p ? <GreenSheet startNow prefill={{ kind: 'coffee', title: '', place: p.name + (p.address ? ' · ' + p.address : ''), lat: p.lat, lng: p.lng }} onClose={() => setPlan(false)} /> : null}
    </Modal>
  );
};

export const BizDirectory = ({ lang, city, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const B = (k) => bw(lang, k);
  const [type, setType] = useState(null);
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { setList(null); directory(type, city).then(setList); }, [type, city]);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'📍 ' + B('places')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{B('places_s')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 14 }}>
            {[{ k: null, e: '✨', en: B('all'), ar: B('all') }].concat(TYPES.filter((x) => !x.host)).map((x) => (
              <Pressable key={x.k || 'all'} onPress={() => { tapSelection(); setType(x.k); }} accessibilityRole="tab" accessibilityState={{ selected: type === x.k }} style={{ marginEnd: 6 }}>
                <View style={{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: type === x.k ? C.text : C.glassHi }}>
                  <Text style={{ color: type === x.k ? C.bg : C.text, fontSize: 13, fontWeight: '800' }}>{x.e + ' ' + tname(lang, x)}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          {list == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> : !list.length ? (
            /* no places yet: not a closed door — a photo, and the one thing
               anybody can do about it: send the link to a place they love */
            <View style={{ marginTop: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
              <Image source={{ uri: publicMedia('act-coffee-2.jpg') }} style={{ width: '100%', height: 190 }} resizeMode="cover" />
              <View style={{ padding: 18 }}>
                <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>{B('none_t')}</Text>
                <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{B('none_s')}</Text>
                <Pressable onPress={async () => {
                  tapLight();
                  const url = 'https://therealmoments.com/?partner=place';
                  try {
                    if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ text: B('invite_text'), url }); return; }
                    if (typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(B('invite_text') + ' ' + url); tapSuccess(); }
                  } catch (e) { /* closed the share sheet */ }
                }} accessibilityRole="button" style={{ marginTop: 16 }}>
                  <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 13, alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{B('invite')}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => { tapLight(); onClose(); openPartner('place'); }} accessibilityRole="button" style={{ marginTop: 12, alignSelf: 'center' }}>
                  <Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '800' }}>{B('have_place')}</Text>
                </Pressable>
              </View>
            </View>
          ) : list.map((v) => {
            const ty = typeOf(v.type);
            return (
              <Pressable key={v.id} onPress={() => { tapLight(); setOpen(v.id); }} accessibilityRole="button" style={{ marginTop: 12 }}>
                <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                  {(v.photos || [])[0] ? <Image source={{ uri: v.photos[0] }} style={{ width: '100%', height: 150 }} resizeMode="cover" /> : null}
                  <View style={{ padding: 13 }}>
                    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>{(ty.e + ' ' + tname(lang, ty) + (v.city ? ' · ' + v.city : '')).toUpperCase()}</Text>
                    <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginTop: 3 }}>{v.name}</Text>
                    {v.deal && v.deal.pct ? <Text style={{ color: v.deal_now ? C.green : C.text, fontSize: 13, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>{'🏷️ ' + dealLine(lang, v.deal) + (v.deal_now ? ' · ' + B('deal_now') : '')}</Text> : null}
                    {v.perk ? <Text style={{ color: C.text, fontSize: 13, marginTop: 4 }} numberOfLines={1}>{'🎁 ' + v.perk}</Text> : null}
                    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }}>
                      {[v.price_from != null ? Number(v.price_from).toLocaleString() + ' ' + (v.currency || '') : null, v.guests ? fill(B('guests'), { n: v.guests }) : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {open ? <BizPage id={open} lang={lang} onClose={() => { setOpen(null); }} /> : null}
    </Modal>
  );
};
