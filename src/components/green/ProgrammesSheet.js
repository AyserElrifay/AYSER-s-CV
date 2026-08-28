import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../../constants/theme';
import { useLang } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { tapLight, tapSuccess } from '../../utils/feedback';
import {
  KINDS, kindOf, findProgrammes, myProgrammes, addProgramme,
  joinProgramme, leaveProgramme, whereWhen,
} from '../../services/programmes';

/* ─── EXCHANGES ──────────────────────────────────────────────────────
   Every programme somebody in Moments has actually been on, and a
   group chat behind each one.

   ── SEARCH IS THE FIRST THING, AND THAT IS DELIBERATE ─────────────
   The failure this screen exists to avoid is four people from the same
   exchange sitting in four groups of one. Nobody does that on purpose;
   they do it because "add yours" was the first button they saw.

   So the search box is at the top and it looks before it offers to
   create. And even if two people do type the same thing twice, the
   server puts the second one in the first one's group — see
   programme_add: the same title in the same country in the same year
   is the same programme, whatever spacing or capitals anybody used.
   Tested with four spellings of "Erasmus Budapest": one group, four
   people.

   ── AND IT STARTS EMPTY ───────────────────────────────────────────
   There is no list of well-known programmes waiting here. Until
   somebody says where they have been, this screen says so plainly,
   which is honest and also the invitation.                           */

const GREEN = '#1F7A5A';
const GREEN_SOFT = 'rgba(31,122,90,0.10)';

const Chip = ({ on, children, onPress }) => (
  <Pressable onPress={onPress} style={{ marginEnd: 8, marginBottom: 8 }}>
    <View style={{
      backgroundColor: on ? GREEN : C.glass,
      borderWidth: 1, borderColor: on ? GREEN : C.line,
      borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8,
    }}>
      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 13, fontWeight: '900' }}>{children}</Text>
    </View>
  </Pressable>
);

const Field = ({ label, value, onChange, placeholder, keyboardType, maxLength }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>
      {label}
    </Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.faint}
      keyboardType={keyboardType || 'default'}
      maxLength={maxLength}
      style={{
        backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14,
        paddingHorizontal: 13, paddingVertical: 11, color: C.text, fontSize: 14.5, fontWeight: '700',
      }}
    />
  </View>
);

/* At module scope, and the build made me. Declared inside the sheet it
   is a new component type on every render — so React throws every row
   away and rebuilds it each time somebody types a letter into the
   search box, which is exactly when a list must not flicker.
   scripts/check-rerender.mjs caught it. */
const Row = React.memo(({ p, t, onOpen, onToggle }) => {
  const k = kindOf(p.kind);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.glass, borderWidth: 1, borderColor: p.im_in ? GREEN : C.line,
      borderRadius: 18, padding: 12, marginBottom: 10,
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 15, backgroundColor: GREEN_SOFT,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 19 }}>{p.emoji || k.emoji}</Text>
      </View>
      <Pressable
        onPress={() => { if (p.im_in && onOpen) { tapLight(); onOpen(p); } }}
        style={{ flex: 1, minWidth: 0, marginStart: 11 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: 14.5, fontWeight: '900' }}>
          {p.title}
        </Text>
        <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
          {t(k.key)}{whereWhen(p) ? ' · ' + whereWhen(p) : ''}
        </Text>
        <Text style={{ color: p.im_in ? GREEN : C.faint, fontSize: 11.5, fontWeight: '900', marginTop: 3 }}>
          {t('prog_people').replace('{n}', p.people)}
          {p.im_in ? ' · ' + t('prog_open_chat') : ''}
        </Text>
      </Pressable>
      <Pressable onPress={() => onToggle(p)} hitSlop={8} style={{ paddingHorizontal: 6 }}>
        <Text style={{ color: p.im_in ? C.faint : GREEN, fontSize: 12.5, fontWeight: '900' }}>
          {p.im_in ? t('prog_leave') : t('prog_i_was_there')}
        </Text>
      </Pressable>
    </View>
  );
});

export const ProgrammesSheet = ({ onClose, onOpenGroup }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();

  const [mine, setMine] = useState(null);
  const [found, setFound] = useState(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState(null);        // 'joined_existing' | 'made' | a refusal

  const [form, setForm] = useState({ kind: 'erasmus', title: '', org: '', country: '', city: '', year: '' });

  const load = useCallback(async () => {
    const [m, f] = await Promise.all([myProgrammes(), findProgrammes(q, null, kind)]);
    setMine(m && m.ok ? (m.programmes || []) : []);
    setFound(f && f.ok ? (f.programmes || []) : []);
  }, [q, kind]);

  useEffect(() => {
    /* A small pause so a search runs once when somebody stops typing,
       rather than once per letter. */
    const id = setTimeout(load, q ? 320 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  const join = async (p) => {
    if (busy || !user) return;
    setBusy(true); tapLight();
    const r = p.im_in
      ? await leaveProgramme(p.squad_id, user.id)
      : await joinProgramme(p.squad_id, user.id);
    setBusy(false);
    if (r && r.ok) { tapSuccess(); load(); }
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true); setNote(null);
    const r = await addProgramme({
      kind: form.kind,
      title: form.title,
      org: form.org,
      country: form.country,
      city: form.city,
      year: form.year ? Number(form.year) : null,
    });
    setBusy(false);
    if (r && r.ok) {
      tapSuccess();
      setNote(r.joined_existing ? 'joined_existing' : 'made');
      setAdding(false);
      setForm({ kind: 'erasmus', title: '', org: '', country: '', city: '', year: '' });
      load();
    } else {
      setNote((r && r.reason) || 'offline');
    }
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
          <LinearGradient
            colors={[GREEN, '#123F31']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 22,
                     borderBottomStartRadius: 26, borderBottomEndRadius: 26 }}>
            <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
              <Ionicons name="chevron-down" size={26} color="#FFF" />
            </Pressable>
            <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 12 }}>
              {t('prog_title')}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, marginTop: 4, lineHeight: 19 }}>
              {t('prog_tagline')}
            </Text>
          </LinearGradient>

          <View style={{ padding: 16 }}>
            {/* LOOK BEFORE YOU MAKE ONE. The box is first on the screen
                for the same reason the server de-duplicates: the group
                you want probably already exists. */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
              borderRadius: 14, paddingHorizontal: 12, marginBottom: 12,
            }}>
              <Ionicons name="search" size={16} color={C.faint} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={t('prog_search')}
                placeholderTextColor={C.faint}
                style={{ flex: 1, minWidth: 0, paddingVertical: 11, marginStart: 9, color: C.text, fontSize: 14.5, fontWeight: '700' }}
              />
              {q ? (
                <Pressable onPress={() => setQ('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={C.faint} />
                </Pressable>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
              <Chip on={!kind} onPress={() => { tapLight(); setKind(null); }}>{t('prog_all')}</Chip>
              {KINDS.map((k) => (
                <Chip key={k.id} on={kind === k.id} onPress={() => { tapLight(); setKind(k.id); }}>
                  {k.emoji + ' ' + t(k.key)}
                </Chip>
              ))}
            </View>

            {note ? (
              <View style={{
                backgroundColor: note === 'joined_existing' || note === 'made' ? GREEN_SOFT : C.coralSoft,
                borderRadius: 14, padding: 12, marginBottom: 12,
              }}>
                <Text style={{
                  color: note === 'joined_existing' || note === 'made' ? GREEN : C.coral,
                  fontSize: 13, fontWeight: '800', lineHeight: 19,
                }}>
                  {note === 'joined_existing' ? t('prog_already_there')
                    : note === 'made' ? t('prog_made')
                    : note === 'no_title' ? t('prog_need_title')
                    : note === 'bad_country' ? t('prog_bad_country')
                    : note === 'bad_year' ? t('prog_bad_year')
                    : t('lamma_conn_hint')}
                </Text>
              </View>
            ) : null}

            {/* ── THE ONES YOU HAVE BEEN ON ── */}
            {mine === null ? (
              <ActivityIndicator color={GREEN} style={{ marginVertical: 20 }} />
            ) : mine.length ? (
              <>
                <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 10 }}>
                  {t('prog_yours')}
                </Text>
                {mine.map((p) => <Row key={p.id} p={p} t={t} onOpen={onOpenGroup} onToggle={join} />)}
              </>
            ) : null}

            {/* ── AND EVERYONE ELSE'S ── */}
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: mine && mine.length ? 12 : 0, marginBottom: 10 }}>
              {q ? t('prog_matches') : t('prog_everyone')}
            </Text>
            {found === null ? (
              <ActivityIndicator color={GREEN} style={{ marginVertical: 20 }} />
            ) : found.filter((p) => !p.im_in).length === 0 ? (
              <View style={{
                borderWidth: 1, borderColor: C.line, borderStyle: 'dashed',
                borderRadius: 18, padding: 22, alignItems: 'center', marginBottom: 4,
              }}>
                <Text style={{ fontSize: 24 }}>🎒</Text>
                <Text style={{ color: C.faint, fontSize: 13, fontWeight: '700', marginTop: 9, textAlign: 'center', lineHeight: 19 }}>
                  {q ? t('prog_no_match') : t('prog_none')}
                </Text>
              </View>
            ) : (
              found.filter((p) => !p.im_in).map((p) => (
                <Row key={p.id} p={p} t={t} onOpen={onOpenGroup} onToggle={join} />
              ))
            )}

            {/* ── ADD THE ONE YOU WERE ON ── */}
            {!adding ? (
              <Pressable onPress={() => { tapLight(); setAdding(true); setNote(null); }} style={{ marginTop: 14 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: GREEN, borderRadius: 999, paddingVertical: 14,
                }}>
                  <MaterialCommunityIcons name="plus" size={18} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900', marginStart: 7 }}>
                    {t('prog_add')}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <View style={{
                backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                borderRadius: 20, padding: 14, marginTop: 14,
              }}>
                <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', marginBottom: 12 }}>
                  {t('prog_add')}
                </Text>

                <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>
                  {t('prog_what_kind')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                  {KINDS.map((k) => (
                    <Chip key={k.id} on={form.kind === k.id}
                      onPress={() => { tapLight(); setForm((f) => ({ ...f, kind: k.id })); }}>
                      {k.emoji + ' ' + t(k.key)}
                    </Chip>
                  ))}
                </View>

                <Field label={t('prog_f_title')} value={form.title} maxLength={90}
                  onChange={(v) => setForm((f) => ({ ...f, title: v }))}
                  placeholder={t('prog_ph_title')} />
                <Field label={t('prog_f_org')} value={form.org} maxLength={80}
                  onChange={(v) => setForm((f) => ({ ...f, org: v }))}
                  placeholder={t('prog_ph_org')} />
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flex: 1, marginEnd: 8 }}>
                    <Field label={t('prog_f_city')} value={form.city} maxLength={60}
                      onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                      placeholder={t('prog_ph_city')} />
                  </View>
                  <View style={{ width: 96, marginEnd: 8 }}>
                    <Field label={t('prog_f_country')} value={form.country} maxLength={2}
                      onChange={(v) => setForm((f) => ({ ...f, country: v.toUpperCase() }))}
                      placeholder="HU" />
                  </View>
                  <View style={{ width: 92 }}>
                    <Field label={t('prog_f_year')} value={form.year} maxLength={4} keyboardType="number-pad"
                      onChange={(v) => setForm((f) => ({ ...f, year: v.replace(/[^0-9]/g, '') }))}
                      placeholder="2024" />
                  </View>
                </View>

                <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17, marginBottom: 12 }}>
                  {t('prog_same_note')}
                </Text>

                <View style={{ flexDirection: 'row' }}>
                  <Pressable onPress={() => { tapLight(); setAdding(false); }} style={{ flex: 1, marginEnd: 8 }}>
                    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 13, alignItems: 'center' }}>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '900' }}>{t('cancel')}</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={submit} disabled={busy} style={{ flex: 1 }}>
                    <View style={{ backgroundColor: GREEN, borderRadius: 999, paddingVertical: 13, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{busy ? '…' : t('prog_save')}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
