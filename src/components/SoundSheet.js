import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { C } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { tapLight, tapSuccess } from '../utils/feedback';
import { canReuse, reuseSound } from '../lib/sound';
import { fetchSound, setSoundReuse } from '../services/sounds';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── A SOUND, AND WHO IS ALLOWED TO USE IT ───────────────────────────
   "خلي الفديوز ليها سوندرز و الناس ممكن تسمح او تلغي ده ان الناس تreuse
   sound و تعمل بيه فديو تاني".

   Three things on one sheet, and the order matters:

     1. whose sound it is. A reused sound credits the person it came
        from, at the top, before anything else on the screen.
     2. what has been made with it — the video it came from and
        everything built on it since. That list is what turns a sound
        into a thing people join in with.
     3. the switch, and ONLY for the person who recorded it. Their
        voice, their street, their song: whether anybody may build on
        it is their decision and nobody else's. */
export const SoundSheet = ({ postId, onClose, onUseSound, onOpenPost }) => {
  /* the phone's own back gesture closes this — see src/lib/sheetBack.js */
  useSheetBack(onClose);
  const { user } = useAuth();
  const { t } = useLang();
  const [data, setData] = useState(null);     // null = still loading
  const [reuse, setReuse] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dead = false;
    if (!SUPABASE_READY || !postId) { setData({ origin: null, sound: null, made: [] }); return () => {}; }
    fetchSound(postId).then((d) => {
      if (dead) return;
      setData(d || { origin: null, sound: null, made: [] });
      if (d && d.sound) setReuse(d.sound.reuse !== false);
    }).catch(() => setData({ origin: null, sound: null, made: [] }));
    return () => { dead = true; };
  }, [postId]);

  const sound = data && data.sound;
  const mine = !!(user && data && data.origin && data.origin.user_id === user.id);
  const allowed = canReuse(sound ? { ...sound, reuse } : null);

  const flip = async () => {
    if (!mine || busy) return;
    const next = !reuse;
    setReuse(next);                      // instantly, because it is their switch
    setBusy(true);
    try { await setSoundReuse(postId, user.id, next); tapSuccess(); }
    catch (e) { setReuse(!next); }       // it did not save: say so by putting it back
    finally { setBusy(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '78%' }}>
        <View style={{ padding: 16, paddingBottom: 10 }}>
          {data === null ? (
            <ActivityIndicator color={C.purple} style={{ paddingVertical: 20 }} />
          ) : !sound ? (
            <Text style={{ color: C.faint, fontSize: 13, paddingVertical: 16 }}>{t('sound_gone')}</Text>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 26 }}>{sound.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
                  <Text numberOfLines={1} style={{ color: C.text, fontSize: 16.5, fontWeight: '900' }}>
                    {sound.kind === 'original' ? t('sound_original') : sound.title}
                  </Text>
                  {/* the credit, always, and before anything else */}
                  <Text numberOfLines={1} style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{sound.artist}</Text>
                </View>
              </View>

              {allowed ? (
                <Pressable onPress={() => { tapLight(); onUseSound && onUseSound(reuseSound({ ...sound, reuse })); onClose(); }} style={{ marginTop: 14 }}>
                  <View style={{ backgroundColor: C.purple, borderRadius: 14, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                    <Ionicons name="videocam" size={17} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900', marginLeft: 8 }}>{t('sound_use')}</Text>
                  </View>
                </Pressable>
              ) : (
                /* Not an error and not a fault — a person said no, and
                   saying so plainly is better than hiding the button. */
                <View style={{ marginTop: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 }}>
                  <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18 }}>{t('sound_closed')}</Text>
                </View>
              )}

              {mine && sound.kind === 'original' ? (
                <Pressable onPress={flip} style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{t('sound_allow')}</Text>
                      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{t('sound_allow_hint')}</Text>
                    </View>
                    <View style={{ width: 46, height: 27, borderRadius: 14, backgroundColor: reuse ? C.green : C.glassHi, padding: 3, justifyContent: 'center' }}>
                      <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFF', marginLeft: reuse ? 19 : 0 }} />
                    </View>
                  </View>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        {data && data.origin ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>
              {t('sound_made_with')} · {1 + (data.made || []).length}
            </Text>
            {[data.origin].concat(data.made || []).map((r, i) => (
              <Pressable key={r.id} onPress={() => { tapLight(); onOpenPost && onOpenPost(r); onClose(); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                  <Image source={{ uri: r.thumb_url || (r.user && r.user.avatar_url) || AV_NEUTRAL }}
                    style={{ width: 44, height: 58, borderRadius: 10, backgroundColor: C.glassHi }} />
                  <View style={{ flex: 1, minWidth: 0, marginStart: 11 }}>
                    <Text numberOfLines={1} style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>
                      {(r.user && r.user.name) || 'Explorer'}
                      {i === 0 ? '  ·  ' + t('sound_the_original') : ''}
                    </Text>
                    <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{r.caption || ''}</Text>
                  </View>
                  <MaterialCommunityIcons name="star-four-points" size={12} color={C.gold} />
                  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700', marginLeft: 4 }}>{r.vibes || 0}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
};
