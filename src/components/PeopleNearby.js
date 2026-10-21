import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Switch, Image, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { shareMyLocation, goInvisible, fetchNearbyPeople, fetchMyLiveLocation } from '../services/locations';
import { getCurrentCoords } from '../utils/location';
import { AV_NEUTRAL } from '../constants/mockData';
import { lazyOverlay } from '../lib/lazyScreen';
import { tapLight, tapSuccess } from '../utils/feedback';

const ProfileModal = lazyOverlay(() => import('./ProfileModal').then((m) => ({ default: m.ProfileModal })));

/* ─── PEOPLE NEARBY ── ONE SWITCH ─────────────────────────────────────
   Ayser: "بدل don't eat alone … people nearby، وأوبشن بيتفتح ويتقفل".
   Off by default and off with one tap. On: you are on the map for the
   people within a few kilometres (the same live row the map uses —
   live_locations, gone after 30 minutes without the app), and you see
   who else switched it on. Nobody sees you who you would not see.
   Nothing is shared until the switch is turned on. */
const NEAR_KM = 5;
const LIVE_MS = 30 * 60 * 1000;

export const PeopleNearby = () => {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState(null);
  const [err, setErr] = useState(null);
  const [who, setWho] = useState(null);

  const load = async (at) => {
    try {
      const rows = await fetchNearbyPeople(at);
      setPeople(rows.filter((r) => r.user_id !== user.id && r.seen === 'now' && r.km != null && r.km <= NEAR_KM).slice(0, 8));
    } catch (e) { setPeople([]); }
  };

  // still on from before (the row is less than 30 minutes old)?
  useEffect(() => {
    if (!user) return;
    fetchMyLiveLocation(user.id).then((row) => {
      if (row && row.updated_at && Date.now() - new Date(row.updated_at).getTime() < LIVE_MS) {
        setOn(true);
        getCurrentCoords().then((at) => load(at));
      }
    }).catch(() => {});
  }, [user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flip = async (v) => {
    if (!user || busy) return;
    tapLight(); setBusy(true); setErr(null);
    try {
      if (v) {
        const at = await getCurrentCoords();
        if (!at) { setErr(t('gn_err_loc')); return; }
        await shareMyLocation(user.id, at, '👋');
        setOn(true); tapSuccess();
        await load(at);
      } else {
        await goInvisible(user.id);
        setOn(false); setPeople(null);
      }
    } catch (e) { setErr(t('lamma_offline')); } finally { setBusy(false); }
  };

  if (!user) return null;
  const km = (v) => (v < 1 ? Math.max(100, Math.round(v * 10) * 100) + ' m' : (Math.round(v * 10) / 10) + ' km');
  return (
    <View style={{ marginTop: -4, marginBottom: 14, borderRadius: 22, backgroundColor: C.glass, borderWidth: 1, borderColor: on ? C.purple : C.line, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.purple : C.glassHi }}>
          <Ionicons name="people-outline" size={18} color={on ? '#FFF' : C.text} />
        </View>
        <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{t('pn_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '600', marginTop: 1 }} numberOfLines={2}>
            {on ? (people && people.length ? t('pn_on_n').replace('{n}', String(people.length)) : t('pn_on_none')) : t('pn_off')}
          </Text>
        </View>
        {busy ? <ActivityIndicator color={C.purple} /> : (
          <Switch value={on} onValueChange={flip} accessibilityLabel={t('pn_title')}
            trackColor={{ false: C.glassHi, true: C.purple }} thumbColor="#FFF" ios_backgroundColor={C.glassHi} />
        )}
      </View>
      {err ? <Text style={{ color: C.coral, fontSize: 12.5, fontWeight: '700', paddingHorizontal: 16, paddingBottom: 10 }}>{err}</Text> : null}
      {on && people && people.length ? (
        <View style={{ borderTopWidth: 1, borderTopColor: C.line }}>
          {people.map((p) => (
            <Pressable key={p.user_id} onPress={() => { tapLight(); setWho({ id: p.user_id, name: (p.profile && p.profile.name) || '', avatar: (p.profile && p.profile.avatar_url) || AV_NEUTRAL, countryFlag: p.profile && p.profile.country_flag }); }}
              accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 }}>
              <Image source={{ uri: (p.profile && p.profile.avatar_url) || AV_NEUTRAL }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.glassHi }} />
              <Text style={{ flex: 1, color: C.text, fontSize: 14.5, fontWeight: '700', marginStart: 10 }} numberOfLines={1}>
                {String((p.profile && p.profile.name) || '').split(' ')[0] + (p.profile && p.profile.country_flag ? '  ' + p.profile.country_flag : '') + (p.doing && p.doing !== '👋' ? '  ' + p.doing : '')}
              </Text>
              <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '700', marginEnd: 6 }}>{km(p.km)}</Text>
              <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={16} color={C.faint} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {who ? <ProfileModal user={who} onClose={() => setWho(null)} /> : null}
    </View>
  );
};
