import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, ScrollView, TextInput, Pressable, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { getProfile } from '../services/profiles';
import { shortWhen } from './CommentsSheet';
import {
  fetchGroup, fetchWall, postToGroup, removeGroupPost, setPostLike,
  fetchPostComments, addPostComment, removePostComment,
  fetchMembers, approveMember, setMemberRole, removeMember,
  joinGroup, leaveGroup, markGroupSeen, explainGroups,
} from '../services/groups';

/* ─── A GROUP THAT IS A PLACE, NOT A LIST OF NAMES ───────────────────
   Ayser: "و خلي جروبي شبه جروبس الفيس بوك"

   Before this, joining a group did nothing you could see. There was no
   page to land on, so there was nothing to come back to. Everything
   here exists to make the group somewhere things happen:

     · a wall, which is the group
     · a box to write in, sitting at the top where you cannot miss it
     · replies under each post, because a wall where nobody answers
       dies faster than one with no posts at all
     · "4 new posts", the only honest reason to open it again

   ── THE JOIN BUTTON HAS THREE STATES, NOT TWO ────────────────────
   Joined, waiting, and neither. Somebody who asked to get into a
   private group and is waiting must not be shown a Join button that
   would do nothing when pressed, and must not be told they are in.
   Both of those are the same "joined: false/true" if you only keep a
   boolean, which is why the service keeps three.                     */

const HEAD = 168;

/* Two colours drawn from the name, so a group with no cover photo
   still looks like itself and not like every other group. */
const coverColours = (name) => {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return ['hsl(' + h + ',62%,42%)', 'hsl(' + ((h + 42) % 360) + ',58%,26%)'];
};

const Avatar = ({ uri, size = 34 }) => (
  uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.glass }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person" size={size * 0.5} color={C.faint} />
      </View>
);

/* ── ONE POST ─────────────────────────────────────────────────────
   Its replies are fetched when you open them and not before. A wall of
   twenty posts pulling every reply on the way in is twenty requests
   for text almost nobody will read. */
const WallPost = ({ post, me, onLike, onRemove, t }) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(post.comments);

  const openReplies = async () => {
    tapLight();
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      try { setRows(await fetchPostComments(post.id)); }
      catch (e) { setRows([]); }
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !me || busy) return;
    setBusy(true);
    try {
      const row = await addPostComment(post.id, me.id, body);
      setRows((r) => (r || []).concat([{
        id: row.id, body, created_at: row.created_at, author_id: me.id,
        name: me.name || 'You', avatar: me.avatar || null,
      }]));
      setCount((n) => n + 1);
      setDraft('');
      tapSuccess();
    } catch (e) { /* the box keeps what you typed */ }
    setBusy(false);
  };

  const drop = async (c) => {
    try { await removePostComment(c.id); } catch (e) { return; }
    setRows((r) => (r || []).filter((x) => x.id !== c.id));
    setCount((n) => Math.max(0, n - 1));
  };

  return (
    <View style={{ backgroundColor: C.bg2, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar uri={post.author_avatar} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{post.author_name}</Text>
          <Text style={{ color: C.faint, fontSize: 11 }}>
            {shortWhen(post.created_at)}{post.edited_at ? ' · ' + t('gp_edited') : ''}
          </Text>
        </View>
        {post.can_remove ? (
          <Pressable onPress={() => { tapLight(); onRemove(post); }} hitSlop={10}>
            <Ionicons name="trash-outline" size={16} color={C.faint} />
          </Pressable>
        ) : null}
      </View>

      {post.body ? (
        <Text style={{ color: C.text, fontSize: 14, lineHeight: 20, marginTop: 10 }}>{post.body}</Text>
      ) : null}
      {post.media_url ? (
        <Image source={{ uri: post.media_url }} resizeMode="cover"
          style={{ width: '100%', height: 220, borderRadius: 14, marginTop: 10, backgroundColor: C.glass }} />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <Pressable onPress={() => onLike(post)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}>
          <Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={18} color={post.liked ? C.coral : C.faint} />
          <Text style={{ color: post.liked ? C.coral : C.faint, fontSize: 12, fontWeight: '800', marginLeft: 6 }}>{post.likes}</Text>
        </Pressable>
        <Pressable onPress={openReplies} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chatbubble-outline" size={16} color={C.faint} />
          <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', marginLeft: 6 }}>{count}</Text>
        </Pressable>
      </View>

      {open ? (
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
          {rows === null ? <ActivityIndicator color={C.purple} /> : null}
          {rows && !rows.length ? (
            <Text style={{ color: C.faint, fontSize: 12 }}>{t('gp_no_replies')}</Text>
          ) : null}
          {(rows || []).map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', marginBottom: 9 }}>
              <Avatar uri={c.avatar} size={26} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '800' }}>
                  {c.name} <Text style={{ color: C.faint, fontWeight: '600' }}>· {shortWhen(c.created_at)}</Text>
                </Text>
                <Text style={{ color: C.text, fontSize: 13, lineHeight: 18, marginTop: 1 }}>{c.body}</Text>
              </View>
              {me && c.author_id === me.id ? (
                <Pressable onPress={() => drop(c)} hitSlop={10}>
                  <Ionicons name="close" size={14} color={C.faint} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {me ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <TextInput
                value={draft} onChangeText={setDraft}
                placeholder={t('gp_reply_ph')} placeholderTextColor={C.faint}
                style={{ flex: 1, color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: Platform.OS === 'ios' ? 9 : 6 }}
              />
              <Pressable onPress={send} disabled={!draft.trim() || busy} hitSlop={8} style={{ marginLeft: 8, opacity: draft.trim() && !busy ? 1 : 0.4 }}>
                <Ionicons name="send" size={18} color={C.purple} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export const GroupPage = ({ groupId, onClose, onChanged }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  /* Your own name and face, so a post you have just made looks like
     yours before the wall is reloaded. Fetched once and allowed to
     fail: an unnamed row still says "You", which is true. */
  const [mine, setMine] = useState(null);
  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((p) => setMine(p || null), () => {});
  }, [user]);
  const me = user
    ? { id: user.id, name: (mine && mine.name) || 'You', avatar: (mine && mine.avatar_url) || null }
    : null;

  const [group, setGroup] = useState(null);
  const [err, setErr] = useState(null);
  const [wall, setWall] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('wall');           // wall | people
  const [people, setPeople] = useState(null);
  const [busyJoin, setBusyJoin] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const g = await fetchGroup(groupId, user && user.id);
      setGroup(g);
      const rows = await fetchWall(groupId);
      setWall(rows);
      /* Marking it seen is what makes the badge go away, and it only
         makes sense once the wall has actually arrived. */
      if (g.joined) markGroupSeen(groupId);
    } catch (e) {
      setErr(explainGroups(e));
      setWall([]);
    }
  }, [groupId, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'people' || people !== null) return;
    fetchMembers(groupId).then(setPeople, () => setPeople([]));
  }, [tab, people, groupId]);

  const requests = useMemo(() => (people || []).filter((p) => p.status === 'requested'), [people]);
  const joined = useMemo(() => (people || []).filter((p) => p.status === 'joined'), [people]);

  const post = async () => {
    const body = draft.trim();
    if (!body || !me || sending) return;
    setSending(true);
    try {
      const row = await postToGroup(groupId, me.id, { body });
      setWall((w) => [{
        id: row.id, author_id: me.id, author_name: me.name || 'You', author_avatar: me.avatar,
        body, media_url: null, created_at: row.created_at, edited_at: null,
        likes: 0, comments: 0, liked: false, mine: true, can_remove: true,
      }].concat(w || []));
      setDraft('');
      tapSuccess();
      onChanged && onChanged();
    } catch (e) { /* what you wrote stays in the box */ }
    setSending(false);
  };

  /* The heart moves first and is put back if the write fails. A like
     that waits for the network feels broken, and a like that lies is
     worse — so it does both: instant, and honest about it. */
  const like = async (p) => {
    if (!me) return;
    tapSelection();
    const on = !p.liked;
    setWall((w) => (w || []).map((x) => x.id === p.id ? { ...x, liked: on, likes: x.likes + (on ? 1 : -1) } : x));
    try { await setPostLike(p.id, me.id, on); }
    catch (e) {
      setWall((w) => (w || []).map((x) => x.id === p.id ? { ...x, liked: !on, likes: x.likes + (on ? -1 : 1) } : x));
    }
  };

  const drop = async (p) => {
    const keep = wall;
    setWall((w) => (w || []).filter((x) => x.id !== p.id));
    try { await removeGroupPost(p.id); } catch (e) { setWall(keep); }
  };

  const toggleJoin = async () => {
    if (!me || !group || busyJoin) return;
    setBusyJoin(true);
    tapLight();
    try {
      if (group.joined || group.waiting) {
        await leaveGroup(groupId, me.id);
        setGroup((g) => ({ ...g, joined: false, waiting: false, admin: false, members: Math.max(0, g.members - (g.joined ? 1 : 0)) }));
      } else {
        const status = await joinGroup(groupId, me.id, group.privacy);
        setGroup((g) => ({
          ...g,
          joined: status === 'joined', waiting: status === 'requested',
          members: g.members + (status === 'joined' ? 1 : 0),
        }));
        if (status === 'joined') { tapSuccess(); load(); }
      }
      onChanged && onChanged();
    } catch (e) { /* the button springs back on the next load */ }
    setBusyJoin(false);
  };

  const admin = async (fn, uid) => {
    try { await fn(groupId, uid); } catch (e) { return; }
    setPeople(null);
    load();
  };

  const colours = coverColours(group ? group.name : '');
  const canPost = !!(group && group.joined && me);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>

            {/* ── THE COVER ── */}
            <View style={{ height: HEAD }}>
              {group && group.cover_url
                ? <Image source={{ uri: group.cover_url }} resizeMode="cover" style={{ width: '100%', height: HEAD }} />
                : <LinearGradient colors={colours} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: HEAD }} />}
              <Pressable onPress={onClose} hitSlop={10}
                style={{ position: 'absolute', top: insets.top + 8, left: 14, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, padding: 8 }}>
                <Ionicons name="chevron-back" size={20} color="#FFF" />
              </Pressable>
            </View>

            <View style={{ paddingHorizontal: 16, marginTop: -28 }}>
              <View style={{ width: 62, height: 62, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 2, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 30 }}>{group ? group.emoji : '🌐'}</Text>
              </View>

              <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', marginTop: 10 }}>
                {group ? group.name : '…'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                <Ionicons name={group && group.privacy === 'request' ? 'lock-closed' : 'earth'} size={13} color={C.faint} />
                <Text style={{ color: C.faint, fontSize: 12.5, marginLeft: 5 }}>
                  {group ? t(group.privacy === 'request' ? 'gp_private' : 'gp_open') : ''}
                  {group ? ' · ' + group.members + ' ' + t('gp_members') : ''}
                  {group && group.city ? ' · ' + group.city : ''}
                </Text>
              </View>
              {group && group.about ? (
                <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 10 }}>{group.about}</Text>
              ) : null}

              {me && group && !group.owner ? (
                <Pressable onPress={toggleJoin} style={{ marginTop: 14 }}>
                  <View style={{
                    backgroundColor: group.joined ? C.glass : group.waiting ? C.glass : C.purple,
                    borderWidth: group.joined || group.waiting ? 1 : 0, borderColor: C.line,
                    borderRadius: 999, paddingVertical: 12, alignItems: 'center',
                  }}>
                    <Text style={{ color: group.joined || group.waiting ? C.dim : '#FFF', fontSize: 14, fontWeight: '900' }}>
                      {group.joined ? t('gp_joined') : group.waiting ? t('gp_waiting') : group.privacy === 'request' ? t('gp_ask') : t('gp_join')}
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              {/* ── WALL / PEOPLE ── */}
              <View style={{ flexDirection: 'row', marginTop: 18, marginBottom: 14 }}>
                {[['wall', 'gp_tab_wall'], ['people', 'gp_tab_people']].map(([k, key]) => (
                  <Pressable key={k} onPress={() => { tapSelection(); setTab(k); }} style={{ marginRight: 18 }}>
                    <Text style={{ color: tab === k ? C.text : C.faint, fontSize: 13.5, fontWeight: '900' }}>{t(key)}</Text>
                    <View style={{ height: 2, borderRadius: 2, marginTop: 6, backgroundColor: tab === k ? C.purple : 'transparent' }} />
                  </Pressable>
                ))}
              </View>

              {err ? (
                <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26 }}>{err === 'setup' ? '🧩' : '📡'}</Text>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>
                    {t(err === 'setup' ? 'gp_err_setup' : err === 'permission' ? 'gp_err_permission' : 'gp_err_offline')}
                  </Text>
                  {err === 'setup' ? null : (
                    <Pressable onPress={() => { tapLight(); load(); }} style={{ marginTop: 12 }}>
                      <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9 }}>
                        <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{t('ch_try_again')}</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              ) : tab === 'wall' ? (
                <>
                  {canPost ? (
                    <View style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <Avatar uri={me.avatar} />
                        <TextInput
                          value={draft} onChangeText={setDraft} multiline
                          placeholder={t('gp_write_ph')} placeholderTextColor={C.faint}
                          style={{ flex: 1, marginLeft: 10, color: C.text, fontSize: 14, minHeight: 38, paddingTop: Platform.OS === 'ios' ? 9 : 6 }}
                        />
                      </View>
                      <Pressable onPress={post} disabled={!draft.trim() || sending} style={{ alignSelf: 'flex-end', marginTop: 6, opacity: draft.trim() && !sending ? 1 : 0.45 }}>
                        <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}>
                          <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{t('gp_post')}</Text>
                        </View>
                      </Pressable>
                    </View>
                  ) : group && !group.joined && group.privacy === 'request' ? (
                    <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16 }}>
                      <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19 }}>{t('gp_locked')}</Text>
                    </View>
                  ) : null}

                  {wall === null ? <ActivityIndicator color={C.purple} style={{ marginTop: 20 }} /> : null}
                  {wall && !wall.length && !(group && !group.joined && group.privacy === 'request') ? (
                    <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 26, lineHeight: 19 }}>
                      {t('gp_empty')}
                    </Text>
                  ) : null}
                  {(wall || []).map((p) => (
                    <WallPost key={p.id} post={p} me={me} onLike={like} onRemove={drop} t={t} />
                  ))}
                </>
              ) : (
                <>
                  {people === null ? <ActivityIndicator color={C.purple} /> : null}
                  {group && group.admin && requests.length ? (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>
                        {t('gp_requests').toUpperCase()} · {requests.length}
                      </Text>
                      {requests.map((p) => (
                        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                          <Avatar uri={p.avatar} />
                          <Text style={{ flex: 1, color: C.text, fontSize: 13.5, fontWeight: '800', marginLeft: 10 }}>{p.name}</Text>
                          <Pressable onPress={() => admin(approveMember, p.id)} hitSlop={6} style={{ marginRight: 10 }}>
                            <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
                              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{t('gp_let_in')}</Text>
                            </View>
                          </Pressable>
                          <Pressable onPress={() => admin(removeMember, p.id)} hitSlop={8}>
                            <Ionicons name="close" size={17} color={C.faint} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {joined.map((p) => (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Avatar uri={p.avatar} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{p.name}</Text>
                        {p.role !== 'member' ? (
                          <Text style={{ color: C.purple, fontSize: 11, fontWeight: '800' }}>{t(p.role === 'owner' ? 'gp_owner' : 'gp_admin')}</Text>
                        ) : null}
                      </View>
                      {group && group.owner && p.role !== 'owner' ? (
                        <Pressable onPress={() => admin((g, u) => setMemberRole(g, u, p.role === 'admin' ? 'member' : 'admin'), p.id)} hitSlop={8} style={{ marginRight: 12 }}>
                          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800' }}>
                            {t(p.role === 'admin' ? 'gp_make_member' : 'gp_make_admin')}
                          </Text>
                        </Pressable>
                      ) : null}
                      {group && group.admin && p.role !== 'owner' ? (
                        <Pressable onPress={() => admin(removeMember, p.id)} hitSlop={8}>
                          <Ionicons name="person-remove-outline" size={16} color={C.faint} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
