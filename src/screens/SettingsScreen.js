import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { INITIAL_TX, PLANNER_INIT, FIXERS, SQUADS, SETTINGS_GROUPS } from '../constants/mockData';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import {
  Glass, Micro, Chip, SectionHeader,
  NeonButton, AvatarStack, RatingBar,
} from '../components';
import { tapLight, tapSelection } from '../utils/feedback';

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
  const [booked, setBooked] = useState({});
  const [langOpen, setLangOpen] = useState(false);

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
            <Micro color="rgba(255,255,255,0.75)">Moment Bank</Micro>
            <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.75)" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 }}>
            <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 0.5 }}>1,284</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '800', marginLeft: 8, marginBottom: 6 }}>$MOMENT</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 4 }}>≈ E£ 6,420 · ▲ 4.2% this week</Text>
          <View style={{ flexDirection: 'row', marginTop: 18 }}>
            <NeonButton small label="SPLIT BILL" icon="➗" style={{ flex: 1.2, marginRight: 8 }} onPress={() => setSplit((s) => !s)} />
            <Pressable style={{ flex: 1, marginRight: 8 }}>
              <View style={{ borderRadius: R - 4, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Send</Text>
              </View>
            </Pressable>
            <Pressable style={{ flex: 1 }}>
              <View style={{ borderRadius: R - 4, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Top Up</Text>
              </View>
            </Pressable>
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

        {/* ── SETTINGS LIST (iOS-style groups) ── */}
        {SETTINGS_GROUPS.map((group) => (
          <View key={group.title}>
            <SectionHeader title={group.title} style={{ marginTop: 26 }} />
            <Glass style={{ paddingHorizontal: 4, paddingVertical: 2 }}>
              {group.rows.map((row, i) => (
                <Pressable key={row.label} onPress={() => { tapSelection(); if (row.icon === 'language-outline') setLangOpen(true); }}>
                  {({ pressed }) => (
                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12,
                        borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: C.line,
                        backgroundColor: pressed ? C.glassHi : 'transparent', borderRadius: 12,
                      }}
                    >
                      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name={row.icon} size={16} color={C.purple} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>
                          {row.icon === 'language-outline' ? t('language') : row.label}
                        </Text>
                        {row.hint ? <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{row.hint}</Text> : null}
                      </View>
                      {row.icon === 'language-outline'
                        ? <Text style={{ color: C.faint, fontSize: 13, marginRight: 6 }}>{meta.flag} {meta.native}</Text>
                        : row.value ? <Text style={{ color: C.faint, fontSize: 13, marginRight: 6 }}>{row.value}</Text> : null}
                      <Ionicons name="chevron-forward" size={16} color={C.faint} />
                    </View>
                  )}
                </Pressable>
              ))}
            </Glass>
          </View>
        ))}

        {/* ── LIFE PLANNER ── */}
        <SectionHeader title="Life Planner · Mini-Notion" style={{ marginTop: 26 }} />
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
          <Glass tint={C.purpleSoft} border="rgba(124,58,237,0.4)" style={{ width: 232, padding: 14, marginRight: 12 }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>📓  Tonight&apos;s page</Text>
            <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 19, marginTop: 11, fontStyle: 'italic' }}>
              “The desert shoot wrapped at 2AM and nobody wanted to leave. Maybe the point was never the footage…”
            </Text>
            <Pressable style={{ marginTop: 12 }}>
              <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900' }}>Continue writing →</Text>
            </Pressable>
          </Glass>
        </ScrollView>

        {/* ── HOME FIXERS ── */}
        <SectionHeader title="Home Fixers · Triple-Rated" style={{ marginTop: 26 }} />
        {FIXERS.map((f) => (
          <Glass key={f.id} style={{ padding: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{f.name}</Text>
                  <Chip label={f.jobs + ' jobs'} style={{ marginLeft: 8 }} color={C.dim} />
                </View>
                <Text style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>{f.trade} · arrives in ⏱ {f.eta}</Text>
              </View>
              <View style={{ width: 96, marginLeft: 8 }}>
                {booked[f.id] ? (
                  <View style={{ borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)', backgroundColor: C.greenSoft, paddingVertical: 9, alignItems: 'center' }}>
                    <Text style={{ color: C.green, fontSize: 11, fontWeight: '900' }}>BOOKED ✓</Text>
                  </View>
                ) : (
                  <NeonButton small label="BOOK" onPress={() => setBooked((b) => ({ ...b, [f.id]: true }))} />
                )}
              </View>
            </View>
            <View style={{ marginTop: 8 }}>
              <RatingBar icon="⚡" label="Speed" value={f.speed} color={C.green} />
              <RatingBar icon="🤝" label="Honesty" value={f.honesty} color={C.blue} />
              <RatingBar icon="💰" label="Price" value={f.price} color={C.purple} />
            </View>
          </Glass>
        ))}

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
