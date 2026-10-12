import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { createCircle, squadMakeLink, chatLinkUrl } from '../services/squadAdmin';
import { shareLink } from '../utils/share';
import { openChat } from '../lib/chatBus';
import { goToTab } from '../lib/mapBus';
import { useAuth } from '../context/AuthContext';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';

/* ─── START A CIRCLE HERE ──────────────────────────────────────────────
   Ayser: "الناس يعجبها مكان من على الخريطة يدوسو عليه و يعملو create a
   circle … يبعتو لصحبهم بره مومنتس". A name, one line about it, public
   or not — then the group exists, you own it, and its invite link is
   one tap away. Public circles show to people within 25 km. */
export const CircleSheet = ({ place, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [name, setName] = useState(place && place.name ? place.name : '');
  const [about, setAbout] = useState('');
  const [isPublic, setPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState(null);

  const create = async () => {
    if (busy || name.trim().length < 2) return;
    tapLight(); setBusy(true); setErr(null);
    const r = await createCircle({ name: name.trim(), about, lat: place && place.lat, lng: place && place.lng, place: place && place.name, isPublic });
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setDone(r.id); } else setErr(t(r && r.reason === 'too_many' ? 'ci_too_many' : 'gc_failed'));
  };
  const share = async () => {
    tapLight();
    const r = await squadMakeLink(done, 7);
    if (r && r.ok) await shareLink({ url: chatLinkUrl(r.token, user && user.id), title: name, text: t('gc_link_text').replace('{name}', name) });
  };
  const open = () => { onClose(); openChat({ id: done, name, emoji: '⭕' }); goToTab('CHATS'); };

  const box = { borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, color: C.text, fontSize: 15, marginTop: 8 };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: insets.bottom + 18 }}>
        <View style={{ alignItems: 'center' }}><SheetHandle onClose={onClose} /></View>
        {done ? (
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ fontSize: 40 }}>⭕</Text>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>{t('ci_done')}</Text>
            <Text style={{ color: C.dim, fontSize: 14, marginTop: 4, textAlign: 'center' }}>{t('ci_done_sub')}</Text>
            <Pressable onPress={share} style={{ alignSelf: 'stretch', marginTop: 16 }}>
              <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: C.purple }}><Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('gc_link_share')}</Text></View>
            </Pressable>
            <Pressable onPress={open} style={{ marginTop: 12 }}><Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{t('ci_open')}</Text></Pressable>
          </View>
        ) : (
          <>
            <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', marginTop: 6 }}>{t('ci_title')}</Text>
            {place && place.name ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 2 }}>{'📍 ' + place.name}</Text> : null}
            <TextInput value={name} onChangeText={setName} maxLength={80} placeholder={t('ci_name_ph')} placeholderTextColor={C.faint} style={box} />
            <TextInput value={about} onChangeText={setAbout} maxLength={300} placeholder={t('ci_about_ph')} placeholderTextColor={C.faint} multiline style={[box, { minHeight: 70, textAlignVertical: 'top' }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{t(isPublic ? 'ci_public' : 'ci_private')}</Text>
                <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{t(isPublic ? 'ci_public_sub' : 'ci_private_sub')}</Text>
              </View>
              <Switch value={isPublic} onValueChange={setPublic} />
            </View>
            {err ? <Text style={{ color: '#E11D48', fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
            <Pressable onPress={create} disabled={busy || name.trim().length < 2} style={{ marginTop: 16 }}>
              <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: name.trim().length < 2 ? C.glassHi : C.purple }}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900' }}>{t('ci_create')}</Text>}
              </View>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
};
