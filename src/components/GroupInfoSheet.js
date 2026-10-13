import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  squadPeople, squadSetRole, squadRemove, squadInvite, squadRename, squadSetAbout, squadMakeLink, squadRevokeLinks, chatLinkUrl, rankOf,
} from '../services/squadAdmin';
import { leaveSquad } from '../services/messages';
import { fetchMyMates } from '../services/mates';
import { shareLink, shareNote } from '../utils/share';
import { AV_NEUTRAL } from '../constants/mockData';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { kept, keep } from '../lib/kept';
import { SheetHandle } from './SheetHandle';

/* ─── A GROUP CHAT, AND WHO RUNS IT ────────────────────────────────────
   Ayser: "مش عارف أتحكم في الجروب وابقي أدمن واضيف الناس او اعمل حد تاني
   أدمن … موديريتور … ابعت لينك الشات لناس حتي من بره مومنتس".

   Everyone sees who is here and each person's role. What you can DO
   follows your role, and the database refuses anything above it
   (squad_set_role, squad_remove … in RUN_ME.sql):
     · owner / admin — invite link, add people, rename, set roles, remove;
     · moderator     — remove members, delete any message (in the chat);
     · member        — leave.
   You only ever act on people below you. */

const ROLE_ICON = { owner: 'star', admin: 'shield-checkmark', moderator: 'shield-half', member: null };

export const GroupInfoSheet = ({ squadId, onClose, onLeft, onChanged }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const me = user && user.id;
  const [data, setData] = useState(() => kept('squad.' + squadId + '.' + me));   // last time's, at once
  const [mates, setMates] = useState(null);
  const [adding, setAdding] = useState(false);
  const [invited, setInvited] = useState({});
  const [open, setOpen] = useState(null);          // the member whose actions are showing
  const [naming, setNaming] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const load = useCallback(() => squadPeople(squadId).then((r) => setData((x) => keep('squad.' + squadId + '.' + me, r) || x)), [squadId, me]);
  useEffect(() => { load(); }, [load]);

  const flash = (s) => { setNote(s); setTimeout(() => setNote(null), 2600); };
  const myRole = data && data.me;
  const canAdmin = rankOf(myRole) >= 3;
  const members = (data && data.members) || [];
  const here = new Set(members.map((m) => m.id));

  const makeLink = async () => {
    if (busy) return;
    tapLight(); setBusy(true);
    const r = await squadMakeLink(squadId, 7);
    setBusy(false);
    if (!r || !r.ok) { flash(t('gc_failed')); return; }
    const res = await shareLink({ url: chatLinkUrl(r.token, me), title: data.squad.name, text: t('gc_link_text').replace('{name}', data.squad.name) });
    const n = shareNote(res); if (n) flash(n);
    load();
  };
  const revoke = async () => { tapLight(); const r = await squadRevokeLinks(squadId); flash(r && r.ok ? t('gc_links_off') : t('gc_failed')); load(); };
  const setRole = async (m, role) => {
    tapSelection();
    const r = await squadSetRole(squadId, m.id, role);
    if (r && r.ok) { tapSuccess(); setOpen(null); load(); onChanged && onChanged(); } else flash(t('gc_failed'));
  };
  const remove = async (m) => {
    tapSelection();
    const r = await squadRemove(squadId, m.id);
    if (r && r.ok) { tapSuccess(); setOpen(null); load(); } else flash(t('gc_failed'));
  };
  const openAdd = async () => {
    tapLight(); setAdding(true);
    if (mates == null && me) { try { setMates(await fetchMyMates(me)); } catch (e) { setMates([]); } }
  };
  const invite = async (p) => {
    tapLight(); setInvited((v) => ({ ...v, [p.id]: true }));
    const r = await squadInvite(squadId, p.id);
    if (!r || !r.ok) { setInvited((v) => { const n = { ...v }; delete n[p.id]; return n; }); flash(t('gc_failed')); } else load();
  };
  const rename = async () => {
    const r = await squadRename(squadId, naming);
    if (r && r.ok) { tapSuccess(); setNaming(null); load(); onChanged && onChanged(); } else flash(t('gc_failed'));
  };
  const leave = async () => {
    tapLight();
    try { await leaveSquad(squadId, me); onLeft && onLeft(); } catch (e) { flash(t('gc_failed')); }
  };
  const othersHere = members.filter((m) => m.id !== me && !m.pending).length;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '90%', paddingBottom: insets.bottom + 10 }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}><SheetHandle onClose={onClose} /></View>
        {!data ? <ActivityIndicator color={C.dim} style={{ margin: 30 }} /> : !data.ok ? (
          <Text style={{ color: C.dim, fontSize: 14, textAlign: 'center', margin: 30 }}>{t('gc_not_member')}</Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
            {/* the group */}
            <View style={{ alignItems: 'center' }}>
              {data.squad.avatar_url
                ? <Image source={{ uri: data.squad.avatar_url }} style={{ width: 70, height: 70, borderRadius: 22 }} />
                : <View style={{ width: 70, height: 70, borderRadius: 22, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 34 }}>{data.squad.emoji || '💬'}</Text></View>}
              {naming != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'stretch' }}>
                  <TextInput value={naming} onChangeText={setNaming} maxLength={80} autoFocus
                    style={{ flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, color: C.text, fontSize: 16 }} />
                  <Pressable onPress={rename} style={{ marginStart: 10 }}><Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>{t('gc_save')}</Text></Pressable>
                </View>
              ) : (
                <Pressable onPress={canAdmin ? () => { tapLight(); setNaming(data.squad.name); } : undefined} disabled={!canAdmin} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', textAlign: 'center' }}>{data.squad.name}</Text>
                  {canAdmin ? <Ionicons name="pencil" size={15} color={C.dim} style={{ marginStart: 6 }} /> : null}
                </Pressable>
              )}
              <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 3 }}>
                {t('gc_members_n').replace('{n}', String(members.filter((m) => !m.pending).length)) + ' · ' + t('gc_you_are').replace('{role}', t('gc_role_' + myRole))}
              </Text>
            </View>

            {/* about the group, and the one pinned note (the plan's details) — admins write, everyone reads */}
            <AboutBox data={data} canEdit={canAdmin} t={t} onSaved={() => { load(); onChanged && onChanged(); }} />

            {/* invite link + add people — admins */}
            {canAdmin ? (
              <View style={{ marginTop: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 }}>
                <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900' }}>{t('gc_link_title')}</Text>
                <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{t('gc_link_sub')}</Text>
                <Pressable onPress={makeLink} disabled={busy} accessibilityRole="button" style={{ marginTop: 12 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: C.purple }}>
                    {busy ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="link" size={17} color="#FFF" /><Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', marginStart: 7 }}>{t('gc_link_share')}</Text></>}
                  </View>
                </Pressable>
                {data.links && data.links.length ? (
                  <Pressable onPress={revoke} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'center' }}>
                    <Text style={{ color: '#E11D48', fontSize: 13.5, fontWeight: '800' }}>{t('gc_links_revoke').replace('{n}', String(data.links.length))}</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={openAdd} accessibilityRole="button" style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'center' }}>
                  <Ionicons name="person-add-outline" size={17} color={C.text} />
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginStart: 7 }}>{t('gc_add_people')}</Text>
                </Pressable>
                {adding ? (
                  mates == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 10 }} /> : !mates.length ? (
                    <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 10 }}>{t('gc_no_mates')}</Text>
                  ) : mates.map((p) => (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                      <Image source={{ uri: p.avatar_url || AV_NEUTRAL }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.glassHi }} />
                      <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700', marginStart: 10, flex: 1 }} numberOfLines={1}>{p.name}</Text>
                      {here.has(p.id) || invited[p.id] ? (
                        <Text style={{ color: C.faint, fontSize: 13, fontWeight: '800' }}>{here.has(p.id) ? t('gc_in_group') : t('gc_invited')}</Text>
                      ) : (
                        <Pressable onPress={() => invite(p)}><Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{t('gc_invite')}</Text></Pressable>
                      )}
                    </View>
                  ))
                ) : null}
              </View>
            ) : null}
            {note ? <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 10 }}>{note}</Text> : null}

            {/* who is here */}
            <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 20 }}>{t('gc_people').toUpperCase()}</Text>
            {members.map((m) => {
              const canAct = m.id !== me && rankOf(myRole) >= 2 && rankOf(myRole) > rankOf(m.role) && !m.pending;
              const isOpen = open === m.id;
              return (
                <View key={m.id}>
                  <Pressable onPress={canAct ? () => { tapLight(); setOpen(isOpen ? null : m.id); } : undefined} disabled={!canAct}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
                    <Image source={{ uri: m.avatar_url || AV_NEUTRAL }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.glassHi, opacity: m.pending ? 0.5 : 1 }} />
                    <View style={{ flex: 1, marginStart: 11 }}>
                      <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{(m.name || '…') + (m.id === me ? ' · ' + t('gc_you') : '')}</Text>
                      {m.pending ? <Text style={{ color: C.faint, fontSize: 12.5 }}>{t('gc_invited')}</Text> : null}
                    </View>
                    {m.role !== 'member' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: m.role === 'owner' ? C.goldSoft : C.purpleSoft, paddingHorizontal: 9, paddingVertical: 4 }}>
                        <Ionicons name={ROLE_ICON[m.role]} size={12} color={m.role === 'owner' ? '#8A6400' : C.purple} />
                        <Text style={{ color: m.role === 'owner' ? '#8A6400' : C.purple, fontSize: 12, fontWeight: '800', marginStart: 4 }}>{t('gc_role_' + m.role)}</Text>
                      </View>
                    ) : null}
                    {canAct ? <Ionicons name={isOpen ? 'chevron-up' : 'ellipsis-horizontal'} size={17} color={C.dim} style={{ marginStart: 8 }} /> : null}
                  </Pressable>
                  {isOpen ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingStart: 51, paddingBottom: 8 }}>
                      {canAdmin && m.role !== 'admin' && rankOf(myRole) > 3 ? <Chip label={t('gc_make_admin')} onPress={() => setRole(m, 'admin')} /> : null}
                      {canAdmin && m.role !== 'moderator' ? <Chip label={t('gc_make_moderator')} onPress={() => setRole(m, 'moderator')} /> : null}
                      {canAdmin && m.role !== 'member' ? <Chip label={t('gc_make_member')} onPress={() => setRole(m, 'member')} /> : null}
                      {myRole === 'owner' ? <Chip label={t('gc_make_owner')} onPress={() => setRole(m, 'owner')} /> : null}
                      <Chip label={t('gc_remove')} danger onPress={() => remove(m)} />
                    </View>
                  ) : null}
                </View>
              );
            })}

            <Text style={{ color: C.faint, fontSize: 12, lineHeight: 18, marginTop: 14 }}>{t('gc_roles_explain')}</Text>

            {/* leaving */}
            {confirmLeave ? (
              <View style={{ marginTop: 18, alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 14, textAlign: 'center' }}>{myRole === 'owner' && othersHere ? t('gc_owner_leave') : t('gc_leave_sure')}</Text>
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <Chip label={t('gc_not_now')} onPress={() => setConfirmLeave(false)} />
                  <Chip label={t('gc_leave')} danger onPress={leave} />
                </View>
              </View>
            ) : (
              <Pressable onPress={() => { tapLight(); setConfirmLeave(true); }} accessibilityRole="button" style={{ marginTop: 18, alignSelf: 'center' }}>
                <Text style={{ color: '#E11D48', fontSize: 14.5, fontWeight: '800' }}>{t('gc_leave')}</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const Chip = ({ label, onPress, danger }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={{ marginEnd: 8, marginTop: 6 }}>
    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: danger ? '#E11D48' : C.line, paddingHorizontal: 12, paddingVertical: 7 }}>
      <Text style={{ color: danger ? '#E11D48' : C.text, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);

const AboutBox = ({ data, canEdit, t, onSaved }) => {
  const [edit, setEdit] = useState(false);
  const [about, setAbout] = useState(data.squad.about || '');
  const [pinned, setPinned] = useState(data.squad.pinned || '');
  if (!edit && !data.squad.about && !data.squad.pinned && !canEdit) return null;
  const box = { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, color: C.text, fontSize: 14, marginTop: 6, minHeight: 60, textAlignVertical: 'top' };
  return (
    <View style={{ marginTop: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 }}>
      {edit ? (
        <>
          <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800' }}>{t('gc_about').toUpperCase()}</Text>
          <TextInput value={about} onChangeText={setAbout} multiline maxLength={600} style={box} />
          <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', marginTop: 10 }}>{'📌 ' + t('gc_pinned').toUpperCase()}</Text>
          <TextInput value={pinned} onChangeText={setPinned} multiline maxLength={600} placeholder={t('gc_pinned_ph')} placeholderTextColor={C.faint} style={box} />
          <Pressable onPress={async () => { const r = await squadSetAbout(data.squad.id, about, pinned); if (r && r.ok) { tapSuccess(); setEdit(false); onSaved(); } }} style={{ marginTop: 10, alignSelf: 'flex-end' }}>
            <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>{t('gc_save')}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={canEdit ? () => { tapLight(); setEdit(true); } : undefined} disabled={!canEdit}>
          {data.squad.about ? <Text style={{ color: C.text, fontSize: 14, lineHeight: 20 }}>{data.squad.about}</Text> : null}
          {data.squad.pinned ? <Text style={{ color: C.text, fontSize: 14, lineHeight: 20, marginTop: data.squad.about ? 8 : 0 }}>{'📌 ' + data.squad.pinned}</Text> : null}
          {canEdit ? <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '900', marginTop: data.squad.about || data.squad.pinned ? 8 : 0 }}>{'✎ ' + t('gc_edit_about')}</Text> : null}
        </Pressable>
      )}
    </View>
  );
};
