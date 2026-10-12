import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { LEVELS, levelOf } from '../lib/xp';
import { myLoyalty, myReferrals, creatorRecord } from '../services/green';
import { appLink, shareLink, shareNote } from '../utils/share';
import { tapLight, tapMedium, tapSelection } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';
import { AV_NEUTRAL } from '../constants/mockData';

/* ─── REWARDS · LOYALTY, INVITES, CREATORS ────────────────────────────
   Ayser: "اعملي loyalty program و referrals و الhangouts creators".
   Three tabs over one rule: only turning up counts. The numbers come
   from the database (my_loyalty, my_referrals, creator_record in
   RUN_ME.sql); nothing here is typed, estimated or rounded up. A perk is
   listed only when a real place gave one, and its code arrives only
   once the database agrees you reached its level. */

const TABS = ['loyalty', 'invite', 'creator'];
const CREATOR_AT = 3;

const Stat = ({ n, label }) => (
  <View style={{ flex: 1, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingVertical: 12, alignItems: 'center' }}>
    <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{n == null ? '–' : String(n)}</Text>
    <Text style={{ color: C.dim, fontSize: 12, marginTop: 2, textAlign: 'center' }} numberOfLines={2}>{label}</Text>
  </View>
);

const Rule = ({ icon, text }) => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
    <Ionicons name={icon} size={17} color={C.purple} style={{ marginTop: 1 }} />
    <Text style={{ color: C.text, fontSize: 14, lineHeight: 20, marginStart: 10, flex: 1 }}>{text}</Text>
  </View>
);

const Button = ({ label, icon, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={{ marginTop: 16 }}>
    <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: C.purple }}>
      {icon ? <Ionicons name={icon} size={17} color="#FFF" /> : null}
      <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', marginStart: icon ? 7 : 0 }}>{label}</Text>
    </View>
  </Pressable>
);

export const RewardsSheet = ({ onClose, tab: first = 'loyalty', onStartPlan }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const uid = user && user.id;
  const [tab, setTab] = useState(TABS.includes(first) ? first : 'loyalty');
  const [loyal, setLoyal] = useState(undefined);   // undefined = asking, null = could not
  const [refs, setRefs] = useState(undefined);
  const [mine, setMine] = useState(undefined);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!SUPABASE_READY || !uid) { setLoyal(null); setRefs(null); setMine(null); return; }
    let alive = true;
    myLoyalty().then((r) => alive && setLoyal(r || null));
    myReferrals().then((r) => alive && setRefs(r || null));
    creatorRecord(uid).then((r) => alive && setMine(r || null));
    return () => { alive = false; };
  }, [uid]);

  const share = async () => {
    tapMedium();
    const r = await shareLink({ url: appLink({ invite: uid }), title: 'Moments', text: t('inv_text') });
    const n = shareNote(r); if (n) { setNote(n); setTimeout(() => setNote(null), 2400); }
  };

  const lv = levelOf(loyal ? loyal.xp : 0);
  const waiting = (v) => v === undefined;

  const loyaltyTab = () => (
    <View>
      <View style={{ backgroundColor: '#1A1A1A', borderRadius: 22, padding: 18 }}>
        <Text style={{ color: C.gold, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.6 }}>MOMENTS · {t('rw_loyalty').toUpperCase()}</Text>
        <Text style={{ color: '#F9F9F6', fontSize: 28, fontWeight: '900', marginTop: 8 }}>{t('xp_lvl_' + lv.key)}</Text>
        <Text style={{ color: '#C9C9D1', fontSize: 14, marginTop: 2, fontVariant: ['tabular-nums'] }}>{lv.xp.toLocaleString()} XP</Text>
        {lv.next ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
              <View style={{ width: Math.round(lv.progress * 100) + '%', height: 6, backgroundColor: C.gold }} />
            </View>
            <Text style={{ color: '#C9C9D1', fontSize: 12.5, marginTop: 6 }}>{t('xp_to_next').replace('{n}', String(lv.toNext)).replace('{level}', t('xp_lvl_' + lv.next))}</Text>
          </View>
        ) : null}
        {loyal && loyal.streak > 0 ? (
          <Text style={{ color: '#F9F9F6', fontSize: 14, fontWeight: '800', marginTop: 12 }}>
            {'🔥 ' + (loyal.streak === 1 ? t('rw_streak_one') : t('rw_streak_n').replace('{n}', String(loyal.streak)))}
          </Text>
        ) : null}
      </View>

      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 18 }}>{t('rw_earn').toUpperCase()}</Text>
      <Rule icon="location-outline" text={t('rw_earn_checkin')} />
      <Rule icon="leaf-outline" text={t('rw_earn_cleanup')} />
      <Rule icon="flag-outline" text={t('rw_earn_host')} />
      <Rule icon="people-outline" text={t('rw_earn_invite')} />

      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 20 }}>{t('rw_levels').toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {LEVELS.map((l, i) => {
          const reached = lv.index >= i;
          return (
            <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: reached ? C.purple : C.line, backgroundColor: reached ? 'rgba(124,58,237,0.08)' : 'transparent', paddingHorizontal: 10, paddingVertical: 6, marginEnd: 6, marginBottom: 6 }}>
              {reached ? <Ionicons name="checkmark" size={13} color={C.purple} style={{ marginEnd: 4 }} /> : null}
              <Text style={{ color: reached ? C.text : C.dim, fontSize: 12.5, fontWeight: '700' }}>{t('xp_lvl_' + l.key) + ' · ' + l.at}</Text>
            </View>
          );
        })}
      </View>

      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 18 }}>{t('rw_perks').toUpperCase()}</Text>
      {waiting(loyal) ? <ActivityIndicator color={C.dim} style={{ marginTop: 12 }} /> : loyal && loyal.perks && loyal.perks.length ? loyal.perks.map((p) => (
        <View key={p.id} style={{ marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: p.unlocked ? C.gold : C.line, backgroundColor: p.unlocked ? C.goldSoft : C.glass, padding: 14, opacity: p.unlocked ? 1 : 0.75 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', flex: 1 }} numberOfLines={2}>{p.title}</Text>
            <Ionicons name={p.unlocked ? 'gift' : 'lock-closed-outline'} size={17} color={p.unlocked ? C.gold : C.dim} />
          </View>
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 3 }}>{p.partner + (p.city ? ' · ' + p.city : '')}</Text>
          {p.unlocked && p.code ? (
            <Text selectable style={{ color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: 2, marginTop: 8 }}>{p.code}</Text>
          ) : !p.unlocked ? (
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6 }}>{t('rw_perk_at').replace('{level}', t('xp_lvl_' + p.level))}</Text>
          ) : null}
        </View>
      )) : (
        <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 8 }}>{t('rw_perks_none')}</Text>
      )}
    </View>
  );

  const inviteTab = () => (
    <View>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{t('inv_title')}</Text>
      <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{t('rw_inv_sub')}</Text>
      <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
        <Stat n={refs ? refs.joined : null} label={t('rw_inv_joined')} />
        <Stat n={refs ? refs.showed_up : null} label={t('rw_inv_came')} />
        <Stat n={refs ? refs.xp : null} label={t('rw_inv_xp')} />
      </View>
      <Button label={t('inv_share')} icon="share-outline" onPress={share} />
      {note ? <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>{note}</Text> : null}

      {refs && refs.people && refs.people.length ? (
        <View style={{ marginTop: 18 }}>
          {refs.people.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
              <Image source={{ uri: p.avatar_url || AV_NEUTRAL }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.glassHi }} />
              <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700', marginStart: 10, flex: 1 }} numberOfLines={1}>{p.name || '…'}</Text>
              <Text style={{ color: p.showed_up ? C.purple : C.faint, fontSize: 12.5, fontWeight: '800' }}>{p.showed_up ? '+50 XP' : t('rw_inv_not_yet')}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 18 }}>{t('rw_how').toUpperCase()}</Text>
      <Rule icon="link-outline" text={t('rw_inv_r1')} />
      <Rule icon="location-outline" text={t('rw_inv_r2')} />
      <Rule icon="gift-outline" text={t('rw_inv_r3')} />
      <Rule icon="shield-checkmark-outline" text={t('rw_inv_r4').replace('{n}', String(refs ? refs.month_left : 10))} />
    </View>
  );

  const creatorTab = () => {
    const hosted = mine ? mine.hosted : 0;
    return (
      <View>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{t('rw_creator_title')}</Text>
        <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{t('rw_creator_sub')}</Text>
        {mine && mine.is_creator ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 12, borderRadius: 999, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.gold, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Ionicons name="star" size={14} color={C.gold} />
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '900', marginStart: 6 }}>{t('rw_creator_badge')}</Text>
          </View>
        ) : (
          <View style={{ marginTop: 14 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: C.glassHi, overflow: 'hidden' }}>
              <View style={{ width: Math.round(Math.min(1, hosted / CREATOR_AT) * 100) + '%', height: 6, backgroundColor: C.gold }} />
            </View>
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6 }}>{t('rw_creator_progress').replace('{n}', String(Math.min(hosted, CREATOR_AT))).replace('{of}', String(CREATOR_AT))}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
          <Stat n={mine ? mine.hosted : null} label={t('rw_cr_hosted')} />
          <Stat n={mine ? mine.people : null} label={t('rw_cr_people')} />
          <Stat n={mine ? mine.returning : null} label={t('rw_cr_back')} />
          <Stat n={mine ? mine.followers : null} label={t('rw_cr_followers')} />
        </View>
        {onStartPlan ? <Button label={t('rw_cr_start')} icon="add" onPress={() => { tapLight(); onStartPlan(); }} /> : null}

        <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 18 }}>{t('rw_cr_get').toUpperCase()}</Text>
        <Rule icon="flag-outline" text={t('rw_cr_g1')} />
        <Rule icon="notifications-outline" text={t('rw_cr_g2')} />
        <Rule icon="star-outline" text={t('rw_cr_g3')} />
        <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 18, marginTop: 14 }}>{t('rw_cr_rule').replace('{of}', String(CREATOR_AT))}</Text>
      </View>
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6, borderWidth: 1, borderColor: C.line, maxHeight: '90%', paddingBottom: insets.bottom + 10 }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <SheetHandle onClose={onClose} />
        </View>
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 6, backgroundColor: C.glass, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: C.line }}>
          {TABS.map((k) => (
            <Pressable key={k} onPress={() => { tapSelection(); setTab(k); }} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1 }}>
              <View style={{ borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: tab === k ? C.text : 'transparent' }}>
                <Text style={{ color: tab === k ? C.bg : C.dim, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{t('rw_tab_' + k)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {!uid ? <Text style={{ color: C.dim, fontSize: 14, marginTop: 10 }}>{t('rw_sign_in')}</Text>
            : tab === 'loyalty' ? loyaltyTab() : tab === 'invite' ? inviteTab() : creatorTab()}
        </ScrollView>
      </View>
    </Modal>
  );
};
