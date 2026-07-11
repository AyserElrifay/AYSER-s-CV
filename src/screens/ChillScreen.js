import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { COURSES, QUESTS } from '../constants/mockData';
import { Page, ScreenHeader, SectionHeader, Glass, Chip } from '../components';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess, sfxPop } from '../utils/sfx';

/* ────────────── TAB 4 · CHILL — LEARN & UNWIND, CURATED ──────────────
   Courses first (free for everyone; paid = certified creators only,
   every course reviewed before it goes live). Movies & series are
   coming soon. Zero clutter — that's the whole point. */

export const ChillScreen = () => {
  const [enrolled, setEnrolled] = useState({});
  const [teachOpen, setTeachOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [skill, setSkill] = useState('');

  return (
    <Page>
      <ScreenHeader kicker="Learn & unwind" title="Chill Zone 🍿" />

      {/* ── COURSES ── */}
      <SectionHeader title="Courses 🎓" />
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 14, lineHeight: 18 }}>
        Curated, not chaotic. Paid courses come only from certified creators — every course is reviewed before it goes live.
      </Text>
      {COURSES.map((c) => {
        const on = !!enrolled[c.id];
        return (
          <Glass key={c.id} style={{ padding: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 23 }}>{c.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', lineHeight: 20 }}>{c.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <Text style={{ color: C.dim, fontSize: 12 }}>{c.by}</Text>
                  {c.certified ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.blueSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 7 }}>
                      <Text style={{ fontSize: 9 }}>🛡️</Text>
                      <Text style={{ color: C.blue, fontSize: 9.5, fontWeight: '900', marginLeft: 3 }}>CERTIFIED</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 4 }}>
                  ⭐ {c.rating} · {c.students} learners · {c.lessons} lessons
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Chip
                label={c.price}
                color={c.paid ? C.purple : C.green}
                tint={c.paid ? C.purpleSoft : C.greenSoft}
                style={{ borderColor: c.paid ? 'rgba(124,58,237,0.35)' : 'rgba(16,185,129,0.4)' }}
              />
              <View style={{ flex: 1 }} />
              {on ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Ionicons name="checkmark" size={14} color={C.green} />
                  <Text style={{ color: C.green, fontSize: 12, fontWeight: '900', marginLeft: 4 }}>Enrolled</Text>
                </View>
              ) : (
                <Pressable onPress={() => { tapSuccess(); sfxSuccess(); setEnrolled((e) => ({ ...e, [c.id]: true })); }}>
                  <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{c.paid ? 'Enroll · ' + c.price : 'Start free'}</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </Glass>
        );
      })}

      {/* teach on moments — the certified-instructor pipeline */}
      <Glass tint={C.purpleSoft} border="rgba(124,58,237,0.35)" style={{ padding: 15, marginBottom: 24 }}>
        {!teachOpen ? (
          <View>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>Teach on Moments 🎓</Text>
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 5, lineHeight: 18 }}>
              Free courses: anyone can share. Paid courses: certified pros only — apply with proof of your craft, we review, you go live.
            </Text>
            <Pressable onPress={() => { tapLight(); sfxPop(); setTeachOpen(true); }} style={{ marginTop: 11 }}>
              <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900' }}>Apply to teach →</Text>
            </Pressable>
          </View>
        ) : applied ? (
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ fontSize: 30 }}>🕵️</Text>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 6 }}>Application received!</Text>
            <Text style={{ color: C.dim, fontSize: 12, marginTop: 4, textAlign: 'center', lineHeight: 17 }}>
              Our review crew checks your proof (yes, real humans). You'll hear back within 48h.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>Become a certified instructor</Text>
            <TextInput
              placeholder="What do you teach? (e.g. photography, freediving…)"
              placeholderTextColor={C.faint}
              value={skill}
              onChangeText={setSkill}
              style={{ color: C.text, fontSize: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 }}
            />
            <Pressable onPress={tapLight} style={{ marginTop: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }}>
                <Ionicons name="cloud-upload-outline" size={16} color={C.purple} />
                <Text style={{ color: C.dim, fontSize: 12.5, marginLeft: 8 }}>Upload proof — certificate, portfolio or work samples</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => { tapSuccess(); sfxSuccess(); setApplied(true); }} style={{ marginTop: 11 }}>
              <View style={{ backgroundColor: C.purple, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>Submit for review</Text>
              </View>
            </Pressable>
          </View>
        )}
      </Glass>

      {/* ── MOVIES & SERIES — coming soon ── */}
      <SectionHeader title="Movies & Series" />
      <LinearGradient
        colors={['#1E1B4B', '#0B1020']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: R, padding: 24, alignItems: 'center', marginBottom: 24 }}
      >
        <Text style={{ fontSize: 34 }}>🎬</Text>
        <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', marginTop: 8, letterSpacing: 0.5 }}>Coming soon</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
          Movie nights with your mates — synced watching, live reactions.{'\n'}Worth the wait, we promise. 🍿
        </Text>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 12 }}>
          <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800' }}>🔔 We'll ping you (Major 7th, obviously)</Text>
        </View>
      </LinearGradient>

      {/* ── AR QUESTS ── */}
      <SectionHeader title="AR Quests · earn $MOMENT" />
      {QUESTS.map((q) => {
        const complete = q.done >= q.steps;
        return (
          <Glass key={q.id} style={{ padding: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 22 }}>{q.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{q.title}</Text>
                <Text style={{ color: C.dim, fontSize: 12, marginTop: 3, lineHeight: 17 }}>{q.desc}</Text>
              </View>
              <Chip label={'+' + q.reward + ' $M'} color={C.green} tint={C.greenSoft} style={{ borderColor: 'rgba(16,185,129,0.4)', alignSelf: 'flex-start', marginLeft: 8 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <View style={{ flexDirection: 'row', flex: 1 }}>
                {Array.from({ length: q.steps }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 22, height: 6, borderRadius: 3, marginRight: 5,
                      backgroundColor: i < q.done ? C.purple : C.glassHi,
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: C.faint, fontSize: 11, marginRight: 12 }}>📍 {q.dist}</Text>
              {complete ? (
                <Chip label="COMPLETED ✓" color={C.green} tint={C.greenSoft} style={{ borderColor: 'rgba(16,185,129,0.4)' }} />
              ) : (
                <Pressable onPress={tapSelection}>
                  <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900' }}>Start quest →</Text>
                </Pressable>
              )}
            </View>
          </Glass>
        );
      })}
    </Page>
  );
};
