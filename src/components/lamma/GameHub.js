import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../../constants/theme';
import { useLang } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { SUPABASE_READY } from '../../lib/supabase';
import { explain } from '../../lib/explain';
import { fetchPacks, packTitle, createRoom, joinRoom } from '../../services/lamma';
import { getProfile } from '../../services/profiles';
import { CHANNELS } from './channels';
import { packFlags } from './languages';
import { LammaGame } from './LammaGame';
import { tapLight, tapMedium } from '../../utils/feedback';

/* ─── لمّة · THE WAY IN ───────────────────────────────────────────────
   Two doors and nothing else: start one, or join one somebody is
   already in. Everything else on this screen is a pack you might pick.

   YOUR COUNTRY FIRST. A pack belongs to a place, and yours is the one
   you will recognise — so it is at the top, with the worldwide packs
   under it. Nobody is ever shown an empty hub because they live
   somewhere a pack has not been written for yet.

   AND IT DOES NOT PRETEND. If the database has not been set up, this
   says so instead of showing an empty shelf that looks like a game
   nobody wants to play. */

export const GameHub = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { user } = useAuth();

  const [packs, setPacks] = useState(null);      // null = still asking
  const [why, setWhy] = useState(null);          // null | 'setup' | 'permission' | 'offline'
  const [code, setCode] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [game, setGame] = useState(null);        // { roomId, joinCode, packId, isHost }

  /* A missing table is a one-time setup somebody has to run; a refused
     row is a sign-in; a dead connection is a retry. Three different
     sentences, and only two of them are worth a Try again button —
     retrying a table that does not exist just fails again. Same three
     answers Groups gives, from the same place: src/lib/explain.js */
  const load = useCallback(() => {
    let alive = true;
    setPacks(null);
    if (!SUPABASE_READY || !user) { setPacks([]); setWhy('offline'); return () => {}; }
    /* WHERE YOU LIVE IS ON YOUR PROFILE, not on your sign-in. The
       signed-in user is an auth record — an id, an email, a token — and
       it has never had a country on it. Asking it for one returned
       undefined every single time, which quietly turned "your country
       first" into "no order at all", and an Egyptian opened لمّة to a
       list that led with something else.

       A profile that has not said where it is still gets every pack;
       it just does not get one moved to the top. */
    getProfile(user.id)
      .catch(() => null)
      .then((me) => fetchPacks(me && me.country))
      .then((rows) => { if (alive) { setPacks(rows); setWhy(null); } })
      .catch((e) => { if (alive) { setPacks([]); setWhy(explain(e)); } });
    return () => { alive = false; };
  }, [user]);

  useEffect(() => load(), [load]);

  const start = async (pack) => {
    if (busy) return;
    setBusy(true); setErr(null); tapMedium();
    const r = await createRoom(pack.id, 'classic');
    setBusy(false);
    if (r && r.ok) setGame({ roomId: r.room_id, joinCode: r.join_code, packId: pack.id, isHost: true });
    else setErr(t('lamma_offline'));
  };

  const join = async () => {
    if (busy || !code.trim()) return;
    setBusy(true); setErr(null); tapMedium();
    const r = await joinRoom(code);
    setBusy(false);
    if (r && r.ok) setGame({ roomId: r.room_id, joinCode: code.trim().toUpperCase(), packId: r.pack_id, isHost: false });
    else setErr(t('lamma_bad_code'));
  };

  if (game) {
    return (
      <Modal visible transparent={false} animationType="slide" onRequestClose={() => setGame(null)}>
        <LammaGame {...game} onExit={() => setGame(null)} />
      </Modal>
    );
  }

  /* Each pack gets one of the four channel colours, in order. The
     colours are already the language of this game — the tiles you tap
     to answer are these four — so a shelf of packs in the same four
     reads as part of the game rather than as a settings list. */
  const packColour = (i) => CHANNELS[i % CHANNELS.length];

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>

          {/* ── THE FRONT DOOR ──────────────────────────────────────
              A quiz should look like a quiz before you have read a
              word of it. The four shapes are the same four you tap to
              answer, so the game introduces itself. */}
          <LinearGradient
            colors={['#2B1055', '#7C3AED']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingTop: insets.top + 10, paddingBottom: 26, paddingHorizontal: 18,
                     borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
          >
            <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
              <Ionicons name="chevron-down" size={26} color="#FFF" />
            </Pressable>

            <Text style={{ color: '#FFF', fontSize: 40, fontWeight: '900', marginTop: 10 }}>{t('lamma_title')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: '700', marginTop: 2 }}>
              {t('lamma_tagline')}
            </Text>

            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              {CHANNELS.map((ch) => (
                <View key={ch.key} style={{
                  width: 34, height: 34, borderRadius: 11, marginEnd: 9,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.16)',
                }}>
                  <MaterialCommunityIcons name={ch.icon} size={19} color="#FFF" />
                </View>
              ))}
            </View>
          </LinearGradient>

          <View style={{ padding: 16 }}>
            {/* ── JOIN WITH A CODE ────────────────────────────────
                The button sits UNDER the field at full width, not
                beside it. A pill next to a text box has to survive
                every screen width and every language, and it did not:
                on a real phone "Join" was cut in half by the right
                edge. Stacked, there is nothing left to clip. */}
            <View style={{
              backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
              borderRadius: 20, padding: 14, marginBottom: 22,
            }}>
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>
                {t('lamma_code_label')}
              </Text>
              <TextInput
                placeholder="- - - - - -"
                placeholderTextColor={C.faint}
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                textAlign="center"
                style={{
                  /* minWidth 0 is the whole reason this used to overflow:
                     a flex item will not shrink below its own content
                     unless you say so, and the content here is six wide
                     letter-spaced characters. */
                  minWidth: 0, color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: 8,
                  backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.line,
                  borderRadius: 16, paddingVertical: 14,
                }}
              />
              <Pressable onPress={join} disabled={!code.trim() || busy} style={{ marginTop: 10 }}>
                <View style={{
                  backgroundColor: code.trim() ? C.purple : C.glassHi,
                  borderRadius: 16, paddingVertical: 15, alignItems: 'center',
                }}>
                  <Text style={{ color: code.trim() ? '#FFF' : C.faint, fontSize: 15.5, fontWeight: '900' }}>
                    {t('lamma_join')}
                  </Text>
                </View>
              </Pressable>
            </View>

            {err ? (
              <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginBottom: 14, textAlign: 'center' }}>{err}</Text>
            ) : null}

            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 12 }}>
              {t('lamma_or_start')}
            </Text>

            {packs === null ? (
              <ActivityIndicator color={C.purple} style={{ marginTop: 24 }} />
            ) : why ? (
              <View style={{ alignItems: 'center', paddingVertical: 26, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 32 }}>{why === 'setup' ? '🧩' : '📡'}</Text>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>
                  {why === 'setup' ? t('lamma_not_switched_on')
                    : why === 'permission' ? t('lamma_cant_see')
                    : t('lamma_cant_load')}
                </Text>
                <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
                  {why === 'setup' ? t('lamma_setup_hint')
                    : why === 'permission' ? t('load_err_permission')
                    : t('lamma_conn_hint')}
                </Text>
                {/* Retrying a table that does not exist just fails again,
                    so it is not offered. */}
                {why === 'setup' ? null : (
                  <Pressable onPress={() => { tapLight(); load(); }} style={{ marginTop: 14 }}>
                    <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 9 }}>
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{t('try_again')}</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            ) : packs.length === 0 ? (
              <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 26 }}>
                {t('lamma_no_packs')}
              </Text>
            ) : (
              /* Two to a row, each in its own colour. A list of grey rows
                 is a menu; this is a shelf you pick from. */
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {packs.map((p, i) => {
                  const ch = packColour(i);
                  return (
                    <Pressable key={p.id} onPress={() => start(p)} disabled={busy} style={{ width: '48.5%', marginBottom: 13 }}>
                      <View style={{
                        backgroundColor: ch.soft, borderWidth: 1.5, borderColor: ch.color,
                        borderRadius: 20, padding: 14, minHeight: 158, justifyContent: 'space-between',
                      }}>
                        <View>
                          <View style={{
                            width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: ch.color,
                          }}>
                            <MaterialCommunityIcons name={ch.icon} size={20} color="#FFF" />
                          </View>
                          <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', marginTop: 10 }} numberOfLines={2}>
                            {packTitle(p, lang)}
                          </Text>
                          {(lang === 'ar' ? p.description_ar : p.description_en) ? (
                            <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 4, lineHeight: 16 }} numberOfLines={2}>
                              {lang === 'ar' ? p.description_ar : p.description_en}
                            </Text>
                          ) : null}
                          {/* The languages this pack is really written in.
                              A picker nobody knows about is a picker
                              nobody uses, and a flag is read across a
                              room faster than any sentence about it.
                              Packs that make no claim show nothing. */}
                          {packFlags(p).length > 1 ? (
                            <Text style={{ fontSize: 12, marginTop: 7, letterSpacing: 1 }} numberOfLines={1}>
                              {packFlags(p).join(' ')}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{
                          backgroundColor: ch.color, borderRadius: 999,
                          paddingVertical: 9, alignItems: 'center', marginTop: 12,
                        }}>
                          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{t('lamma_start')}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
