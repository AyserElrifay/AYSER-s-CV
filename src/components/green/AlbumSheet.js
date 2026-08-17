import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../../constants/theme';
import { useLang } from '../../context/LanguageContext';
import { tapLight, tapSuccess } from '../../utils/feedback';
import { fetchAlbum, removeFace } from '../../services/green';

/* ─── عقول خضرا · THE PHARAOH ALBUM ──────────────────────────────────
   Every pharaoh anybody made, in one place, with a name and a date and
   a way to save it.

   ── IT LOOKS LIKE A CONVERSATION BECAUSE THAT IS WHAT IT IS ───────
   Ayser asked for the photos to arrive "on my chat with green minds,
   from a chat account". They do — and the account is the album itself,
   not an invented person. Nothing here has a fake human behind it:
   there is no profile pretending to have signed up, nothing that would
   turn up in a member count or a search for people. The sender is
   Green Minds because Green Minds is genuinely what collected them.

   ── AND ONLY HE CAN OPEN IT ───────────────────────────────────────
   Not because this screen is hidden — because the server refuses.
   green_album() answers 'not_yours' to anybody else and the table's
   own policy shows a player nothing but their own face. Tested from
   the other side, signed in as somebody else, in
   scratchpad/verify35.sh. A screen that merely hides a button
   protects nothing at all; the check has to be somewhere the person
   being checked cannot edit.

   ── SAVING ────────────────────────────────────────────────────────
   Each pharaoh is already a complete JPEG sitting in memory — there
   is nothing to fetch and nothing to wait for. On the web a link with
   a download attribute hands it straight to the phone's own downloads.
   "Save them all" is the same thing in a loop, spaced out, because
   twenty simultaneous downloads is how a browser decides you are
   doing something suspicious and silently stops.                     */

const GREEN = '#1F7A5A';
const GREEN_SOFT = 'rgba(31,122,90,0.10)';

/* A file name somebody can find again a month later: who, and when. */
const fileNameFor = (f) => {
  const who = String((f && (f.name || f.nickname)) || 'pharaoh')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pharaoh';
  const when = (f && f.created_at ? String(f.created_at) : '').slice(0, 10);
  return 'moments-' + who + (when ? '-' + when : '') + '.jpg';
};

/* Web only, and deliberately so: this is the one place the app reaches
   for the DOM. React Native has no notion of "the downloads folder",
   and Moments runs in a browser. Wrapped because a failure here should
   cost one saved picture, never the screen. */
const saveOne = (f) => {
  try {
    if (typeof document === 'undefined' || !f || !f.image) return false;
    const a = document.createElement('a');
    a.href = f.image;
    a.download = fileNameFor(f);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (e) { return false; }
};

const when = (iso, lang) => {
  try {
    return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch (e) { return ''; }
};

export const AlbumSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [faces, setFaces] = useState(null);      // null = still asking
  const [why, setWhy] = useState(null);          // 'not_yours' | 'offline' | null
  const [savingAll, setSavingAll] = useState(false);

  const load = useCallback(async () => {
    setFaces(null); setWhy(null);
    const r = await fetchAlbum(400);
    if (r && r.ok) { setFaces(r.faces || []); return; }
    setFaces([]);
    setWhy((r && r.reason) || 'offline');
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveAll = async () => {
    if (savingAll || !faces || !faces.length) return;
    setSavingAll(true);
    tapLight();
    for (let i = 0; i < faces.length; i++) {
      saveOne(faces[i]);
      // spaced out: a browser treats a burst of downloads as an attack
      await new Promise((r) => setTimeout(r, 220));
    }
    setSavingAll(false);
    tapSuccess();
  };

  const drop = async (f) => {
    tapLight();
    const r = await removeFace(f.id);
    if (r && r.ok) setFaces((rows) => (rows || []).filter((x) => x.id !== f.id));
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
          <LinearGradient
            colors={[GREEN, '#123F31']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 22,
                     borderBottomStartRadius: 26, borderBottomEndRadius: 26 }}>
            <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
              <Ionicons name="chevron-down" size={26} color="#FFF" />
            </Pressable>
            <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 12 }}>
              {t('green_album')}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, marginTop: 4 }}>
              {t('green_album_sub')}
            </Text>
          </LinearGradient>

          <View style={{ padding: 16 }}>
            {faces === null ? (
              <ActivityIndicator color={GREEN} style={{ marginVertical: 30 }} />
            ) : why === 'not_yours' ? (
              <View style={{
                backgroundColor: GREEN_SOFT, borderWidth: 1, borderColor: 'rgba(31,122,90,0.35)',
                borderRadius: 18, padding: 18, alignItems: 'center',
              }}>
                <MaterialCommunityIcons name="lock-outline" size={26} color={GREEN} />
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 10, textAlign: 'center', lineHeight: 20 }}>
                  {t('green_album_private')}
                </Text>
              </View>
            ) : faces.length === 0 ? (
              <View style={{
                borderWidth: 1, borderColor: C.line, borderStyle: 'dashed',
                borderRadius: 18, padding: 26, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 26 }}>👑</Text>
                <Text style={{ color: C.faint, fontSize: 13.5, fontWeight: '700', marginTop: 10, textAlign: 'center', lineHeight: 20 }}>
                  {why === 'offline' ? t('lamma_conn_hint') : t('green_album_none')}
                </Text>
              </View>
            ) : (
              <>
                <Pressable onPress={saveAll} disabled={savingAll} style={{ marginBottom: 16 }}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: GREEN, borderRadius: 999, paddingVertical: 13,
                    opacity: savingAll ? 0.6 : 1,
                  }}>
                    <MaterialCommunityIcons name="tray-arrow-down" size={18} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900', marginStart: 8 }}>
                      {savingAll ? '…' : t('green_save_all').replace('{n}', faces.length)}
                    </Text>
                  </View>
                </Pressable>

                {/* One per row, like messages arriving — the picture,
                    who made it, when, and the two things you can do
                    with it. */}
                {faces.map((f) => (
                  <View key={f.id} style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                    borderRadius: 18, padding: 11, marginBottom: 10,
                  }}>
                    <Image
                      source={{ uri: f.image }}
                      style={{ width: 62, height: 62, borderRadius: 16, backgroundColor: C.glassHi }}
                    />
                    <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
                      <Text numberOfLines={1} style={{ color: C.text, fontSize: 14.5, fontWeight: '900' }}>
                        {f.name || f.nickname || t('lamma_player')}
                      </Text>
                      <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
                        {when(f.created_at, lang)}
                        {f.kind === 'drawn' ? ' · ' + t('green_album_drawn') : ' · ' + t('green_album_photo')}
                      </Text>
                    </View>
                    <Pressable onPress={() => { tapLight(); saveOne(f); }} hitSlop={8} style={{ padding: 6 }}>
                      <MaterialCommunityIcons name="download" size={21} color={GREEN} />
                    </Pressable>
                    <Pressable onPress={() => drop(f)} hitSlop={8} style={{ padding: 6 }}>
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color={C.faint} />
                    </Pressable>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
