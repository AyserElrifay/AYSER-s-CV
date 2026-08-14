import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/theme';
import { useLang } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { SUPABASE_READY } from '../../lib/supabase';
import { explain } from '../../lib/explain';
import { fetchPacks, packTitle, createRoom, joinRoom } from '../../services/lamma';
import { getProfile } from '../../services/profiles';
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

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
          <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={10}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <View style={{ marginStart: 10 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{t('lamma_title')}</Text>
            <Text style={{ color: C.faint, fontSize: 12 }}>{t('lamma_tagline')}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
          {/* join by code */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <TextInput
              placeholder={t('lamma_code_label')}
              placeholderTextColor={C.faint}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
              style={{
                flex: 1, color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: 4,
                backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
              }}
            />
            {/* The button keeps its width and the field gives way, not the
                other way round — a squeezed pill lets its own label spill
                out of the screen, which is how "Join with a code" ended up
                reading "Join with a". One word fits on any phone, and the
                field already says what the code is. */}
            <Pressable onPress={join} disabled={!code.trim() || busy} style={{ marginStart: 10, flexShrink: 0 }}>
              <View style={{
                backgroundColor: code.trim() ? C.purple : C.glassHi,
                borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14,
              }}>
                <Text numberOfLines={1} style={{ color: code.trim() ? '#FFF' : C.faint, fontSize: 14, fontWeight: '900' }}>
                  {t('lamma_join')}
                </Text>
              </View>
            </Pressable>
          </View>

          {err ? (
            <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginBottom: 14 }}>{err}</Text>
          ) : null}

          {packs === null ? (
            <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
          ) : why ? (
            <View style={{ alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20 }}>
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
            <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>
              {t('lamma_no_packs')}
            </Text>
          ) : (
            packs.map((p) => (
              <Pressable key={p.id} onPress={() => start(p)} disabled={busy}>
                <View style={{
                  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                  borderRadius: 18, padding: 16, marginBottom: 12,
                  flexDirection: 'row', alignItems: 'center',
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>{packTitle(p, lang)}</Text>
                    {(lang === 'ar' ? p.description_ar : p.description_en) ? (
                      <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 3 }} numberOfLines={2}>
                        {lang === 'ar' ? p.description_ar : p.description_en}
                      </Text>
                    ) : null}
                    {p.country ? (
                      <Text style={{ color: C.purple, fontSize: 11, fontWeight: '900', marginTop: 6 }}>{p.country}</Text>
                    ) : null}
                  </View>
                  <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginStart: 12 }}>
                    <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>{t('lamma_start')}</Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
