import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchMyMates } from '../services/mates';
import { fetchCloseFriendIds, setCloseFriend } from '../services/closeFriends';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { tapSelection, tapSuccess } from '../utils/feedback';

/* ── CLOSE FRIENDS ───────────────────────────────────────────────────
   The smaller circle. Tick people, and anything you mark close-only
   goes to them and nobody else.

   Two things this promises, and both are kept by the database rather
   than by us leaving a button out:

     · nobody is told they've been added, and nobody is told they've
       been removed;
     · nobody can read your list, or find out whose list they're on.

   The green ring is the same signal every app uses for this, and it's
   worth keeping because people already know what it means. */
export const CloseFriendsSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mates, setMates] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!SUPABASE_READY || !user) { setMates([]); return; }
    try {
      const [list, ids] = await Promise.all([fetchMyMates(user.id), fetchCloseFriendIds(user.id)]);
      setMates(list || []);
      setChosen(ids);
    } catch (e) { setMates([]); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id) => {
    if (busy) return;
    const on = !chosen.has(id);
    tapSelection();
    setBusy(id);
    setErr(null);
    // show it immediately; put it back if the write fails
    setChosen((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
    try {
      await setCloseFriend(user.id, id, on);
      if (on) tapSuccess();
    } catch (e) {
      setChosen((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });
      setErr('That didn\'t save — check your signal and try again.');
    } finally { setBusy(null); }
  };

  const term = q.trim().toLowerCase();
  const shown = (mates || []).filter((m) => !term || String(m.name || '').toLowerCase().includes(term));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '88%', paddingBottom: insets.bottom + 10,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="star" size={15} color={C.green} />
          </View>
          <View style={{ flex: 1, marginLeft: 11 }}>
            <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '900' }}>Close Friends</Text>
            <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>
              {chosen.size ? chosen.size + (chosen.size === 1 ? ' person' : ' people') + ' on your list' : 'Nobody on the list yet'}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={C.faint} />
          </Pressable>
        </View>

        <Text style={{ color: C.faint, fontSize: 11.5, paddingHorizontal: 16, marginTop: 10, lineHeight: 17 }}>
          Anything you mark close-only goes to these people and nobody else. They are
          never told they were added — or removed.
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassHi, borderRadius: 999, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 13 }}>
          <Ionicons name="search" size={14} color={C.faint} />
          <TextInput
            value={q} onChangeText={setQ}
            placeholder="Search your mates" placeholderTextColor={C.faint}
            style={{ flex: 1, color: C.text, fontSize: 13.5, paddingVertical: 9, marginLeft: 8 }}
          />
        </View>

        {err ? <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginTop: 10 }}>{err}</Text> : null}

        {mates === null ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
        ) : shown.length ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 }}>
            {shown.map((m) => {
              const on = chosen.has(m.id);
              return (
                <Pressable key={m.id} onPress={() => toggle(m.id)} disabled={busy === m.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, opacity: busy === m.id ? 0.5 : 1 }}>
                    <View style={{
                      borderRadius: 24, padding: 2,
                      borderWidth: on ? 2.5 : 0, borderColor: C.green,
                    }}>
                      <Image
                        source={{ uri: m.avatar_url || buildAvatarUrl(m.id, m.avatar_dna) }}
                        style={{ width: 42, height: 42, borderRadius: 21 }}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
                        {m.country_flag ? m.country_flag + ' ' : ''}{m.name || 'Explorer'}
                      </Text>
                      {m.handle ? <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>@{m.handle}</Text> : null}
                    </View>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={on ? C.green : C.faint}
                    />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingVertical: 44 }}>
            <Text style={{ fontSize: 30 }}>⭐</Text>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>
              {term ? 'Nobody by that name' : 'No mates yet'}
            </Text>
            <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
              {term
                ? 'Try a different name.'
                : 'Close Friends is picked from your mates — add a few people first and they show up here.'}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};
