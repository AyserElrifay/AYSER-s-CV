import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { applyAsHost, myHostRequest } from '../services/hosts';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── HOST ON MOMENTS: A LICENSED GUIDE, OR A VERIFIED HOST ───────────
   Four things, in one scroll, and nothing else:
     1. which — a licensed tour guide (licence card) or an activity host
        (national ID);
     2. a photo of that document, and a live selfie holding up two
        fingers, so the face on the card is the face on the account;
     3. for a guide: the languages and the places they guide;
     4. the declaration, ticked: they run their activities, not Moments.
   The documents are seen by the Moments team only and deleted once
   checked (src/services/hosts.js). */

const LANGS = ['Arabic', 'English', 'French', 'German', 'Italian', 'Spanish', 'Russian', 'Chinese'];
export const HOST_AREAS = ['Pyramids & Giza', 'Egyptian Museum & GEM', 'Islamic Cairo', 'Old Cairo', 'Alexandria', 'Fayoum', 'Dahab', 'Soma Bay', 'Luxor & Aswan'];

const pickImage = (capture) => new Promise((resolve) => {
  if (typeof document === 'undefined') return resolve(null);
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  if (capture) input.setAttribute('capture', capture);
  input.style.display = 'none';
  input.onchange = () => { resolve((input.files && input.files[0]) || null); input.remove(); };
  document.body.appendChild(input); input.click();
  return undefined;
});

export const HostApplySheet = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [role, setRole] = useState('guide');
  const [doc, setDoc] = useState(null);         // { file, preview }
  const [selfie, setSelfie] = useState(null);
  const [langs, setLangs] = useState(['Arabic']);
  const [areas, setAreas] = useState([]);
  const [since, setSince] = useState('');
  const [about, setAbout] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(null);     // null | { status, role }
  const [err, setErr] = useState(null);

  useEffect(() => { if (user) myHostRequest(user.id).then(setState).catch(() => {}); }, [user && user.id]);

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const ready = !!doc && !!selfie && agree && (role !== 'guide' || langs.length > 0);

  const submit = async () => {
    if (!ready || busy || !user) return;
    setBusy(true); setErr(null);
    try {
      const r = await applyAsHost(user.id, { role, docFile: doc.file, selfieFile: selfie.file, langs, areas, since, about });
      if (r && r.ok) { tapSuccess(); setState({ status: 'pending', role }); }
      else setErr(r && r.reason === 'already' ? t('ha_already') : t('lamma_offline'));
    } catch (e) { setErr(t('lamma_offline')); }
    setBusy(false);
  };

  const chip = (on) => ({ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginEnd: 7, marginBottom: 7, borderWidth: 1, borderColor: on ? C.text : C.line, backgroundColor: on ? C.text : 'transparent' });
  const head = { color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 8 };

  const photoBox = (value, set, label, sub, capture) => (
    <Pressable onPress={async () => { tapLight(); const f = await pickImage(capture); if (f) set({ file: f, preview: URL.createObjectURL(f) }); }}
      accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
      {value ? <Image source={{ uri: value.preview }} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: C.glassHi }} /> : (
        <View style={{ width: 72, height: 72, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="camera-outline" size={24} color={C.dim} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{label}</Text>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{value ? t('ha_retake') : sub}</Text>
      </View>
      {value ? <Ionicons name="checkmark-circle" size={20} color={C.green} /> : null}
    </Pressable>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginStart: -8 }}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.4, marginTop: 4 }}>{t('ha_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{t('ha_sub')}</Text>

          {state && state.status === 'pending' ? (
            <View style={{ marginTop: 24, padding: 16, borderRadius: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ fontSize: 26 }}>⏳</Text>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 6 }}>{t('ha_pending')}</Text>
              <Text style={{ color: C.dim, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{t('ha_pending_sub')}</Text>
            </View>
          ) : state && state.status === 'approved' ? (
            <View style={{ marginTop: 24, padding: 16, borderRadius: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ fontSize: 26 }}>{state.role === 'guide' ? '🪪' : '✅'}</Text>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 6 }}>{state.role === 'guide' ? t('hb_guide') : t('hb_host')}</Text>
            </View>
          ) : (
            <>
              {/* 1 · which */}
              <Text style={head}>{t('ha_which').toUpperCase()}</Text>
              {[{ k: 'guide', emoji: '🪪', title: t('ha_guide'), sub: t('ha_guide_sub') }, { k: 'host', emoji: '🙋', title: t('ha_host'), sub: t('ha_host_sub') }].map((o) => (
                <Pressable key={o.k} onPress={() => { tapLight(); setRole(o.k); setDoc(null); }} accessibilityRole="radio" accessibilityState={{ checked: role === o.k }}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: role === o.k ? C.text : C.line, marginBottom: 8 }}>
                  <Text style={{ fontSize: 24 }}>{o.emoji}</Text>
                  <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{o.title}</Text>
                    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{o.sub}</Text>
                  </View>
                  <Ionicons name={role === o.k ? 'radio-button-on' : 'radio-button-off'} size={20} color={role === o.k ? C.text : C.faint} />
                </Pressable>
              ))}

              {/* 2 · the document and a live selfie */}
              <Text style={head}>{t('ha_proof').toUpperCase()}</Text>
              {photoBox(doc, setDoc, role === 'guide' ? t('ha_licence') : t('ha_id'), t('ha_doc_sub'), 'environment')}
              {photoBox(selfie, setSelfie, t('ha_selfie'), t('ha_selfie_sub'), 'user')}
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 10, lineHeight: 17 }}>🔒 {t('ha_private')}</Text>

              {/* 3 · for a guide: languages and places */}
              {role === 'guide' ? (
                <>
                  <Text style={head}>{t('ha_langs').toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {LANGS.map((l) => (
                      <Pressable key={l} onPress={() => { tapLight(); toggle(langs, setLangs, l); }} accessibilityRole="checkbox" accessibilityState={{ checked: langs.includes(l) }} style={chip(langs.includes(l))}>
                        <Text style={{ color: langs.includes(l) ? C.bg : C.text, fontSize: 13, fontWeight: '700' }}>{l}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
              <Text style={head}>{t('ha_areas').toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {HOST_AREAS.map((a) => (
                  <Pressable key={a} onPress={() => { tapLight(); toggle(areas, setAreas, a); }} accessibilityRole="checkbox" accessibilityState={{ checked: areas.includes(a) }} style={chip(areas.includes(a))}>
                    <Text style={{ color: areas.includes(a) ? C.bg : C.text, fontSize: 13, fontWeight: '700' }}>{a}</Text>
                  </Pressable>
                ))}
              </View>
              {role === 'guide' ? (
                <TextInput value={since} onChangeText={(v) => setSince(v.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad"
                  placeholder={t('ha_since')} placeholderTextColor={C.faint}
                  style={{ color: C.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 10, marginTop: 8 }} />
              ) : null}
              <TextInput value={about} onChangeText={setAbout} multiline maxLength={400}
                placeholder={t('ha_about')} placeholderTextColor={C.faint}
                style={{ color: C.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 10, marginTop: 8, minHeight: 60, textAlignVertical: 'top' }} />

              {/* 4 · the declaration */}
              <Text style={head}>{t('ha_declare').toUpperCase()}</Text>
              <Pressable onPress={() => { tapLight(); setAgree((a) => !a); }} accessibilityRole="checkbox" accessibilityState={{ checked: agree }}
                style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: agree ? C.text : C.line }}>
                <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={22} color={agree ? C.text : C.faint} />
                <Text style={{ flex: 1, color: C.text, fontSize: 13.5, lineHeight: 20, marginStart: 10 }}>{t('ha_terms')}</Text>
              </Pressable>

              {err ? <Text style={{ color: C.coral, fontSize: 13, fontWeight: '700', marginTop: 12 }}>{err}</Text> : null}
              <Pressable onPress={submit} disabled={!ready || busy} accessibilityRole="button"
                style={{ marginTop: 22, backgroundColor: C.purple, borderRadius: 18, paddingVertical: 17, alignItems: 'center', opacity: ready && !busy ? 1 : 0.45 }}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16.5, fontWeight: '800' }}>{t('ha_send')}</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
