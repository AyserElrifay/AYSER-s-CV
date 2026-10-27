import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { teacherApply, myTeacherApplication } from '../services/offers';
import { useSheetBack } from '../hooks/useSheetBack';
import { MailLine } from './MailLine';
import { MAIL } from '../constants/contacts';
import { tapLight, tapMedium, tapSuccess, tapSelection } from '../utils/feedback';

/* ─── TEACH A WORKSHOP ON MOMENTS ─────────────────────────────────────
   What you teach, a few lines about you, and a link to your work if you
   have one. A person on the team reads it and answers; a yes puts the
   subjects on your profile and lets the team name you as the teacher
   of a workshop. Teaching children is checked by the team in person
   first — the form says so before anybody sends it. */

export const SUBJECTS = [
  ['writing', '✍️'], ['poetry', '📜'], ['dance', '💃'], ['music', '🎸'],
  ['singing', '🎤'], ['art', '🎨'], ['languages', '💬'], ['kids', '🧸'],
];

export const TeacherApplySheet = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [mine, setMine] = useState(undefined);
  const [subs, setSubs] = useState([]);
  const [about, setAbout] = useState('');
  const [years, setYears] = useState('');
  const [link, setLink] = useState('');
  const [city, setCity] = useState('');
  const [kids, setKids] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (user) myTeacherApplication().then((r) => setMine(r || null)); else setMine(null); }, [user]);

  const flip = (k) => { tapSelection(); setSubs((s) => (s.indexOf(k) >= 0 ? s.filter((x) => x !== k) : s.concat(k))); if (k === 'kids') setKids((v) => !v); };
  const send = async () => {
    if (!user) { setErr(t('ta_err_signed_out')); return; }
    if (!subs.length) { setErr(t('ta_err_no_subject')); return; }
    if (about.trim().length < 20) { setErr(t('ta_err_short')); return; }
    if (!agree) { setErr(t('ta_err_no_terms')); return; }
    tapMedium(); setBusy(true); setErr(null);
    const r = await teacherApply({ subjects: subs, about: about.trim(), years, link: link.trim(), city: city.trim(), kids, agree });
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setEditing(false); setMine({ status: 'pending', subjects: subs }); return; }
    setErr(t('ta_err_' + (['no_subject', 'short', 'no_terms', 'signed_out'].indexOf(r && r.reason) >= 0 ? r.reason : 'other')));
  };

  const input = { color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginTop: 8, outlineStyle: 'none' };
  const showForm = mine === null || editing || (mine && mine.status === 'declined');

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 50 }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ alignSelf: 'flex-start' }}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 30, fontWeight: '900', marginTop: 12 }}>{'🎓 ' + t('ta_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 15, lineHeight: 22, marginTop: 6 }}>{t('ta_sub')}</Text>

          {mine === undefined ? <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} /> : !showForm ? (
            <View style={{ marginTop: 22, borderRadius: 18, padding: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ color: mine.status === 'approved' ? C.green : C.text, fontSize: 16, fontWeight: '900' }}>
                {mine.status === 'approved' ? '✓ ' + t('ta_approved') : '⏳ ' + t('ta_pending')}
              </Text>
              <Pressable onPress={() => { tapLight(); setSubs(mine.subjects || []); setAbout(mine.about || ''); setEditing(true); }} style={{ marginTop: 10 }}>
                <Text style={{ color: C.purple, fontSize: 14, fontWeight: '800' }}>{t('ta_edit')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: 18 }}>
              {mine && mine.status === 'declined' ? <Text style={{ color: C.dim, fontSize: 14, marginBottom: 10 }}>{t('ta_declined')}</Text> : null}
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{t('ta_what')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {SUBJECTS.map(([k, e]) => {
                  const on = subs.indexOf(k) >= 0;
                  return (
                    <Pressable key={k} onPress={() => flip(k)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ marginEnd: 8, marginBottom: 8 }}>
                      <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purpleSoft : 'transparent' }}>
                        <Text style={{ color: on ? C.purple : C.text, fontSize: 14, fontWeight: '800' }}>{e + ' ' + t('ws_' + k)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput value={about} onChangeText={setAbout} maxLength={800} multiline placeholder={t('ta_about_ph')} placeholderTextColor={C.faint} style={[input, { minHeight: 110, textAlignVertical: 'top' }]} />
              <View style={{ flexDirection: 'row' }}>
                <TextInput value={years} onChangeText={(v) => setYears(v.replace(/[^0-9]/g, '').slice(0, 2))} keyboardType="number-pad" placeholder={t('ta_years_ph')} placeholderTextColor={C.faint} style={[input, { flex: 1, minWidth: 0, marginEnd: 8 }]} />
                <TextInput value={city} onChangeText={setCity} maxLength={80} placeholder={t('ta_city_ph')} placeholderTextColor={C.faint} style={[input, { flex: 1, minWidth: 0 }]} />
              </View>
              <TextInput value={link} onChangeText={setLink} maxLength={300} autoCapitalize="none" placeholder={t('ta_link_ph')} placeholderTextColor={C.faint} style={input} />
              {kids ? (
                <View style={{ marginTop: 12, borderRadius: 14, padding: 12, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)' }}>
                  <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19 }}>{'🧸 ' + t('ta_kids_note')}</Text>
                </View>
              ) : null}
              <Pressable onPress={() => { tapSelection(); setAgree((v) => !v); setErr(null); }} accessibilityRole="checkbox" accessibilityState={{ checked: agree }}
                style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14 }}>
                <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={20} color={agree ? C.purple : C.dim} />
                <Text style={{ flex: 1, color: C.text, fontSize: 13.5, lineHeight: 19, marginStart: 8 }}>{t('ta_agree')}</Text>
              </Pressable>
              {err ? <Text style={{ color: '#E11D48', fontSize: 13.5, marginTop: 10 }}>{err}</Text> : null}
              <Pressable onPress={send} disabled={busy} accessibilityRole="button" style={{ marginTop: 16 }}>
                <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', backgroundColor: C.purple, opacity: busy ? 0.6 : 1 }}>
                  {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{t('ta_send')}</Text>}
                </View>
              </Pressable>
            </View>
          )}
          <MailLine to={MAIL.community} subject="Teaching on Moments" />
        </ScrollView>
      </View>
    </Modal>
  );
};
