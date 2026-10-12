import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { pendingChatLink } from '../lib/chatLink';
import { squadLinkInfo } from '../services/squadAdmin';

/* On the sign-up screen, for somebody who came from a group's invite
   link without Moments: which group is waiting, and how many are in it
   (never who) — so making an account has a reason right there. */
export const ChatLinkBanner = () => {
  const { t } = useLang();
  const [info, setInfo] = useState(null);
  useEffect(() => {
    const tok = pendingChatLink();
    if (tok) squadLinkInfo(tok).then((r) => { if (r && r.ok) setInfo(r); });
  }, []);
  if (!info) return null;
  return (
    <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', backgroundColor: C.purpleSoft, borderRadius: 16, padding: 12, marginBottom: 16 }}>
      <Text style={{ fontSize: 26, marginEnd: 10 }}>{info.emoji || '💬'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }} numberOfLines={2}>{t('gc_banner').replace('{name}', info.name)}</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{t('gc_members_n').replace('{n}', String(info.members || 0))}</Text>
      </View>
    </View>
  );
};
