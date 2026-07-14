import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { INITIAL_TX, PLANNER_INIT, SQUADS } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { getProfile, updateProfile } from '../services/profiles';
import { countMyReferrals, fetchMyReferralBreakdown } from '../services/broker';
import { getPrefs, setPref, subscribePrefs } from '../services/prefs';
import {
  Glass, Micro, Chip, SectionHeader,
  NeonButton, AvatarStack,
} from '../components';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess } from '../utils/sfx';

const SUPPORT_EMAIL = 'ayseryourlifecoach@gmail.com';

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
  const [tx, setTx] = useState(INITIAL_TX);
  const [split, setSplit] = useState(false);
  const [planner, setPlanner] = useState(PLANNER_INIT);
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

  const openHelp = () => {
    tapLight();
    Linking.openURL('mailto:' + SUPPORT_EMAIL + '?subject=Moments%20support').catch(() => {});
  };

  // ── Real language-exchange opt-in (HelloTalk-style) ──
  const [speaks, setSpeaks] = useState('');
  const [learning, setLearning] = useState('');
  const [level, setLevel] = useState('');
  const [visible, setVisible] = useState(false);
  const [savedExchange, setSavedExchange] = useState(false);

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
    } catch (e) {}
  };

  const togglePlan = (cardId, idx) =>
    setPlanner((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? { ...card, items: card.items.map((it, i) => (i === idx ? { ...it, done: !it.done } : it)) }
          : card
      )
    );

  const confirmSplit = () => {
    setTx((prev) => [
      { id: 't' + Date.now(), icon: '🌙', label: 'Split — Rooftop Night', sub: '4 Roam Mates · requests sent', amount: '+255', pos: true },
      ...prev,
    ]);
    setSplit(false);
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
        <Micro color={C.faint}>Wallet</Micro>
        <LinearGradient
          colors={['#8B5CF6', '#5B21B6', '#2A0F63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: R, padding: 18, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Micro color="rgba(255,255,255,0.75)">Referral earnings</Micro>
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
            You earn a commission when mates book or shop through your links.
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 18 }}>
            <NeonButton small label="SPLIT A BILL" icon="➗" style={{ flex: 1 }} onPress={() => setSplit((s) => !s)} />
          </View>
        </LinearGradient>

        {split ? (
          <Glass tint={C.greenSoft} border="rgba(16,185,129,0.45)" style={{ padding: 14, marginTop: 12 }}>
            <Micro color={C.green}>Split with Neon Desert Crew</Micro>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <AvatarStack uris={SQUADS[0].members} />
              <Text style={{ color: C.dim, fontSize: 13, marginLeft: 12, flex: 1 }}>E£ 340 ÷ 4</Text>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>E£ 85 each</Text>
            </View>
            <NeonButton small label="SEND SPLIT REQUEST" style={{ marginTop: 14 }} onPress={confirmSplit} />
          </Glass>
        ) : null}

        {/* ── EARNINGS BY PARTNER — real clicks, real money trail ── */}
        {breakdown.length ? (
          <>
            <SectionHeader title="Earnings by partner 💸" style={{ marginTop: 22 }} />
            <Glass style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {breakdown.map((b, i) => (
                <View key={b.partner} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: C.line }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', textTransform: 'capitalize' }}>{b.partner}</Text>
                    <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>Commission: {b.rate}</Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '900', marginRight: 10 }}>{b.clicks} click{b.clicks === 1 ? '' : 's'}</Text>
                  <View style={{ backgroundColor: b.active ? C.greenSoft : 'rgba(245,179,1,0.12)', borderWidth: 1, borderColor: b.active ? 'rgba(16,185,129,0.4)' : 'rgba(245,179,1,0.45)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ color: b.active ? C.green : '#8A6400', fontSize: 9.5, fontWeight: '900' }}>{b.active ? 'EARNING' : 'TAG PENDING'}</Text>
                  </View>
                </View>
              ))}
            </Glass>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
              "TAG PENDING" = clicks are tracked, but the affiliate account isn't connected yet — see MONETIZATION.md to activate each partner.
            </Text>
          </>
        ) : null}

        <SectionHeader title="Recent Activity" style={{ marginTop: 22 }} />
        <Glass style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
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
        <SectionHeader title="Preferences" style={{ marginTop: 26 }} />
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
        <SectionHeader title="Support" style={{ marginTop: 26 }} />
        <Glass style={{ paddingHorizontal: 12, paddingVertical: 2 }}>
          <Pressable onPress={openHelp}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="help-circle-outline" size={16} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>Help & support</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>Email us — we actually reply</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.faint} />
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }}>
            <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="information-circle-outline" size={16} color={C.purple} />
            </View>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1 }}>About Moments</Text>
            <Text style={{ color: C.faint, fontSize: 13 }}>v1.0 · Live</Text>
          </View>
        </Glass>

        {/* ── LANGUAGE EXCHANGE — real opt-in, HelloTalk-style ── */}
        <SectionHeader title="Learn languages 🌍" style={{ marginTop: 26 }} />
        {SUPABASE_READY ? (
          <Glass style={{ padding: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>Show me for language exchange</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>Real people will see you in Chats → Learn languages</Text>
              </View>
              <Pressable onPress={() => { const n = !visible; setVisible(n); saveExchange(n); }}>
                <View style={{ width: 46, height: 27, borderRadius: 14, backgroundColor: visible ? C.purple : C.glassHi, padding: 3, justifyContent: 'center' }}>
                  <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFF', marginLeft: visible ? 19 : 0 }} />
                </View>
              </Pressable>
            </View>
            <TextInput
              placeholder="Language you speak (e.g. Arabic)"
              placeholderTextColor={C.faint}
              value={speaks}
              onChangeText={setSpeaks}
              style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}
            />
            <TextInput
              placeholder="Language you're learning (e.g. Korean)"
              placeholderTextColor={C.faint}
              value={learning}
              onChangeText={setLearning}
              style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}
            />
            <TextInput
              placeholder="Level (e.g. A2, B1…)"
              placeholderTextColor={C.faint}
              value={level}
              onChangeText={setLevel}
              style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }}
            />
            <Pressable onPress={() => saveExchange(visible)}>
              <View style={{ backgroundColor: C.purple, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{savedExchange ? 'Saved ✓' : 'Save'}</Text>
              </View>
            </Pressable>
          </Glass>
        ) : (
          <Glass style={{ padding: 15, alignItems: 'center' }}>
            <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center' }}>Connect Supabase to turn on language exchange</Text>
          </Glass>
        )}

        {/* ── MINI BARDI — one small planner, nothing more ── */}
        <SectionHeader title="Mini Bardi 📓" style={{ marginTop: 26 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {planner.map((card) => {
            const doneCount = card.items.filter((i) => i.done).length;
            return (
              <Glass key={card.id} style={{ width: 232, padding: 14, marginRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>
                    {card.emoji}  {card.title}
                  </Text>
                  <Chip label={doneCount + '/' + card.items.length} color={doneCount === card.items.length ? C.green : C.dim} />
                </View>
                {card.items.map((it, idx) => (
                  <Pressable key={idx} onPress={() => togglePlan(card.id, idx)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11 }}>
                    <Ionicons name={it.done ? 'checkbox' : 'square-outline'} size={18} color={it.done ? C.green : C.faint} />
                    <Text
                      style={{
                        color: it.done ? C.faint : C.text, fontSize: 12.5, marginLeft: 9, flex: 1,
                        textDecorationLine: it.done ? 'line-through' : 'none',
                      }}
                    >
                      {it.t}
                    </Text>
                  </Pressable>
                ))}
              </Glass>
            );
          })}
        </ScrollView>

        {/* ── ACCOUNT ── */}
        <SectionHeader title="Account" style={{ marginTop: 26 }} />
        <Glass style={{ padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: C.text, fontWeight: 'bold' }}>
              {isDemo ? 'Demo session' : (user && user.email) || 'Signed in'}
            </Text>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>
              {isDemo ? 'Nothing is saved — connect Supabase to go live' : 'Powered by Supabase Auth ⚡'}
            </Text>
          </View>
          <Pressable onPress={signOut} style={{ backgroundColor: C.coralSoft, borderWidth: 1, borderColor: 'rgba(244,63,94,0.4)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}>
            <Text style={{ color: C.coral, fontSize: 12, fontWeight: '900' }}>{t('sign_out')}</Text>
          </Pressable>
        </Glass>
      </ScrollView>

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
