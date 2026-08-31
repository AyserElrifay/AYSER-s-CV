import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, ScrollView, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import {
  fetchArrival, confirmStep, fetchStepNotes, setStepDone, addStep, explainLanding,
} from '../services/landing';

/* ─── FIRST 30 DAYS ─────────────────────────────────────────────────
   The screen for somebody who landed on Tuesday.

   ── WHAT IS ON PURPOSE HERE ──────────────────────────────────────
   Every step wears its age. "3 confirmed · checked 6 days ago" is not
   decoration — it is the only thing that separates this from the blog
   post that was right in 2021, and it is the reason to trust or not
   trust the sentence above it. A step nobody has checked in six
   months says so in plain words rather than quietly rotting.

   Two lists, not one. What the EU guarantees is the same in all
   twenty-seven and is here from the first second. What a city does is
   underneath it and had to be earned: two people, neither of them the
   author, before a newcomer sees it at all. The ones still short of
   that are in their own section, asking to be checked — visible to
   people who live there, never presented to somebody new as fact.

   And the cheapest possible contribution is the main one. Confirming
   is one tap. The sentence afterwards is optional and is where the
   useful part actually comes from — somebody who did it this week
   saying the thing no official page will ever say. */

const ICON = {
  address: 'home-outline', id: 'card-outline', bank: 'wallet-outline',
  health: 'medkit-outline', sim: 'phone-portrait-outline', driving: 'car-outline',
  work: 'briefcase-outline', tax: 'document-text-outline', school: 'school-outline',
  transport: 'bus-outline', other: 'ellipse-outline',
};

/* "checked 6d" rather than a date, because what matters is not when
   somebody looked but how long ago — a date makes you do the
   subtraction, and nobody does it. */
const ago = (iso, t) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (!isFinite(days) || days < 0) return '';
  if (days === 0) return t('ld_last_checked') + ' · ' + t('today_word');
  if (days < 31) return t('ld_last_checked') + ' · ' + days + 'd';
  return t('ld_last_checked') + ' · ' + Math.round(days / 30) + 'mo';
};

const Step = ({ step, me, t, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(null);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState(step.done);

  const toggleDone = () => {
    tapSelection();
    const next = !done;
    setDone(next);
    setStepDone(step.id, next);
  };

  const openNotes = async () => {
    tapLight();
    const next = !open;
    setOpen(next);
    if (next && notes === null) {
      try { setNotes(await fetchStepNotes(step.id)); } catch (e) { setNotes([]); }
    }
  };

  const vouch = async (ok) => {
    if (!me) return;
    tapLight();
    try {
      await confirmStep(step.id, ok, draft);
      setSaved(true);
      setDraft('');
      tapSuccess();
      onChanged && onChanged();
    } catch (e) { /* the next load tells the truth */ }
  };

  return (
    <View style={{
      backgroundColor: C.glass, borderWidth: 1, borderColor: step.stale ? C.goldSoft : C.line,
      borderRadius: 16, padding: 14, marginBottom: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Pressable onPress={toggleDone} hitSlop={8} style={{ marginTop: 1 }}>
          <View style={{
            width: 26, height: 26, borderRadius: 13, borderWidth: 2,
            borderColor: done ? C.green : C.line,
            backgroundColor: done ? C.green : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {done ? <Ionicons name="checkmark" size={15} color="#FFF" /> : null}
          </View>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={ICON[step.slug] || ICON.other} size={14} color={C.faint} />
            <Text style={{ flex: 1, color: done ? C.faint : C.text, fontSize: 14.5, fontWeight: '800', marginLeft: 7, textDecorationLine: done ? 'line-through' : 'none' }}>
              {step.title}
            </Text>
          </View>
          <Text style={{ color: C.dim, fontSize: 13, lineHeight: 20, marginTop: 7 }}>{step.body}</Text>

          {/* the age of the thing you are about to act on */}
          {step.scope === 'eu' ? null : (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 9 }}>
              <Text style={{ color: step.trusted ? C.green : C.gold, fontSize: 11, fontWeight: '800' }}>
                {step.trusted
                  ? step.confirms + ' ' + t('ld_trusted_by')
                  : t('ld_checking')}
              </Text>
              <Text style={{ color: C.faint, fontSize: 11, marginLeft: 8 }}>{ago(step.lastAt, t)}</Text>
              {step.author ? <Text style={{ color: C.faint, fontSize: 11, marginLeft: 8 }}>· {step.author}</Text> : null}
            </View>
          )}
          {step.stale ? (
            <Text style={{ color: C.gold, fontSize: 11.5, marginTop: 5 }}>⚠︎ {t('ld_stale')}</Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Pressable onPress={openNotes} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chatbubble-outline" size={14} color={C.faint} />
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', marginLeft: 5 }}>{t('ld_notes')}</Text>
            </Pressable>
          </View>

          {open ? (
            <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
              {notes === null ? <ActivityIndicator color={C.purple} /> : null}
              {notes && !notes.length ? (
                <Text style={{ color: C.faint, fontSize: 12 }}>{t('ld_no_notes')}</Text>
              ) : null}
              {(notes || []).map((n, i) => (
                <View key={i} style={{ marginBottom: 9 }}>
                  <Text style={{ color: n.stillTrue ? C.dim : C.gold, fontSize: 11.5, fontWeight: '800' }}>
                    {n.name}{n.stillTrue ? '' : ' · ' + t('ld_changed')}
                  </Text>
                  <Text style={{ color: C.text, fontSize: 13, lineHeight: 19, marginTop: 1 }}>{n.note}</Text>
                </View>
              ))}

              {me ? (
                saved ? (
                  <Text style={{ color: C.green, fontSize: 12.5, fontWeight: '800' }}>{t('ld_thanks')}</Text>
                ) : (
                  <>
                    <TextInput
                      value={draft} onChangeText={setDraft} multiline
                      placeholder={t('ld_note_ph')} placeholderTextColor={C.faint}
                      style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, minHeight: 40 }}
                    />
                    <View style={{ flexDirection: 'row', marginTop: 9 }}>
                      <Pressable onPress={() => vouch(true)} style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)', borderRadius: 999, paddingVertical: 9, alignItems: 'center' }}>
                          <Text style={{ color: C.green, fontSize: 12.5, fontWeight: '900' }}>{t('ld_still_right')}</Text>
                        </View>
                      </Pressable>
                      <Pressable onPress={() => vouch(false)} style={{ flex: 1 }}>
                        <View style={{ backgroundColor: C.goldSoft, borderWidth: 1, borderColor: 'rgba(245,179,1,0.4)', borderRadius: 999, paddingVertical: 9, alignItems: 'center' }}>
                          <Text style={{ color: C.gold, fontSize: 12.5, fontWeight: '900' }}>{t('ld_changed')}</Text>
                        </View>
                      </Pressable>
                    </View>
                  </>
                )
              ) : (
                <Text style={{ color: C.faint, fontSize: 12 }}>{t('ld_signin')}</Text>
              )}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const Adder = ({ me, country, city, t, onAdded }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!me) return null;

  const go = async () => {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      await addStep(me.id, { country, city, slug: 'other', title, body });
      setOpen(false); setTitle(''); setBody('');
      onAdded && onAdded();
    } catch (e) { setErr(explainLanding(e)); }
    setBusy(false);
  };

  if (!open) {
    return (
      <Pressable onPress={() => { tapLight(); setOpen(true); }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', borderRadius: 14, paddingVertical: 13, marginTop: 4 }}>
          <Ionicons name="add" size={18} color={C.purple} />
          <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '900', marginLeft: 6 }}>{t('ld_add')}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginTop: 4 }}>
      <TextInput
        value={title} onChangeText={setTitle} autoFocus
        placeholder={t('ld_add_title_ph')} placeholderTextColor={C.faint}
        style={{ color: C.text, fontSize: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 9 }}
      />
      <TextInput
        value={body} onChangeText={setBody} multiline
        placeholder={t('ld_add_body_ph')} placeholderTextColor={C.faint}
        style={{ color: C.text, fontSize: 13.5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: 84 }}
      />
      <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17, marginTop: 9 }}>{t('ld_add_hint')}</Text>
      {err ? <Text style={{ color: C.coral, fontSize: 12, marginTop: 8 }}>{t('ld_signin')}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <Pressable onPress={() => { setOpen(false); setErr(null); }} style={{ flex: 1, marginRight: 8 }}>
          <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
            <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>{t('cancel')}</Text>
          </View>
        </Pressable>
        <Pressable onPress={go} style={{ flex: 1 }} disabled={busy}>
          <View style={{ backgroundColor: title.trim() && body.trim() && !busy ? C.purple : C.glassHi, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
            <Text style={{ color: title.trim() && body.trim() && !busy ? '#FFF' : C.faint, fontSize: 13, fontWeight: '900' }}>{t('ld_add')}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

export const LandingSheet = ({ country, city, place, onClose }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const me = user ? { id: user.id } : null;

  const [steps, setSteps] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    setErr(null);
    fetchArrival(country, city).then(setSteps, (e) => { setErr(explainLanding(e)); setSteps([]); });
  }, [country, city]);
  useEffect(load, [load]);

  const eu = useMemo(() => (steps || []).filter((s) => s.scope === 'eu'), [steps]);
  /* Trusted local steps are the list a newcomer reads. The rest are
     below, marked, for the people who could vouch for them. */
  const here = useMemo(() => (steps || []).filter((s) => s.scope !== 'eu' && s.trusted), [steps]);
  const checking = useMemo(() => (steps || []).filter((s) => s.scope !== 'eu' && !s.trusted), [steps]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{
          backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 10, paddingBottom: insets.bottom + 18, paddingHorizontal: 16, maxHeight: '90%',
        }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>
                {place ? t('ld_open').replace('{place}', place) : t('ld_title')}
              </Text>
              <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 3, marginBottom: 16 }}>{t('ld_sub')}</Text>

              {steps === null ? <ActivityIndicator color={C.purple} style={{ marginVertical: 24 }} /> : null}

              {err ? (
                <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 24, lineHeight: 19 }}>
                  {t(err === 'setup' ? 'gp_err_setup' : err === 'permission' ? 'gp_err_permission' : 'gp_err_offline')}
                </Text>
              ) : null}

              {eu.length ? (
                <>
                  <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 9 }}>
                    {t('ld_eu')}
                  </Text>
                  {eu.map((s) => <Step key={s.id} step={s} me={me} t={t} onChanged={load} />)}
                  <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17, marginBottom: 20 }}>
                    {t('ld_not_advice')}
                  </Text>
                </>
              ) : null}

              {steps !== null && !err ? (
                <>
                  <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 9 }}>
                    {t('ld_here')}{city ? ' · ' + city : ''}
                  </Text>
                  {here.map((s) => <Step key={s.id} step={s} me={me} t={t} onChanged={load} />)}
                  {!here.length ? (
                    <Text style={{ color: C.faint, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
                      {t('ld_empty_city')}
                    </Text>
                  ) : null}

                  {checking.length ? (
                    <>
                      <Text style={{ color: C.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 12, marginBottom: 9 }}>
                        {t('ld_checking').toUpperCase()} · {checking.length}
                      </Text>
                      {checking.map((s) => <Step key={s.id} step={s} me={me} t={t} onChanged={load} />)}
                    </>
                  ) : null}

                  <Adder me={me} country={country} city={city} t={t} onAdded={load} />
                </>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
