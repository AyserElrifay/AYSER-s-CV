import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, FlatList, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchMyNotifications, markAllRead } from '../services/notifications';
import { acceptFromActor } from '../services/mates';
import { tapLight, tapSuccess } from '../utils/feedback';
import { sfxSuccess } from '../utils/sfx';
import { Micro } from './Micro';

/* The activity inbox — every star, laugh, comment and mate event on
   YOUR stuff, written by DB triggers so nothing is ever fabricated. */

const timeAgo = (ts) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(ts)) / 60000));
  if (m < 60) return m + 'm';
  if (m < 48 * 60) return Math.round(m / 60) + 'h';
  return Math.round(m / (60 * 24)) + 'd';
};

const LINE = {
  vibe: '⭐ starred your moment',
  laugh: '😂 laughed at your moment',
  comment: '💬 commented',
  mate_request: '🤝 wants to be your mate',
  mate_accept: '🎉 accepted — you\'re mates now!',
  call: '📞 called you — call them back',
};

export const NotificationsSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [accepted, setAccepted] = useState({});
  const [loadErr, setLoadErr] = useState(null);

  const load = useCallback(async () => {
    if (!SUPABASE_READY || !user) { setItems([]); return; }
    try {
      const rows = await fetchMyNotifications(user.id);
      setItems(rows);
      markAllRead(user.id).catch(() => {});
    } catch (e) {
      setItems([]);
      setLoadErr(/does not exist|schema cache/i.test(e.message || '')
        ? 'One step left: run supabase/RUN_ME.sql to turn on notifications.'
        : (e.message || 'Could not load activity'));
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const accept = async (n) => {
    tapSuccess(); sfxSuccess();
    setAccepted((a) => ({ ...a, [n.id]: true }));
    try { await acceptFromActor(n.actor_id, user.id); } catch (e) {}
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6,
        borderWidth: 1, borderColor: C.line, maxHeight: '75%', paddingBottom: insets.bottom + 12,
      }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Micro>Activity 🔔</Micro>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>

        {items === null ? (
          <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>Loading…</Text>
        ) : items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 30 }}>
            <Text style={{ fontSize: 34 }}>🔔</Text>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 10 }}>
              {loadErr ? 'Almost there' : 'No activity yet'}
            </Text>
            <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
              {loadErr || 'When people star, laugh at or comment on your moments — or mate up with you — it lands here instantly.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item: n }) => (
              <View style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
                borderBottomWidth: 1, borderBottomColor: C.line,
                opacity: n.read ? 0.75 : 1,
              }}>
                <View>
                  <Image source={{ uri: (n.actor && n.actor.avatar_url) || AV_NEUTRAL }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                  {!n.read ? <View style={{ position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: 6, backgroundColor: C.purple, borderWidth: 2, borderColor: C.bg2 }} /> : null}
                </View>
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19 }}>
                    <Text style={{ fontWeight: '900' }}>{(n.actor && n.actor.name) || 'Someone'}</Text>
                    {n.actor && n.actor.country_flag ? ' ' + n.actor.country_flag : ''}{' '}
                    <Text style={{ color: C.dim }}>{LINE[n.kind] || n.kind}</Text>
                  </Text>
                  {n.kind === 'comment' && n.body ? (
                    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>“{n.body}”</Text>
                  ) : null}
                  {n.post && n.post.caption ? (
                    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>on: {n.post.caption}</Text>
                  ) : null}
                </View>
                <Text style={{ color: C.faint, fontSize: 11, marginLeft: 8 }}>{timeAgo(n.created_at)}</Text>
                {n.kind === 'mate_request' ? (
                  accepted[n.id] ? (
                    <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginLeft: 8 }}>
                      <Text style={{ color: C.green, fontSize: 11, fontWeight: '900' }}>Mates ✓</Text>
                    </View>
                  ) : (
                    <Pressable onPress={() => accept(n)} style={{ marginLeft: 8 }}>
                      <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 }}>
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>Accept</Text>
                      </View>
                    </Pressable>
                  )
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
};
