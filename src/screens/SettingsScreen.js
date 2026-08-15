import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { isOwner } from '../services/music';
import { recent, clearCrashes, asText } from '../lib/crashLog';
import {
  cachedAccountSettings, subscribeAccountSettings, saveMessageTtl, DEFAULT_MESSAGE_TTL_HOURS,
} from '../services/accountSettings';
import { INITIAL_TX, PLANNER_INIT } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getProfile, updateProfile } from '../services/profiles';
import { countMyReferrals, fetchMyReferralBreakdown } from '../services/broker';
import { fetchMyMates } from '../services/mates';
import { getOrCreateDmThread, sendMessage } from '../services/messages';
import { AV_NEUTRAL } from '../constants/mockData';
import { getPrefs, setPref, subscribePrefs } from '../services/prefs';
import {
  Glass, Micro, Chip, SectionHeader,
  NeonButton, TermsSheet, BardiSheet, HelpSheet, GestureTour,
} from '../components';

/* Common languages for the exchange pickers — flag + name, tap to choose. */
const LANGUAGES = [
  { c: 'Arabic', f: '🇪🇬' }, { c: 'English', f: '🇬🇧' }, { c: 'French', f: '🇫🇷' },
  { c: 'Spanish', f: '🇪🇸' }, { c: 'German', f: '🇩🇪' }, { c: 'Italian', f: '🇮🇹' },
  { c: 'Portuguese', f: '🇵🇹' }, { c: 'Turkish', f: '🇹🇷' }, { c: 'Russian', f: '🇷🇺' },
  { c: 'Chinese', f: '🇨🇳' }, { c: 'Japanese', f: '🇯🇵' }, { c: 'Korean', f: '🇰🇷' },
  { c: 'Hindi', f: '🇮🇳' }, { c: 'Dutch', f: '🇳🇱' }, { c: 'Greek', f: '🇬🇷' },
  { c: 'Romanian', f: '🇷🇴' }, { c: 'Persian', f: '🇮🇷' }, { c: 'Urdu', f: '🇵🇰' },
];
const LEVELS = ['Beginner', 'A2', 'B1', 'B2', 'Fluent'];
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess } from '../utils/sfx';
import { setupNotice } from '../lib/plumbing';

/* A real, persisted on/off switch. */
const Toggle = ({ on, onToggle }) => (
  <Pressable onPress={onToggle} hitSlop={6}>
    <View style={{ width: 46, height: 27, borderRadius: 14, backgroundColor: on ? C.purple : C.glassHi, padding: 3, justifyContent: 'center' }}>
      <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFF', marginLeft: on ? 19 : 0 }} />
    </View>
  </Pressable>
);

/* ─── SETTINGS — the app drawer, opened from Your Space ───
   Wallet lives here now (moved out of the profile), alongside the
   iOS-style settings list and the super-app tools. */

export const SettingsScreen = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { signOut, isDemo, user } = useAuth();
  const { t, lang, setLang, langs, meta } = useLang();
  const { isDark, pref, setThemePref } = useTheme();
  // Real mode starts with NO activity — only things that truly happened
  // (real splits you shared) get added. The sample rows are demo-only.
  const [tx, setTx] = useState(SUPABASE_READY ? [] : INITIAL_TX);
  const [termsOpen, setTermsOpen] = useState(false);
  const [split, setSplit] = useState(false);
  const [splitTotal, setSplitTotal] = useState('');
  const [splitPeople, setSplitPeople] = useState('2');
  const [splitBusy, setSplitBusy] = useState(false);
  const [splitNote, setSplitNote] = useState(null);
  const [splitMates, setSplitMates] = useState(null); // your real mates to share with
  const splitPer = (() => {
    const total = parseFloat(splitTotal) || 0;
    const ppl = Math.max(1, parseInt(splitPeople, 10) || 1);
    return { total, ppl, per: total / ppl };
  })();
  const [planner, setPlanner] = useState(PLANNER_INIT);
  const [bardiOpen, setBardiOpen] = useState(false);
  const [gamesArOn, setGamesArOn] = useState(() => { try { return typeof localStorage !== 'undefined' && localStorage.getItem('mm_games_ar') === '1'; } catch (e) { return false; } });
  const [langOpen, setLangOpen] = useState(false);
  const [prefs, setPrefs] = useState(getPrefs());
  const [referrals, setReferrals] = useState(null);

  // real, persisted preference toggles
  useEffect(() => subscribePrefs(setPrefs), []);
  const flip = (key) => { tapSelection(); setPref(key, !prefs[key]); };

  // real earnings signal — how many mates you've referred to partners
  const [breakdown, setBreakdown] = useState([]);
  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    countMyReferrals(user.id).then(setReferrals).catch(() => {});
    fetchMyReferralBreakdown(user.id).then(setBreakdown).catch(() => {});
  }, [user]);

  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  // the account's message timer — 48h until they say otherwise
  const [msgTtl, setMsgTtl] = useState(() => {
    const s = cachedAccountSettings();
    return s.messageTtlHours == null ? DEFAULT_MESSAGE_TTL_HOURS : s.messageTtlHours;
  });
  useEffect(() => subscribeAccountSettings((s) => {
    setMsgTtl(s.messageTtlHours == null ? DEFAULT_MESSAGE_TTL_HOURS : s.messageTtlHours);
  }), []);
  const [crashCount, setCrashCount] = useState(0);
  useEffect(() => { try { setCrashCount(recent().length); } catch (e) {} }, [logOpen]);

  // ── Real language-exchange opt-in (HelloTalk-style) ──
  const [speaks, setSpeaks] = useState('');
  const [learning, setLearning] = useState('');
  const [level, setLevel] = useState('');
  const [visible, setVisible] = useState(false);
  const [savedExchange, setSavedExchange] = useState(false);
  const [exchangeErr, setExchangeErr] = useState(null);

  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    getProfile(user.id).then((p) => {
      setSpeaks(p.speaks_language || '');
      setLearning(p.learning_language || '');
      setLevel(p.learning_level || '');
      setVisible(!!p.learning_visible);
    }).catch(() => {});
  }, [user]);

  const saveExchange = async (nextVisible) => {
    if (!SUPABASE_READY || !user) return;
    setExchangeErr(null);
    try {
      await updateProfile(user.id, {
        speaks_language: speaks.trim() || null,
        learning_language: learning.trim() || null,
        learning_level: level.trim() || null,
        learning_visible: nextVisible,
      });
      tapSuccess(); sfxSuccess();
      setSavedExchange(true);
      setTimeout(() => setSavedExchange(false), 2000);
    } catch (e) {
      setVisible(!nextVisible); // revert the toggle — it did NOT save
      setExchangeErr(/does not exist|schema cache|column/i.test(e.message || '')
        ? setupNotice('One step left: run supabase/RUN_ME.sql to turn on language exchange.')
        : 'Could not save — try again.');
    }
  };

  const togglePlan = (cardId, idx) =>
    setPlanner((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? { ...card, items: card.items.map((it, i) => (i === idx ? { ...it, done: !it.done } : it)) }
          : card
      )
    );

  /* Open the split panel → load your REAL mates so you can send the
     request to someone who actually exists. */
  const openSplit = () => {
    tapLight();
    setSplit((s) => !s);
    setSplitNote(null);
    if (SUPABASE_READY && user && splitMates === null) {
      fetchMyMates(user.id).then(setSplitMates).catch(() => setSplitMates([]));
    }
  };

  /* Share the split with a real mate — a REAL DM lands in their chat,
     and only then does a REAL activity row appear here. */
  const sendSplitTo = async (mate) => {
    if (splitBusy || !(splitPer.total > 0)) return;
    if (!SUPABASE_READY || !user) { setSplitNote('Sign in to send a split.'); return; }
    setSplitBusy(true);
    setSplitNote(null);
    const money = (n) => (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    try {
      const threadId = await getOrCreateDmThread(mate.id, user && user.id);
      await sendMessage({
        dmThreadId: threadId, userId: user.id,
        body: '🧾 Bill split — total ' + money(splitPer.total) + ' ÷ ' + splitPer.ppl + ' = ' + money(splitPer.per) + ' each. Your share: ' + money(splitPer.per),
      });
      tapSuccess(); sfxSuccess();
      setTx((prev) => [
        { id: 't' + Date.now(), icon: '🧾', label: 'Split sent to ' + (mate.name || 'a mate'), sub: money(splitPer.total) + ' ÷ ' + splitPer.ppl + ' people', amount: money(splitPer.per), pos: true },
        ...prev,
      ]);
      setSplitNote('Sent to ' + (mate.name || 'your mate') + ' ✓ — it landed in your chat.');
      setSplitTotal('');
    } catch (e) {
      setSplitNote(/does not exist|schema cache|recursion/i.test(e.message || '')
        ? setupNotice('Chat needs one more step: run supabase/RUN_ME.sql first.')
        : 'Could not send — try again.');
    } finally {
      setSplitBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line }}>
        <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10} style={{ marginRight: 6 }}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </Pressable>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{t('settings')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── WALLET (Moment Bank) ── */}
        <Micro color={C.faint}>{t('wallet')}</Micro>
        <LinearGradient
          colors={['#8B5CF6', '#5B21B6', '#2A0F63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: R, padding: 18, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Micro color="rgba(255,255,255,0.75)">{t('referral_earnings')}</Micro>
            <Ionicons name="trending-up-outline" size={16} color="rgba(255,255,255,0.75)" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 }}>
            <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 0.5 }}>
              {referrals == null ? '—' : referrals}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '800', marginLeft: 8, marginBottom: 6 }}>
              referral{referrals === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 4 }}>
            {t('referral_hint')}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 18 }}>
            <NeonButton small label={t('split_a_bill_caps')} icon="➗" style={{ flex: 1 }} onPress={openSplit} />
          </View>
        </LinearGradient>

        {split ? (
          <Glass tint={C.greenSoft} border="rgba(16,185,129,0.45)" style={{ padding: 14, marginTop: 12 }}>
            <Micro color={C.green}>{t('split_for_real')}</Micro>
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TextInput
                placeholder={t('total_placeholder')} placeholderTextColor={C.faint} value={splitTotal} onChangeText={setSplitTotal}
                keyboardType="decimal-pad"
                style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: '800', backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12 }}>
                <Pressable onPress={() => { tapSelection(); setSplitPeople(String(Math.max(1, (parseInt(splitPeople, 10) || 1) - 1))); }} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Ionicons name="remove" size={16} color={C.purple} />
                </Pressable>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', minWidth: 22, textAlign: 'center' }}>{splitPeople}</Text>
                <Pressable onPress={() => { tapSelection(); setSplitPeople(String((parseInt(splitPeople, 10) || 1) + 1)); }} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Ionicons name="add" size={16} color={C.purple} />
                </Pressable>
              </View>
            </View>
            {splitPer.total > 0 ? (
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>
                = {(Math.round(splitPer.per * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
              </Text>
            ) : null}

            <Micro color={C.dim} style={{ marginTop: 12 }}>{t('send_to_a_mate')}</Micro>
            {splitMates === null ? (
              <Text style={{ color: C.faint, fontSize: 12, paddingVertical: 10 }}>{t('loading_mates')}</Text>
            ) : splitMates.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {splitMates.map((m) => (
                  <Pressable key={m.id} onPress={() => sendSplitTo(m)} disabled={splitBusy || !(splitPer.total > 0)} style={{ alignItems: 'center', marginRight: 12, width: 62, opacity: splitPer.total > 0 ? 1 : 0.45 }}>
                    <Image source={{ uri: m.avatar_url || AV_NEUTRAL }} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: C.green }} />
                    <Text style={{ color: C.dim, fontSize: 10.5, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{(m.name || 'Mate').split(' ')[0]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={{ color: C.faint, fontSize: 12, paddingVertical: 10 }}>
                {t('no_mates_yet')}
              </Text>
            )}
            {splitNote ? (
              <Text style={{ color: /✓/.test(splitNote) ? C.green : C.coral, fontSize: 12, fontWeight: '700', marginTop: 10 }}>{splitNote}</Text>
            ) : null}
          </Glass>
        ) : null}

        {/* ── EARNINGS BY PARTNER — real clicks, real money trail ── */}
        {breakdown.length ? (
          <>
            <SectionHeader title={t('earnings_by_partner')} style={{ marginTop: 22 }} />
            <Glass style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {breakdown.map((b, i) => (
                <View key={b.partner} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: C.line }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', textTransform: 'capitalize' }}>{b.partner}</Text>
                    <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>{t('commission_label')} {b.rate}</Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '900', marginRight: 10 }}>{b.clicks} click{b.clicks === 1 ? '' : 's'}</Text>
                  <View style={{ backgroundColor: b.active ? C.greenSoft : 'rgba(245,179,1,0.12)', borderWidth: 1, borderColor: b.active ? 'rgba(16,185,129,0.4)' : 'rgba(245,179,1,0.45)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ color: b.active ? C.green : '#8A6400', fontSize: 9.5, fontWeight: '900' }}>{b.active ? 'EARNING' : 'TAG PENDING'}</Text>
                  </View>
                </View>
              ))}
            </Glass>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
              {t('tag_pending_hint')}
            </Text>
          </>
        ) : null}

        <SectionHeader title={t('recent_activity')} style={{ marginTop: 22 }} />
        <Glass style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          {tx.length === 0 ? (
            <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', paddingVertical: 18, lineHeight: 18 }}>
              {t('no_activity')}
            </Text>
          ) : null}
          {tx.map((t, i) => (
            <View
              key={t.id}
              style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: C.line,
              }}
            >
              <Text style={{ fontSize: 19, marginRight: 12 }}>{t.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700' }}>{t.label}</Text>
                <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>{t.sub}</Text>
              </View>
              <Text style={{ color: t.pos ? C.green : C.text, fontSize: 14, fontWeight: '900' }}>{t.amount} $M</Text>
            </View>
          ))}
        </Glass>

        {/* ── PREFERENCES — real, persisted toggles ── */}
        <SectionHeader title={t('preferences')} style={{ marginTop: 26 }} />
        <Glass style={{ paddingHorizontal: 12, paddingVertical: 2 }}>
          {/* Language — opens the picker */}
          <Pressable onPress={() => { tapSelection(); setLangOpen(true); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="language-outline" size={16} color={C.purple} />
              </View>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{t('language')}</Text>
              <Text style={{ color: C.faint, fontSize: 13, marginRight: 6 }}>{meta.flag} {meta.native}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.faint} />
            </View>
          </Pressable>

          {/* Appearance — real theme, not a preview. Three choices,
              because "follow my phone" is a different thing from "dark":
              set it once at sunset system-wide and every app should
              already know. */}
          <View style={{ paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={isDark ? 'moon' : 'moon-outline'} size={16} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{t('appearance')}</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>
                  {pref === 'auto'
                    ? 'Following your phone — ' + (isDark ? 'dark right now' : 'light right now')
                    : 'Easier on the eyes at night'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 11, backgroundColor: C.glass, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: C.line }}>
              {[
                { k: 'auto', label: 'Auto', icon: 'phone-portrait-outline' },
                { k: 'light', label: 'Light', icon: 'sunny-outline' },
                { k: 'dark', label: 'Dark', icon: 'moon-outline' },
              ].map((o) => {
                const on = pref === o.k;
                return (
                  <Pressable key={o.k} onPress={() => { tapSelection(); setThemePref(o.k); }} style={{ flex: 1 }}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      paddingVertical: 9, borderRadius: 10,
                      backgroundColor: on ? C.purple : 'transparent',
                    }}>
                      <Ionicons name={o.icon} size={14} color={on ? '#FFF' : C.faint} />
                      <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12.5, fontWeight: '800', marginLeft: 6 }}>{o.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {[
            { key: 'notifications', icon: 'notifications-outline', label: 'Notifications', hint: 'Vibes, comments & squad activity' },
            { key: 'sound', icon: 'musical-notes-outline', label: 'Sounds', hint: 'The Moments sound identity' },
            { key: 'haptics', icon: 'phone-portrait-outline', label: 'Haptics', hint: 'Tactile taps (on your phone)' },
          ].map((row) => (
            <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={row.icon} size={16} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{row.label}</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{row.hint}</Text>
              </View>
              <Toggle on={!!prefs[row.key]} onToggle={() => flip(row.key)} />
            </View>
          ))}
        </Glass>

        {/* ── SUPPORT ── */}
        <SectionHeader title={t('support')} style={{ marginTop: 26 }} />
        <Glass style={{ paddingHorizontal: 12, paddingVertical: 2 }}>
          {/* How long messages live. This one deletes things, so it says
              so plainly and shows what is actually in force — a timer
              you can't see is a timer you'll be surprised by. It follows
              your account, not this phone. */}
          <View style={{ paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="timer-outline" size={16} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{t('messages_disappear_after')}</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>
                  {msgTtl === 0
                    ? 'Kept until you delete them'
                    : 'Older messages are deleted for both of you'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 11, backgroundColor: C.glass, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: C.line }}>
              {[
                { h: 24, label: '24h' },
                { h: 48, label: '48h' },
                { h: 168, label: '1 week' },
                { h: 0, label: 'Keep' },
              ].map((o) => {
                const on = msgTtl === o.h;
                return (
                  <Pressable
                    key={o.h}
                    onPress={() => { tapSelection(); setMsgTtl(o.h); saveMessageTtl(o.h); }}
                    style={{ flex: 1 }}
                  >
                    <View style={{ paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: on ? C.purple : 'transparent' }}>
                      <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12.5, fontWeight: '800' }}>{o.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
              {t('ttl_default_hint')}
            </Text>
          </View>

          {/* Owner only. A crash on a real phone has to leave something
              behind or the only way to fix it is guessing — this is
              where what it left gets read back. Nobody else sees it. */}
          {isOwner(user) ? (
            <Pressable onPress={() => { tapLight(); setLogOpen(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
                <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="bug-outline" size={16} color={C.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>What went wrong</Text>
                  <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>
                    {crashCount ? crashCount + (crashCount === 1 ? ' failure kept' : ' failures kept') : 'Nothing has failed'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.faint} />
              </View>
            </Pressable>
          ) : null}

          {/* A lesson you only get once is no use if you were half
              awake the first time. */}
          <Pressable onPress={() => { tapLight(); setTourOpen(true); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="hand-left-outline" size={16} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{t('show_gestures')}</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{t('gestures_hint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.faint} />
            </View>
          </Pressable>
          <Pressable onPress={() => { tapLight(); setHelpOpen(true); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="help-circle-outline" size={16} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{t('help_support')}</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{t('help_hint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.faint} />
            </View>
          </Pressable>
          <Pressable onPress={() => { tapLight(); setTermsOpen(true); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="shield-checkmark-outline" size={16} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{t('terms_policy')}</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{t('terms_hint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.faint} />
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }}>
            <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="information-circle-outline" size={16} color={C.purple} />
            </View>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{t('about_moments')}</Text>
            <Text style={{ color: C.faint, fontSize: 13 }}>v1.0 · Live</Text>
          </View>
        </Glass>

        {/* ── LANGUAGE EXCHANGE — real opt-in, HelloTalk-style ── */}
        <SectionHeader title={t('learn_languages')} style={{ marginTop: 26 }} />
        {SUPABASE_READY ? (
          <Glass style={{ padding: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{t('show_for_exchange')}</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{t('exchange_where')}</Text>
              </View>
              <Pressable onPress={() => { const n = !visible; setVisible(n); saveExchange(n); }}>
                <View style={{ width: 46, height: 27, borderRadius: 14, backgroundColor: visible ? C.purple : C.glassHi, padding: 3, justifyContent: 'center' }}>
                  <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFF', marginLeft: visible ? 19 : 0 }} />
                </View>
              </Pressable>
            </View>
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', marginBottom: 7 }}>{t('i_speak')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {LANGUAGES.map((l) => {
                const on = speaks === l.c;
                return (
                  <Pressable key={l.c} onPress={() => setSpeaks(on ? '' : l.c)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purple : C.bg, borderWidth: 1, borderColor: on ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}>
                      <Text style={{ fontSize: 14 }}>{l.f}</Text>
                      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 12.5, fontWeight: '800', marginLeft: 5 }}>{l.c}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', marginBottom: 7 }}>{t('i_practise')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {LANGUAGES.map((l) => {
                const on = learning === l.c;
                return (
                  <Pressable key={l.c} onPress={() => setLearning(on ? '' : l.c)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.green : C.bg, borderWidth: 1, borderColor: on ? C.green : C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}>
                      <Text style={{ fontSize: 14 }}>{l.f}</Text>
                      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 12.5, fontWeight: '800', marginLeft: 5 }}>{l.c}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', marginBottom: 7 }}>{t('my_level')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
              {LEVELS.map((lv) => {
                const on = level === lv;
                return (
                  <Pressable key={lv} onPress={() => setLevel(on ? '' : lv)} style={{ marginRight: 8, marginBottom: 8 }}>
                    <View style={{ backgroundColor: on ? C.blue : C.bg, borderWidth: 1, borderColor: on ? C.blue : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                      <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{lv}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => saveExchange(visible)}>
              <View style={{ backgroundColor: C.purple, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{savedExchange ? 'Saved ✓' : 'Save'}</Text>
              </View>
            </Pressable>
            {exchangeErr ? <Text style={{ color: C.coral, fontSize: 11.5, textAlign: 'center', marginTop: 8 }}>{exchangeErr}</Text> : null}
          </Glass>
        ) : (
          <Glass style={{ padding: 15, alignItems: 'center' }}>
            <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center' }}>{t('exchange_offline')}</Text>
          </Glass>
        )}

        {/* ── GAMES — Egyptian-Arabic option ── */}
        <SectionHeader title={t('games_section')} style={{ marginTop: 26 }} />
        <Glass style={{ padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>ألعاب باللهجة المصرية 🇪🇬</Text>
            <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{t('games_in_masri')}</Text>
          </View>
          <Pressable onPress={() => {
            const n = !gamesArOn; setGamesArOn(n);
            try { if (typeof localStorage !== 'undefined') localStorage.setItem('mm_games_ar', n ? '1' : '0'); } catch (e) {}
          }}>
            <View style={{ width: 46, height: 27, borderRadius: 14, backgroundColor: gamesArOn ? C.purple : C.glassHi, padding: 3, justifyContent: 'center' }}>
              <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFF', marginLeft: gamesArOn ? 19 : 0 }} />
            </View>
          </Pressable>
        </Glass>

        {/* ── BARDI — the real assistant (self-understanding, plans, ideas) ── */}
        <SectionHeader title={t('bardi_section')} style={{ marginTop: 26 }} />
        <Pressable onPress={() => setBardiOpen(true)}>
          <Glass style={{ padding: 15, flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('../assets/brand/bardi.png')} style={{ width: 44, height: 44, borderRadius: 13, marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900' }}>{t('talk_to_bardi')}</Text>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{t('bardi_hint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Glass>
        </Pressable>

        {/* ── ACCOUNT ── */}
        <SectionHeader title={t('account')} style={{ marginTop: 26 }} />
        <Glass style={{ padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: C.text, fontWeight: 'bold' }}>
              {isDemo ? 'Demo session' : (user && user.email) || 'Signed in'}
            </Text>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>
              {isDemo ? 'Demo session — nothing is saved' : '🔒 Encrypted & private'}
            </Text>
          </View>
          <Pressable onPress={signOut} style={{ backgroundColor: C.coralSoft, borderWidth: 1, borderColor: 'rgba(244,63,94,0.4)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}>
            <Text style={{ color: C.coral, fontSize: 12, fontWeight: '900' }}>{t('sign_out')}</Text>
          </Pressable>
        </Glass>
      </ScrollView>

      {termsOpen ? <TermsSheet onClose={() => setTermsOpen(false)} /> : null}
      {bardiOpen ? <BardiSheet onClose={() => setBardiOpen(false)} /> : null}
      {helpOpen ? <HelpSheet onClose={() => setHelpOpen(false)} /> : null}
      {tourOpen ? <GestureTour onClose={() => setTourOpen(false)} /> : null}

      {/* the kept failures, in full, for the one account that can act
          on them */}
      {logOpen && isOwner(user) ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setLogOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setLogOpen(false)} />
          <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6, borderWidth: 1, borderColor: C.line, maxHeight: '78%', paddingBottom: insets.bottom + 12 }}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', flex: 1 }}>What went wrong</Text>
              <Pressable
                onPress={() => {
                  try { if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(asText()); } catch (e) {}
                  tapSuccess();
                }}
                hitSlop={8}
                style={{ marginRight: 14 }}
              >
                <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900' }}>Copy all</Text>
              </Pressable>
              <Pressable onPress={() => { clearCrashes(); setCrashCount(0); tapLight(); }} hitSlop={8}>
                <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800' }}>Clear</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {recent().length ? recent().map((c, n) => (
                <View key={n} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 9 }}>
                  <Text style={{ color: C.faint, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>
                    {String(c.where).toUpperCase()} · {c.at.replace('T', ' ').slice(5, 16)}
                  </Text>
                  <Text selectable style={{ color: C.text, fontSize: 12, fontWeight: '700', marginTop: 5 }}>{c.msg}</Text>
                  {c.stack ? <Text selectable style={{ color: C.faint, fontSize: 9.5, marginTop: 5, lineHeight: 13 }}>{c.stack}</Text> : null}
                  {c.extra ? <Text selectable style={{ color: C.dim, fontSize: 9.5, marginTop: 5, lineHeight: 13 }}>{c.extra}</Text> : null}
                </View>
              )) : (
                <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 26 }}>
                  Nothing has failed since this was last cleared.
                </Text>
              )}
            </ScrollView>
          </View>
        </Modal>
      ) : null}

      {/* language picker */}
      {langOpen ? (
        <Pressable onPress={() => setLangOpen(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 14 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900', marginBottom: 6 }}>{t('language')} 🌍</Text>
            {langs.map((l) => {
              const on = l.code === lang;
              return (
                <Pressable key={l.code} onPress={() => { tapSelection(); setLang(l.code); setLangOpen(false); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
                    <Text style={{ fontSize: 24, marginRight: 14 }}>{l.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 15, fontWeight: on ? '900' : '600' }}>{l.native}</Text>
                      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{l.label}</Text>
                    </View>
                    {on ? <Ionicons name="checkmark-circle" size={22} color={C.purple} /> : <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.line }} />}
                  </View>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
};
