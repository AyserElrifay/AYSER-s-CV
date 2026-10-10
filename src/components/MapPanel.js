import React, { useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, PanResponder, ActivityIndicator, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { lookOf, titleFor, whenFor } from '../lib/activityPins';
import { whyText } from '../lib/recommend';
import { PlanThumb } from './green/PlanPhoto';
import { tapLight, tapSelection } from '../utils/feedback';

/* ─── WHAT IS AROUND HERE, AT THE BOTTOM OF THE MAP ───────────────────
   Ayser sent two screens of a travel app: under the map, one white
   panel that says how many things are in this area, in large type, and
   lists them — a round picture, the name, how many are going, a
   chevron. Our old strip was a floating chip and a row of cut-off
   cards fighting the "Go out now" button for the same corner.

   The panel peeks with the count and the first plan. Pull it up, or
   tap "See all", and it lists every plan in view — and, when there are
   any, the people around you. Every number is counted from what is
   really on the map: no "446 travellers" we did not count.

   One panel, two heights. The bar at the top really drags. */

export const MAP_PANEL_PEEK = 176;          // collapsed height, without chips
export const MAP_PANEL_CHIPS = 44;          // the kind chips, on the activities lens
export const PEOPLE_PANEL_PEEK = 248;       // the People lens: title and one row of faces

const distance = (km) => (km < 1 ? Math.max(1, Math.round(km * 1000 / 50) * 50) + ' m' : km.toFixed(1) + ' km');

/* one line on where somebody is, at exactly the precision they agreed
   to: here now (with how far), around here this week (roughly), or
   only their city — never a made-up distance */
export function personWhere(p, t) {
  const km = p.km != null && isFinite(p.km) ? p.km : null;
  if (p.seen === 'now') return t('pp_here_now') + (km != null ? ' · ' + distance(km) : '');
  if (p.seen === 'recent') return t('pp_this_week') + (km != null ? ' · ~' + (km < 1 ? '1 km' : Math.round(km) + ' km') : '');
  return p.city || t('pp_on_moments');
}

const KINDS = [null, 'walk', 'run', 'coffee', 'focus', 'sport', 'culture', 'movie', 'circle', 'art', 'cleanup'];
const kindLabel = (t, k) => (k ? t(k === 'focus' ? 'gn_focus' : k === 'run' ? 'gn_run' : k === 'coffee' ? 'gn_coffee' : k === 'movie' ? 'gn_movie' : 'green_kind_' + k) : t('lens_all'));

export const MapPanel = ({
  t, lang, user, plans, people, open, onOpen, joining, onJoin, onFocus, onGoNow, onPerson,
  chips = false, kind = null, onKind,
}) => {
  const { height } = useWindowDimensions();
  const drag = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (e, g) => {
      if (g.dy < -24) onOpen(true);
      else if (g.dy > 24) onOpen(false);
    },
  })).current;

  const shown = open ? plans : plans.slice(0, 1);
  const count = plans.length === 1 ? t('map_in_area_one') : t('map_in_area').replace('{n}', String(plans.length));

  const renderPlan = (g, k) => {
    const mine = user && g.host_id === user.id;
    const going = Number(g.going) || 0;
    return (
      <Pressable key={g.id} onPress={() => { tapLight(); onFocus(g); }} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: k ? 1 : 0, borderTopColor: C.line }}>
        <PlanThumb g={g} size={58} radius={29} />
        <View style={{ flex: 1, minWidth: 0, marginStart: 14 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }} numberOfLines={1}>{titleFor(g.title, lang)}</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
            {whenFor(g.starts_at, lang)}{g.place_name ? ' · ' + g.place_name : ''}
          </Text>
          {going || g.why ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              {going ? (
                <View style={{ backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginEnd: 8 }}>
                  <Text style={{ color: C.text, fontSize: 11.5, fontWeight: '700' }}>{going + ' ' + t('green_going')}</Text>
                </View>
              ) : null}
              {/* why it is here, from real counts — see src/lib/recommend.js */}
              {g.why ? <Text style={{ flexShrink: 1, color: C.green, fontSize: 11.5, fontWeight: '800' }} numberOfLines={1}>{whyText(g.why, t)}</Text> : null}
            </View>
          ) : null}
        </View>
        {mine ? (
          <Text style={{ color: C.green, fontSize: 12, fontWeight: '900', marginStart: 8 }}>{t('tg_hosting')}</Text>
        ) : g.im_going ? (
          <Pressable onPress={() => onJoin(g)} disabled={!!joining[g.id]} accessibilityRole="button" style={{ marginStart: 8, paddingVertical: 8 }}>
            <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800', opacity: joining[g.id] ? 0.5 : 1 }}>✓ {t('green_joined')}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => onJoin(g)} disabled={!!joining[g.id]} accessibilityRole="button"
            style={{ marginStart: 8, backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, opacity: joining[g.id] ? 0.6 : 1 }}>
            <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{t('green_join')}</Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  const renderPerson = (p) => (
    <Pressable key={p.id} onPress={() => { tapLight(); onPerson(p); }} accessibilityRole="button" accessibilityLabel={p.name}
      style={{ width: 104, marginEnd: 10 }}>
      <View style={{ width: 104, height: 124, borderRadius: 18, backgroundColor: C.glassHi, overflow: 'hidden' }}>
        <Image source={{ uri: p.cartoonAvatar || p.avatar }} style={{ width: 104, height: 124 }} />
        {p.countryFlag ? <Text style={{ position: 'absolute', top: 7, left: 8, fontSize: 16 }}>{p.countryFlag}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{p.name}</Text>
        {p.seen === 'now' ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, marginStart: 5 }} /> : null}
      </View>
      <Text style={{ color: p.why ? C.green : C.faint, fontSize: 11.5, fontWeight: p.why ? '800' : '400' }} numberOfLines={1}>{whyText(p.why, t) || personWhere(p, t)}</Text>
    </Pressable>
  );

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: open ? height * 0.66 : undefined, backgroundColor: C.floatSolid,
      borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
      {/* the bar and the title: drag up or down, or tap */}
      <View {...drag.panHandlers}>
        <Pressable onPress={() => { tapSelection(); onOpen(!open); }} accessibilityRole="button" accessibilityLabel={open ? t('close') : t('see_all')}
          style={{ alignItems: 'center', paddingTop: 9, paddingBottom: 6 }}>
          <View style={{ width: 38, height: 5, borderRadius: 2.5, backgroundColor: C.line }} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 2 }}>
          <Text style={{ flex: 1, color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
            {plans.length ? count : t('map_none_here')}
          </Text>
          {plans.length > 1 || (people.length && !open) ? (
            <Pressable onPress={() => { tapSelection(); onOpen(!open); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginStart: 8 }}>
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700' }}>{open ? t('map_less') : t('see_all')}</Text>
              <Ionicons name={open ? 'chevron-down' : 'chevron-up'} size={15} color={C.text} style={{ marginStart: 3 }} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {chips ? (
        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}>
          {KINDS.map((k) => {
            const on = kind === k; const l = k ? lookOf(k) : null;
            return (
              <Pressable key={k || 'all'} onPress={() => { tapSelection(); onKind(k); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.text : C.glassHi, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginEnd: 7 }}>
                  {l ? <Text style={{ fontSize: 13, marginEnd: 5 }}>{l.emoji}</Text> : null}
                  <Text style={{ color: on ? C.bg : C.text, fontSize: 12, fontWeight: '800' }}>{kindLabel(t, k)}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView keyboardShouldPersistTaps="handled" scrollEnabled={open} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 14 }} style={{ flexGrow: 0, flexShrink: 1 }}>
        {plans.length ? shown.map(renderPlan) : (
          <Pressable onPress={() => { tapLight(); onGoNow(); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={24} color={C.text} />
            </View>
            <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: '800', marginStart: 14 }}>{t('map_start_one')}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        )}

        {open && people.length ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 10 }}>
              {people.length === 1 ? t('map_people_one') : t('map_people').replace('{n}', String(people.length))}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false}>
              {people.slice(0, 20).map(renderPerson)}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

/* ─── THE PEOPLE LENS ─────────────────────────────────────────────────
   "ليه people فاضيه … واحنا عندنا ٧٠ user حقيقي". It showed only who
   had shared a live spot in the last half hour. Now: the real people on
   Moments, here-now first, then seen around this week, then your city
   and country — faces you can tap, in the travel apps' shape (a big
   count, a row of faces, See all). The count is the people listed. */
export const PeoplePanel = ({ t, people, hereNow = 0, loading = false, open, onOpen, onPerson, onGoNow }) => {
  const { height } = useWindowDimensions();
  const drag = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (e, g) => {
      if (g.dy < -24) onOpen(true);
      else if (g.dy > 24) onOpen(false);
    },
  })).current;
  const n = people.length;

  const renderFace = (p) => (
    <Pressable key={p.id} onPress={() => { tapLight(); onPerson(p); }} accessibilityRole="button" accessibilityLabel={p.name}
      style={{ width: 104, marginEnd: 10 }}>
      <View style={{ width: 104, height: 124, borderRadius: 18, backgroundColor: C.glassHi, overflow: 'hidden' }}>
        <Image source={{ uri: p.cartoonAvatar || p.avatar }} style={{ width: 104, height: 124 }} />
        {p.countryFlag ? <Text style={{ position: 'absolute', top: 7, left: 8, fontSize: 16 }}>{p.countryFlag}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{p.name}</Text>
        {p.seen === 'now' ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, marginStart: 5 }} /> : null}
      </View>
      <Text style={{ color: p.why ? C.green : C.faint, fontSize: 11.5, fontWeight: p.why ? '800' : '400' }} numberOfLines={1}>{whyText(p.why, t) || personWhere(p, t)}</Text>
    </Pressable>
  );

  const renderRow = (p, k) => (
    <Pressable key={p.id} onPress={() => { tapLight(); onPerson(p); }} accessibilityRole="button" accessibilityLabel={p.name}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: k ? 1 : 0, borderTopColor: C.line }}>
      <View>
        <Image source={{ uri: p.cartoonAvatar || p.avatar }} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.glassHi }} />
        {p.seen === 'now' ? <View style={{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: C.green, borderWidth: 2, borderColor: C.floatSolid }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
        <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800' }} numberOfLines={1}>{p.countryFlag ? p.countryFlag + ' ' : ''}{p.name}</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>{personWhere(p, t)}</Text>
        {p.why ? <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', marginTop: 1 }} numberOfLines={1}>{whyText(p.why, t)}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </Pressable>
  );

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: open ? height * 0.7 : undefined, backgroundColor: C.floatSolid,
      borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
      <View {...drag.panHandlers}>
        <Pressable onPress={() => { tapSelection(); onOpen(!open); }} accessibilityRole="button" accessibilityLabel={open ? t('close') : t('see_all')}
          style={{ alignItems: 'center', paddingTop: 9, paddingBottom: 6 }}>
          <View style={{ width: 38, height: 5, borderRadius: 2.5, backgroundColor: C.line }} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
              {loading ? t('pp_people_title') : !n ? t('pp_people_none') : n === 1 ? t('pp_people_one') : t('pp_people_n').replace('{n}', String(n))}
            </Text>
            {hereNow ? (
              <Text style={{ color: C.green, fontSize: 12.5, fontWeight: '700', marginTop: 1 }}>{t('pp_here_now_n').replace('{n}', String(hereNow))}</Text>
            ) : null}
          </View>
          {n > 3 ? (
            <Pressable onPress={() => { tapSelection(); onOpen(!open); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginStart: 8 }}>
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700' }}>{open ? t('map_less') : t('see_all')}</Text>
              <Ionicons name={open ? 'chevron-down' : 'chevron-up'} size={15} color={C.text} style={{ marginStart: 3 }} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={C.text} /></View>
      ) : open ? (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, paddingTop: 6 }} style={{ flexGrow: 0, flexShrink: 1 }}>
          {people.map(renderRow)}
        </ScrollView>
      ) : n ? (
        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 }}>
          {people.slice(0, 20).map(renderFace)}
        </ScrollView>
      ) : (
        <Pressable onPress={() => { tapLight(); onGoNow(); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: '800' }}>{t('gn_cta_short')}</Text>
          <Ionicons name="chevron-forward" size={18} color={C.faint} />
        </Pressable>
      )}
    </View>
  );
};
