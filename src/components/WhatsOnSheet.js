import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fetchWhatsOn } from '../services/whatson';
import { joinCampfire } from '../services/campfires';
import { joinPost } from '../services/social';
import { joinGroup } from '../services/groups';
import { tapLight } from '../utils/feedback';

/* ─── WHAT IS THERE TO JOIN ──────────────────────────────────────────
   Three things that all already existed and all lived somewhere else:
   campfires on the map, invitations buried in the feed, groups inside
   the search modal. Nobody opens three places to ask one question.

   ── WHY IT IS A LIST AND NOT A GRID OF CARDS ──────────────────────
   Because the question has an order to it. What is happening RIGHT NOW
   is a different kind of thing from what is happening on Thursday,
   which is a different kind of thing from a group you could be part of
   for the next two years. A grid flattens that into "here are twelve
   things" and makes the person do the sorting. The list does the
   sorting for them and each section says plainly what it is.

   ── AND NOTHING HERE IS INVENTED ──────────────────────────────────
   A quiet city shows as a quiet city, with an offer to be the one who
   starts something. Filling an empty section with plausible activities
   is the fastest way to make somebody turn up to nothing and never
   trust the app again.                                               */

const Label = ({ children }) => (
  <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>
    {children}
  </Text>
);

const Row = ({ children, onPress }) => {
  const inner = (
    <View style={{
      backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
      borderRadius: 14, padding: 12, marginBottom: 9,
      flexDirection: 'row', alignItems: 'center',
    }}>
      {children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
};

/* A button that has to survive being pressed twice and a request that
   fails. Three states, not two: idle, in flight, done. */
const JoinButton = ({ state, onPress, labels }) => {
  if (state === 'done') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="checkmark-circle" size={17} color={C.green} />
        <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', marginStart: 5 }}>{labels.done}</Text>
      </View>
    );
  }
  if (state === 'waiting') {
    return <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800' }}>{labels.waiting}</Text>;
  }
  return (
    <Pressable onPress={onPress} disabled={state === 'busy'}>
      <View style={{
        backgroundColor: state === 'busy' ? C.line : C.text,
        borderRadius: 11, paddingVertical: 7, paddingHorizontal: 14, minWidth: 62, alignItems: 'center',
      }}>
        {state === 'busy'
          ? <ActivityIndicator size="small" color={C.faint} />
          : <Text style={{ color: C.bg, fontSize: 12.5, fontWeight: '900' }}>{labels.join}</Text>}
      </View>
    </Pressable>
  );
};

const Avatar = ({ uri, emoji }) => (
  uri
    ? <Image source={{ uri }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.line }} />
    : (
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 17 }}>{emoji || '👤'}</Text>
      </View>
    )
);

export const WhatsOnSheet = ({ coords, onClose, onOpenGroup, onOpenMoment }) => {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [data, setData] = useState(null);      // null = still asking
  const [joins, setJoins] = useState({});      // id -> 'busy' | 'done'

  const load = useCallback(() => {
    let alive = true;
    setData(null);
    fetchWhatsOn({ userId: user && user.id, coords })
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ now: [], soon: [], groups: [], reached: { now: false, soon: false, groups: false } }));
    return () => { alive = false; };
  }, [user, coords]);
  useEffect(load, [load]);

  const doJoin = async (key, fn) => {
    if (!user || joins[key]) return;
    tapLight();
    setJoins((j) => ({ ...j, [key]: 'busy' }));
    try {
      await fn();
      setJoins((j) => ({ ...j, [key]: 'done' }));
    } catch (e) {
      /* Put the button back rather than leaving it spinning for ever —
         a join that failed is a join you can try again. */
      setJoins((j) => { const n = { ...j }; delete n[key]; return n; });
    }
  };

  const labels = { join: t('wo_join'), done: t('wo_joined'), waiting: t('wo_waiting') };

  /* The service hands back facts; the words happen here, so they happen
     in the language the app is actually in. Weekday and date go through
     Intl, which knows the name of Monday in all thirteen. */
  const whenText = (w) => {
    if (!w) return null;
    if (w.kind === 'now') return t('wo_now_label');
    if (w.kind === 'mins') return t('wo_in_mins').replace('{n}', String(w.n));
    if (w.kind === 'hours') return t('wo_in_hours').replace('{n}', String(w.n));
    try {
      const d = new Date(w.at);
      return w.kind === 'weekday'
        ? d.toLocaleDateString(lang, { weekday: 'long' })
        : d.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
    } catch (e) { return null; }
  };
  const km = (v) => (v == null ? null : v < 1 ? '· ' + Math.round(v * 1000) + 'm' : '· ' + Math.round(v) + 'km');

  const total = data ? data.now.length + data.soon.length + data.groups.length : 0;

  return (
    <Pressable
      onPress={onClose}
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', zIndex: 35 }}>
      <Pressable
        onPress={() => {}}
        style={{
          backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 10, paddingBottom: insets.bottom + 20, paddingHorizontal: 16, maxHeight: '90%',
        }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{t('wo_title')}</Text>
        <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 3, marginBottom: 14 }}>{t('wo_sub')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          {data === null ? (
            <ActivityIndicator color={C.gold} style={{ marginVertical: 30 }} />
          ) : (
            <>
              {/* ── happening now ── */}
              {data.now.length ? (
                <>
                  <Label>{t('wo_now')}</Label>
                  {data.now.map((c) => (
                    <Row key={c.id}>
                      <Avatar uri={c.hostAvatar} emoji="🔥" />
                      <View style={{ flex: 1, minWidth: 0, marginStart: 11 }}>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{c.title}</Text>
                        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                          {[c.host, c.topic, km(c.km)].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <JoinButton
                        state={joins['f' + c.id] || 'idle'}
                        labels={labels}
                        onPress={() => doJoin('f' + c.id, () => joinCampfire(c.id, user.id))}
                      />
                    </Row>
                  ))}
                </>
              ) : null}

              {/* ── coming up ── */}
              {data.soon.length ? (
                <>
                  <Label>{t('wo_soon')}</Label>
                  {data.soon.map((p) => (
                    <Row key={p.id} onPress={onOpenMoment ? () => onOpenMoment(p.id) : undefined}>
                      <Avatar uri={p.hostAvatar} emoji="✨" />
                      <View style={{ flex: 1, minWidth: 0, marginStart: 11 }}>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{p.title}</Text>
                        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                          {[whenText(p.when), p.place, km(p.km)].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <JoinButton
                        state={joins['p' + p.id] || 'idle'}
                        labels={labels}
                        onPress={() => doJoin('p' + p.id, () => joinPost(p.id, user.id))}
                      />
                    </Row>
                  ))}
                </>
              ) : null}

              {/* ── groups ── */}
              {data.groups.length ? (
                <>
                  <Label>{t('wo_groups')}</Label>
                  {data.groups.map((g) => (
                    <Row key={g.id} onPress={onOpenGroup ? () => onOpenGroup(g.id) : undefined}>
                      <Avatar emoji={g.emoji} />
                      <View style={{ flex: 1, minWidth: 0, marginStart: 11 }}>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{g.name}</Text>
                        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                          {[g.city, t('wo_members').replace('{n}', String(g.members || 0))].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <JoinButton
                        state={joins['g' + g.id] || (g.waiting ? 'waiting' : 'idle')}
                        labels={labels}
                        onPress={() => doJoin('g' + g.id, () => joinGroup(g.id, user.id, g.privacy))}
                      />
                    </Row>
                  ))}
                </>
              ) : null}

              {/* ── genuinely nothing, and it says so ── */}
              {total === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 18 }}>
                  <Text style={{ fontSize: 32 }}>🌱</Text>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>
                    {t('wo_empty')}
                  </Text>
                  <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                    {t('wo_empty_sub')}
                  </Text>
                </View>
              ) : null}

              {/* A section whose source failed is not "nothing here". */}
              {data.reached && !(data.reached.now && data.reached.soon && data.reached.groups) ? (
                <Text style={{ color: C.faint, fontSize: 11, lineHeight: 16, marginTop: 10, textAlign: 'center' }}>
                  {t('wo_partial')}
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};
