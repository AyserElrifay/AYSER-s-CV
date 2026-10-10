import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { flagOf } from '../constants/countries';
import { levelOf } from '../lib/xp';
import { lookOf, titleFor } from '../lib/activityPins';
import { fetchShowedUp } from '../services/green';
import { tapLight } from '../utils/feedback';

/* ─── THE LOCAL PASS ──────────────────────────────────────────────────
   Ayser: "هل في أوبشن تاني ما تبقاش شبه انستجرام". A profile here is not
   a gallery with a follower count. It is a pass: who this is, where they
   are local, since when, what they speak and love, the countries they
   have stamped — and the level they earned by turning up, stamped on
   like a visa. Under it, the real record: the gatherings they checked in
   at. Moments (posts) come after, not first.

   Everything on it is the person's own data or earned in the database
   (community_xp, check-ins). An empty line is simply not printed. */

const split = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const monthYear = (iso, lang) => {
  try { return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { month: 'short', year: 'numeric' }); }
  catch (e) { return ''; }
};
/* a passport number from the account id: stable, meaningless, fun */
const passNo = (id) => String(id || '').replace(/[^a-f0-9]/gi, '').slice(0, 8).toUpperCase().replace(/(.{4})/, '$1 ');

const STAMP = ['#64748B', '#10B981', '#0EA5E9', '#7C3AED', '#F59E0B', '#E11D48'];

export const Passport = ({ profile, name, avatar, verified, own, onPhoto, onEdit, mates, onMates }) => {
  const { t, lang } = useLang();
  const p = profile || {};
  const lv = levelOf(p.community_xp);
  const tone = STAMP[lv.index] || STAMP[0];
  const place = p.city || p.cover_place || null;
  const langs = split(p.speaks_language);
  const loves = split(p.hobbies);
  const visited = Array.isArray(p.visited_countries) ? p.visited_countries.filter((c) => /^[A-Z]{2}$/i.test(c)) : [];
  const line = { color: C.text, fontSize: 14, marginTop: 6 };

  return (
    <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 24, padding: 18, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, flex: 1 }}>MOMENTS · {t('pp_local_pass')}</Text>
        {p.id ? <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1, fontVariant: ['tabular-nums'] }}>{passNo(p.id)}</Text> : null}
      </View>

      <View style={{ flexDirection: 'row', marginTop: 14 }}>
        {/* the passport photo: upright, not a circle */}
        <Pressable onPress={own ? onPhoto : undefined} disabled={!own} accessibilityRole={own ? 'button' : undefined}>
          <Image source={{ uri: avatar }} style={{ width: 86, height: 104, borderRadius: 14, backgroundColor: C.glassHi }} />
          {own ? (
            <View style={{ position: 'absolute', bottom: -4, right: -4, width: 26, height: 26, borderRadius: 13, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.glass }}>
              <Ionicons name="camera" size={13} color={C.bg} />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, marginStart: 14, paddingEnd: 84 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3, flexShrink: 1 }} numberOfLines={2}>{name}{p.age ? ', ' + p.age : ''}</Text>
            {verified ? <Ionicons name="checkmark-circle" size={17} color={C.text} style={{ marginStart: 5 }} /> : null}
          </View>
          <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 3 }} numberOfLines={1}>
            {place ? t('pp_local_in').replace('{place}', place) : t('pp_member')}
          </Text>
          {p.created_at ? <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 1 }}>{t('pp_since').replace('{when}', monthYear(p.created_at, lang))}</Text> : null}
          {typeof mates === 'number' && mates > 0 ? (
            <Pressable onPress={onMates} disabled={!onMates} hitSlop={6} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{t('pp_mates').replace('{n}', String(mates))}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* the level, stamped on like a visa */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 40, right: 14, width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: tone, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }], opacity: 0.9 }}>
        <View style={{ position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 40, borderWidth: 1, borderColor: tone }} />
        <Text style={{ color: tone, fontSize: t('xp_lvl_' + lv.key).length > 7 ? 8.5 : 10.5, fontWeight: '900', letterSpacing: 0.4, maxWidth: 70, textAlign: 'center' }} numberOfLines={1}>{t('xp_lvl_' + lv.key).toUpperCase()}</Text>
        <Text style={{ color: tone, fontSize: 16, fontWeight: '900', marginTop: 1, fontVariant: ['tabular-nums'] }}>{lv.xp.toLocaleString()}</Text>
        <Text style={{ color: tone, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2 }}>XP</Text>
      </View>

      {p.bio || own ? (
        <Pressable onPress={own ? () => onEdit && onEdit('bio') : undefined} disabled={!own} style={{ marginTop: 14 }}>
          <Text style={{ color: p.bio ? C.text : C.faint, fontSize: 14.5, lineHeight: 20, fontStyle: p.bio ? 'italic' : 'normal' }}>
            {p.bio ? '“' + p.bio + '”' : t('add_bio')}
          </Text>
        </Pressable>
      ) : null}

      <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.line, marginTop: 14, paddingTop: 10 }}>
        {langs.length ? <Text style={line} numberOfLines={2}><Text style={{ color: C.faint }}>{t('pp_speaks') + '  '}</Text>{langs.join(' · ')}</Text> : null}
        {loves.length ? <Text style={line} numberOfLines={2}><Text style={{ color: C.faint }}>{t('pp_loves') + '  '}</Text>{loves.join(' · ')}</Text> : null}
        {visited.length ? (
          <View style={{ marginTop: 10 }}>
            <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>{t('pp_stamps').replace('{n}', String(visited.length))}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
              {visited.slice(0, 18).map((c, i) => (
                <View key={c + i} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.dim, alignItems: 'center', justifyContent: 'center', marginEnd: 6, marginBottom: 6, transform: [{ rotate: ((i * 37) % 17 - 8) + 'deg' }] }}>
                  <Text style={{ fontSize: 17 }}>{flagOf(c)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {lv.next && lv.xp > 0 ? (
          <View style={{ marginTop: 10 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: C.glassHi, overflow: 'hidden' }}>
              <View style={{ width: Math.round(lv.progress * 100) + '%', height: 4, backgroundColor: tone }} />
            </View>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 5 }}>{t('xp_to_next').replace('{n}', String(lv.toNext)).replace('{level}', t('xp_lvl_' + lv.next))}</Text>
          </View>
        ) : lv.xp === 0 && own ? (
          <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 8 }}>{t('xp_how')}</Text>
        ) : null}
        {own && !langs.length && !loves.length ? (
          <Pressable onPress={() => { tapLight(); onEdit && onEdit(); }} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', textDecorationLine: 'underline' }}>{t('pp_fill')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

/* ── the record under the pass: where you really showed up ── */
export const ShowedUp = ({ userId, count, own }) => {
  const { t, lang } = useLang();
  const [rows, setRows] = useState(null);
  useEffect(() => { if (own) fetchShowedUp(userId).then(setRows); }, [userId, own]);
  const n = own ? (rows ? rows.length : null) : (Number(count) || 0);
  if (!own) {
    return n > 0 ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 12 }}>{t('pp_showed_up_n').replace('{n}', String(n))}</Text> : null;
  }
  if (!rows || !rows.length) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.1, marginBottom: 6 }}>{t('pp_showed_up').toUpperCase() + ' · ' + rows.length}</Text>
      {rows.slice(0, 6).map((g, i) => (
        <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: i === Math.min(rows.length, 6) - 1 ? 0 : 1, borderBottomColor: C.line }}>
          <Text style={{ fontSize: 18, width: 30 }}>{lookOf(g.kind).emoji}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{titleFor(g.title, lang)}</Text>
            {g.place_name ? <Text style={{ color: C.faint, fontSize: 12 }} numberOfLines={1}>{g.place_name}</Text> : null}
          </View>
          <Text style={{ color: C.faint, fontSize: 12 }}>{(() => { try { return new Date(g.starts_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'short' }); } catch (e) { return ''; } })()}</Text>
        </View>
      ))}
    </View>
  );
};
