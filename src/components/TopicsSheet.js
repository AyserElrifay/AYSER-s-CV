import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { C, R } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchTopics, fetchTopicPosts, fetchFypPosts, TOPIC_CATEGORIES, tintOf } from '../services/topics';
import { FYP } from '../lib/classify';
import { tapLight, tapSelection } from '../utils/feedback';
import { useLang } from '../context/LanguageContext';

/* ── TOPICS ─────────────────────────────────────────────────────────
   Rooms to post into. Every cover here is an emoji on a gradient we
   paint ourselves, and every number under a topic is a real count of
   real moments carrying that tag — so an empty room says so, and
   invites you to be the first one in it rather than pretending a
   crowd is already there. */

const Cover = ({ topic, size = 56, radius = 16 }) => {
  const [a, b] = tintOf(topic.tint);
  return (
    <LinearGradient
      colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: size * 0.46 }}>{topic.emoji || '#'}</Text>
    </LinearGradient>
  );
};

const Badge = ({ label, color }) => (
  <View style={{ backgroundColor: color, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 7 }}>
    <Text style={{ color: '#FFF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.4 }}>{label}</Text>
  </View>
);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ago = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const min = Math.max(1, Math.round((Date.now() - d) / 60000));
  if (min < 60) return min + 'm ago';
  if (min < 1440) return Math.round(min / 60) + 'h ago';
  if (min < 10080) return Math.round(min / 1440) + 'd ago';
  return d.getDate() + ' ' + MONTHS[d.getMonth()];
};

/* One topic, opened: the moments actually in it. */
const TopicPage = ({ topic, onBack, onOpenPost, onCompose }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [mode, setMode] = useState('recommend');
  const [rows, setRows] = useState(null);
  const [a, b] = tintOf(topic.tint);

  useEffect(() => {
    if (!SUPABASE_READY) { setRows([]); return; }
    setRows(null);
    /* FYP is not a subject, it is the room for everything nobody could
       file — so it is fetched by what it is NOT, rather than by a tag. */
    const job = topic.slug === FYP
      ? fetchFypPosts(40)
      /* the slug is passed so a real room also collects the posts that
         are about it but were never tagged — see services/topics.js */
      : fetchTopicPosts(topic.tag, mode, 40, topic.slug);
    job.then(setRows).catch(() => setRows([]));
  }, [topic.tag, topic.slug, mode]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onBack} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', flex: 1, textAlign: 'center' }} numberOfLines={1}>
            {topic.tag}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '900', marginTop: 14 }}>
          {topic.emoji} {topic.title}
        </Text>
        {topic.blurb ? (
          <Text style={{ color: 'rgba(255,255,255,0.86)', fontSize: 13.5, lineHeight: 20, marginTop: 6 }}>{topic.blurb}</Text>
        ) : null}
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800', marginTop: 10 }}>
          {rows === null
            ? 'Counting…'
            : (rows.length || topic.moments) + ' ' + ((rows.length || topic.moments) === 1 ? 'moment' : 'moments')
              + (topic.people ? ' · ' + topic.people + (topic.people === 1 ? ' person' : ' people') : '')}
        </Text>
      </LinearGradient>

      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line }}>
        {[{ k: 'recommend', label: 'Recommend' }, { k: 'recent', label: 'Recent' }].map((t) => (
          <Pressable key={t.k} onPress={() => { tapSelection(); setMode(t.k); }}
            style={{ paddingHorizontal: 18, paddingVertical: 13 }}>
            <Text style={{ color: mode === t.k ? C.text : C.faint, fontSize: 14.5, fontWeight: mode === t.k ? '900' : '700' }}>
              {t.label}
            </Text>
            {mode === t.k ? <View style={{ height: 3, borderRadius: 2, backgroundColor: C.purple, marginTop: 7 }} /> : null}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
        {rows === null ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
        ) : rows.length ? (
          rows.map((r) => (
            <Pressable key={r.id} onPress={() => { tapLight(); onOpenPost && onOpenPost(r); }}>
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Image source={{ uri: (r.user && r.user.avatar_url) || AV_NEUTRAL }}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.glassHi }} />
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>
                      {(r.user && r.user.name) || 'Explorer'}{r.user && r.user.country_flag ? ' ' + r.user.country_flag : ''}
                    </Text>
                    <Text style={{ color: C.faint, fontSize: 11.5, marginLeft: 8 }}>{ago(r.created_at)}</Text>
                    {/* nobody filed this here — the words did. Say so,
                        rather than letting a guess look like a choice
                        somebody made. */}
                    {r.guessed ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <MaterialCommunityIcons name="star-four-points" size={9} color={C.faint} />
                        <Text style={{ color: C.faint, fontSize: 10, fontWeight: '700', marginLeft: 3 }}>{t('room_guessed')}</Text>
                      </View>
                    ) : null}
                  </View>
                  {r.caption ? (
                    <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 3 }} numberOfLines={3}>{r.caption}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
                    <MaterialCommunityIcons name="star-four-points" size={12} color={C.gold} />
                    <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700', marginLeft: 4, marginRight: 12 }}>{r.vibes}</Text>
                    <MaterialCommunityIcons name="script-text-outline" size={13} color={C.faint} />
                    <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700', marginLeft: 4 }}>{r.comments}</Text>
                  </View>
                </View>
                {r.media_url ? (
                  <Image source={{ uri: r.media_url }} style={{ width: 58, height: 58, borderRadius: 12, marginLeft: 10, backgroundColor: C.glassHi }} />
                ) : null}
              </View>
            </Pressable>
          ))
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 44, paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 34 }}>{topic.emoji || '✨'}</Text>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>
              Nobody has posted here yet
            </Text>
            <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 19 }}>
              Be the first — share a moment with {topic.tag} in it and this page is yours.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 14 }}>
        <Pressable onPress={() => { tapLight(); onCompose && onCompose(topic.tag); }}>
          <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="create-outline" size={17} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900', marginLeft: 8 }}>Post a moment</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

export const TopicsSheet = ({ onClose, onOpenPost, onCompose, initialSlug = null, initialTag = null }) => {
  const insets = useSafeAreaInsets();
  const [topics, setTopics] = useState(null);
  const [open, setOpen] = useState(null);

  /* ── WHY BACK DID NOTHING ─────────────────────────────────────────
     This sheet can be opened straight into a room (tapping a hashtag
     in the feed), and the back button reloads the list on its way out
     so the counts are fresh. The reload then read `initialTag` again
     and re-opened the very room you had just left — so from a room
     opened by a hashtag there was no way back to the rooms at all.

     The opening is a first-load thing, not a reload thing. */
  const auto = React.useRef(false);
  const load = useCallback(() => {
    if (!SUPABASE_READY) { setTopics([]); return; }
    fetchTopics().then((rows) => {
      setTopics(rows);
      if (auto.current) return;
      auto.current = true;
      if (initialSlug) {
        const hit = rows.find((t) => t.slug === initialSlug);
        if (hit) setOpen(hit);
      } else if (initialTag) {
        /* Opened from a hashtag somebody typed. If we curate that tag it
           opens the real topic; if we don't, it still gets a page —
           every hashtag in the app is a room, not just ours. */
        const tag = initialTag.startsWith('#') ? initialTag : '#' + initialTag;
        const hit = rows.find((t) => t.tag.toLowerCase() === tag.toLowerCase());
        setOpen(hit || {
          slug: 'tag:' + tag.slice(1).toLowerCase(),
          tag,
          title: tag.slice(1),
          category: null,
          blurb: 'Everything posted with this tag.',
          emoji: '#',
          tint: 'violet',
          moments: 0,
          people: 0,
        });
      }
    }).catch(() => setTopics([]));
  }, [initialSlug, initialTag]);

  useEffect(load, [load]);

  /* ── FOR YOU ─────────────────────────────────────────────────────
     "او لو الفديوز صغير يعصنفها حاجه ذي fyp". Not a curated topic and
     not a row in the database — the room for the posts whose words
     matched nothing, which would otherwise be in no room at all. */
  const FYP_ROOM = {
    slug: FYP, tag: '#ForYou', title: 'For you', category: null,
    blurb: 'Moments nobody filed under anything — the newest first.',
    emoji: '✨', tint: 'violet', moments: 0, people: 0,
  };
  const featured = [FYP_ROOM].concat((topics || []).filter((t) => t.featured));
  const hottest = (topics || []).slice().sort((a, b) => b.moments - a.moments).slice(0, 3);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={open ? () => setOpen(null) : onClose}>
      {open ? (
        <TopicPage
          topic={open}
          onBack={() => { setOpen(null); load(); }}
          onOpenPost={onOpenPost}
          onCompose={onCompose}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={C.text} />
            </Pressable>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', flex: 1, textAlign: 'center' }}>Topics</Text>
            <View style={{ width: 24 }} />
          </View>

          {topics === null ? (
            <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
          ) : !topics.length ? (
            <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, paddingVertical: 40, lineHeight: 20 }}>
              Topics arrive with the next update of the app's data. Nothing invented to fill the page.
            </Text>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
              {/* the ones worth starting with */}
              {featured.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  {featured.map((t) => {
                    const [a, b] = tintOf(t.tint);
                    return (
                      <Pressable key={t.slug} onPress={() => { tapSelection(); setOpen(t); }}>
                        <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={{ width: 268, borderRadius: R + 4, padding: 16, marginRight: 12, minHeight: 132, justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 26 }}>{t.emoji}</Text>
                          <View>
                            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }} numberOfLines={1}>{t.tag}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 3, lineHeight: 17 }} numberOfLines={2}>
                              {t.blurb}
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '800', marginTop: 8 }}>
                              {t.moments ? t.moments + ' moment' + (t.moments === 1 ? '' : 's') : 'Nobody in here yet — go first'}
                            </Text>
                          </View>
                        </LinearGradient>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {/* what actually has the most in it right now */}
              {hottest.some((t) => t.moments > 0) ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', paddingHorizontal: 16 }}>Busiest 🔥</Text>
                  <View style={{ backgroundColor: C.glass, borderRadius: R, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, paddingVertical: 4 }}>
                    {hottest.filter((t) => t.moments > 0).map((t, i) => (
                      <Pressable key={t.slug} onPress={() => { tapSelection(); setOpen(t); }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                          <Cover topic={t} size={46} radius={13} />
                          <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900', marginLeft: 10, width: 20 }}>{i + 1}</Text>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }} numberOfLines={1}>{t.tag}</Text>
                              {t.isNew ? <Badge label="NEW" color={C.purple} /> : null}
                            </View>
                            <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{t.moments} moment(s)</Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* everything, by what it is */}
              {TOPIC_CATEGORIES.map((cat) => {
                const list = topics.filter((t) => t.category === cat);
                if (!list.length) return null;
                return (
                  <View key={cat} style={{ marginTop: 20 }}>
                    <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', paddingHorizontal: 16 }}>{cat}</Text>
                    {list.map((t) => (
                      <Pressable key={t.slug} onPress={() => { tapSelection(); setOpen(t); }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                          <Cover topic={t} />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{t.tag}</Text>
                              {t.isNew ? <Badge label="NEW" color={C.purple} /> : null}
                            </View>
                            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                              {t.moments ? t.moments + ' moment' + (t.moments === 1 ? '' : 's') : 'Be the first'}
                              {t.blurb ? ' · ' + t.blurb : ''}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={C.faint} />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                );
              })}

              <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center', paddingHorizontal: 34, marginTop: 22, lineHeight: 16 }}>
                Every number here is counted from real moments — nothing is padded to look busy.
              </Text>
            </ScrollView>
          )}
        </View>
      )}
    </Modal>
  );
};
