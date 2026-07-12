import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { COURSES, QUESTS, MOVIES, WATCH_PROVIDERS, WATCH_GENRES } from '../constants/mockData';
import { useAuth } from '../context/AuthContext';
import { openPartner } from '../services/broker';
import { Page, ScreenHeader, SectionHeader, Glass, Chip } from '../components';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess, sfxPop } from '../utils/sfx';

/* ────────────── TAB 4 · CHILL — LEARN & UNWIND, CURATED ──────────────
   Courses first (free for everyone; paid = certified creators only,
   every course reviewed before it goes live). Movies & series are
   coming soon. Zero clutter — that's the whole point. */

export const ChillScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [enrolled, setEnrolled] = useState({});
  const [teachOpen, setTeachOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [skill, setSkill] = useState('');
  const [genre, setGenre] = useState('All');
  const [movie, setMovie] = useState(null); // the "watch on" sheet

  const movies = MOVIES.filter((m) => genre === 'All' || genre === '🍿 Trending' || m.genre === genre);

  return (
    <>
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

      {/* ── WATCH — where to stream, anywhere in the world ── */}
      <SectionHeader title="Watch 🍿" />
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 12, lineHeight: 18 }}>
        Find where to stream any film — we take you straight to Prime Video, Apple TV, Netflix, Shahid & more.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {WATCH_GENRES.map((g) => (
          <Pressable key={g} onPress={() => { tapSelection(); setGenre(g); }}>
            <View style={{ backgroundColor: genre === g ? C.text : C.glass, borderWidth: 1, borderColor: genre === g ? C.text : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
              <Text style={{ color: genre === g ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{g}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
        {movies.map((m) => (
          <Pressable key={m.id} onPress={() => { tapLight(); sfxPop(); setMovie(m); }}>
            <View style={{ width: 138, marginRight: 12 }}>
              <LinearGradient colors={m.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 196, borderRadius: 16, padding: 12, justifyContent: 'space-between' }}>
                <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: '900' }}>⭐ {m.rating}</Text>
                </View>
                <View>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', lineHeight: 19 }} numberOfLines={2}>{m.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 3 }}>{m.genre} · {m.year}</Text>
                </View>
              </LinearGradient>
              <View style={{ flexDirection: 'row', marginTop: 7 }}>
                {m.on.slice(0, 3).map((o) => (
                  <View key={o.p} style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: WATCH_PROVIDERS[o.p].color, alignItems: 'center', justifyContent: 'center', marginRight: 5 }}>
                    <Text style={{ fontSize: 12 }}>{WATCH_PROVIDERS[o.p].emoji || '▷'}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

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

    {/* "where to watch" sheet — deep-links to the real platform (affiliate) */}
    {movie ? (
      <Modal visible transparent animationType="slide" onRequestClose={() => setMovie(null)}>
        <Pressable onPress={() => setMovie(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 14 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <LinearGradient colors={movie.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 60, height: 84, borderRadius: 12, marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{movie.title}</Text>
                <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 3 }}>{movie.genre} · {movie.year} · ⭐ {movie.rating}</Text>
              </View>
            </View>
            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>WATCH ON</Text>
            {movie.on.map((o) => {
              const prov = WATCH_PROVIDERS[o.p];
              return (
                <Pressable key={o.p} onPress={() => { tapSuccess(); sfxSuccess(); openPartner(user, { id: movie.id, partner: prov.partner, url: o.url }); setMovie(null); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 13, marginBottom: 9 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: prov.color, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontSize: 19 }}>{prov.emoji || '▷'}</Text>
                    </View>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', flex: 1 }}>{prov.name}</Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginRight: 6 }}>Watch ↗</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.faint} />
                  </View>
                </Pressable>
              );
            })}
            <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 6 }}>
              Opens the platform directly · Moments earns a small affiliate commission
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    ) : null}
    </>
  );
};
