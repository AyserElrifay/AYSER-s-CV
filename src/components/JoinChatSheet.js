import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, Image, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { squadLinkInfo, squadJoinLink } from '../services/squadAdmin';
import { pendingChatLink, clearChatLink } from '../lib/chatLink';
import { openChat } from '../lib/chatBus';
import { goToTab } from '../lib/mapBus';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── YOU WERE SENT A GROUP'S LINK ─────────────────────────────────────
   Shown once, after sign-in, when somebody arrived through a group
   chat's invite link (src/lib/chatLink.js). It says which group and how
   many are in it — never who — and asks. Joining opens the chat. */

const when = (iso, lang) => {
  try { return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return ''; }
};

export const JoinChatSheet = () => {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [token, setToken] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!user) return;
    const tok = pendingChatLink();
    if (!tok) return;
    setToken(tok);
    squadLinkInfo(tok).then((r) => {
      if (r && r.ok && r.member && r.squad_id) {      // already in it: just open it
        clearChatLink(); setToken(null);
        openChat({ id: r.squad_id, name: r.name, emoji: r.emoji }); goToTab('CHATS');
        return;
      }
      setInfo(r || { ok: false, reason: 'expired' });
    });
  }, [user]);

  if (!token || !info) return null;
  const close = () => { clearChatLink(); setToken(null); setInfo(null); };
  const join = async () => {
    if (busy) return;
    tapLight(); setBusy(true); setErr(null);
    const r = await squadJoinLink(token);
    setBusy(false);
    if (r && r.ok) {
      tapSuccess(); close();
      openChat({ id: r.squad_id, name: info.name, emoji: info.emoji }); goToTab('CHATS');
    } else setErr(t(r && r.reason === 'removed' ? 'gc_link_removed' : r && r.reason === 'full' ? 'gc_link_full' : 'gc_link_expired'));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }} onPress={close}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg2 || '#FFF', borderRadius: 26, padding: 22, alignItems: 'center' }}>
          {info.ok ? (
            <>
              {info.avatar_url
                ? <Image source={{ uri: info.avatar_url }} style={{ width: 72, height: 72, borderRadius: 22 }} />
                : <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 36 }}>{info.emoji || '💬'}</Text></View>}
              <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 14 }}>{t('gc_link_invited').toUpperCase()}</Text>
              <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', textAlign: 'center', marginTop: 4 }}>{info.name}</Text>
              <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{t('gc_members_n').replace('{n}', String(info.members || 0))}</Text>
              {info.plan && info.plan.starts_at ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 2 }}>{'📅 ' + when(info.plan.starts_at, lang) + (info.plan.place_name ? ' · ' + info.plan.place_name : '')}</Text> : null}
              {err ? <Text style={{ color: '#E11D48', fontSize: 13.5, textAlign: 'center', marginTop: 10 }}>{err}</Text> : null}
              <Pressable onPress={join} disabled={busy} accessibilityRole="button" style={{ alignSelf: 'stretch', marginTop: 18 }}>
                <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: C.purple }}>
                  {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '900' }}>{t('gc_link_join')}</Text>}
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); close(); }} accessibilityRole="button" style={{ marginTop: 12 }}>
                <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>{t('gc_not_now')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Ionicons name="link-outline" size={36} color={C.dim} />
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 10 }}>{t('gc_link_expired')}</Text>
              <Pressable onPress={() => { tapLight(); close(); }} accessibilityRole="button" style={{ marginTop: 16 }}>
                <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>{t('close')}</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
