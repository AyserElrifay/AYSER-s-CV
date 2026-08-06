import React, { useState, useMemo, useRef } from 'react';
import { TextInput } from 'react-native';
import { looksPlayable, watchForBlankVideo } from '../lib/videoCheck';
import { View, Text, Modal, Pressable, ImageBackground, FlatList, Dimensions, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, TEXT_BGS } from '../constants/theme';
import { SoundChip } from './SoundChip';
import { ReportSheet } from './ReportSheet';
import { ProfileModal } from './ProfileModal';
import { sharePost, shareNote } from '../utils/share';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useAuth } from '../context/AuthContext';
import { deletePost, updatePost } from '../services/posts';
import { note } from '../lib/crashLog';
import { soundOn, setSoundOn, applySound } from '../lib/videoSound';

const { height: H } = Dimensions.get('window');

/* TikTok-style full-screen reels: swipe up for the next one, action
   rail on the right, sound tag at the bottom. */
export const ReelsViewer = ({ reels, startIndex = 0, vibes, onVibe, onComment, onClose, onDeleted, onEdited }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  /* ── YOUR OWN REEL ────────────────────────────────────────────────
     Somebody else's reel can be reported. Your own could only be
     reported too, which is absurd — the one thing you certainly have
     the right to do with your own video is take it down, and there was
     no way to.

     So on your own it's Manage instead: change the caption, change who
     it's for, or delete it. Deleting asks once, because it doesn't come
     back. */
  const [manage, setManage] = useState(null);
  const [draftCaption, setDraftCaption] = useState('');
  const [closeOnly, setCloseOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState({});
  const [confirmDel, setConfirmDel] = useState(false);
  const [manageErr, setManageErr] = useState(null);
  const [patched, setPatched] = useState({}); // edits, shown before the feed reloads
  /* ── SOUND ────────────────────────────────────────────────────────
     Reels played silently and there was no way to change that, which
     read as "my video uploaded without sound". The file has the sound;
     the player was throwing it away. A browser still needs the first
     play to be muted, so it starts that way and one tap turns it on —
     for this reel and every one after it. */
  const [sound, setSound] = useState(soundOn);
  const videosRef = useRef([]);

  const toggleSound = () => {
    const next = !sound;
    tapLight();
    setSound(next);
    setSoundOn(next);
    videosRef.current.forEach((el) => { if (el && el.isConnected) applySound(el); });
  };

  const openManage = (item) => {
    tapLight();
    setDraftCaption(item.caption || '');
    setCloseOnly(!!item.closeOnly);
    setConfirmDel(false);
    setManageErr(null);
    setManage(item);
  };

  const saveManage = async () => {
    if (!manage || !user || busy) return;
    setBusy(true); setManageErr(null);
    try {
      const caption = draftCaption.trim();
      const saved = await updatePost(manage.id, user.id, { caption, close_only: closeOnly });
      /* The caption saved and the audience quietly did not, because this
         database has nowhere to keep it yet. Telling somebody their
         change went through when half of it did not is worse than the
         limitation itself. */
      if (saved && saved.__dropped && saved.__dropped.indexOf('close_only') >= 0) {
        setPatched((p) => ({ ...p, [manage.id]: { caption } }));
        setManageErr('Caption saved. Choosing who can see it is not switched on yet.');
        onEdited && onEdited(manage.id, { caption });
        setBusy(false);
        return;
      }
      tapSuccess();
      setPatched((p) => ({ ...p, [manage.id]: { caption, closeOnly } }));
      setManage(null);
      onEdited && onEdited(manage.id, { caption, closeOnly });
    } catch (e) {
      note('reel-edit', e);
      setManageErr((e && e.message) || 'That did not save — try again.');
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!manage || !user || busy) return;
    setBusy(true); setManageErr(null);
    try {
      await deletePost(manage.id, user.id);
      setGone((g) => ({ ...g, [manage.id]: true }));
      const id = manage.id;
      setManage(null);
      onDeleted && onDeleted(id);
      // it was the only one left — there's nothing behind it to go back to
      if ((reels || []).filter((r) => r.id !== id && !gone[r.id]).length === 0) onClose && onClose();
    } catch (e) {
      note('reel-delete', e);
      setManageErr((e && e.message) || 'Could not delete it — try again.');
    } finally { setBusy(false); }
  };

  /* A deleted reel leaves the stack the moment it's gone and an edited
     caption shows the new words straight away — neither waits for the
     screen behind us to reload. */
  const visible = useMemo(
    () => (reels || []).filter((r) => !gone[r.id]).map((r) => (patched[r.id] ? { ...r, ...patched[r.id] } : r)),
    [reels, gone, patched],
  );
  const [profileUser, setProfileUser] = useState(null);
  const [shared, setShared] = useState(null); // the copied link, when there's no share sheet

  const openProfile = (u) => {
    if (!u || !u.id) return;
    tapLight();
    setProfileUser({ id: u.id, name: u.name, avatar: u.avatar, verified: !!u.verified, countryFlag: u.flag || null });
  };

  const share = async (item) => {
    tapLight();
    const note = shareNote(await sharePost(item));
    // null = the phone's share sheet already did it, so say nothing
    if (note) { setShared(note); setTimeout(() => setShared(null), 2400); }
  };

  const renderReel = ({ item }) => {
    const vibed = !!vibes[item.id];
    const bg = TEXT_BGS[item.textBg] || null;
    // an uploaded reel VIDEO must actually play — it was being drawn as a
    // still ImageBackground before, which is why reels "wouldn't load"
    /* These are reels, so they're video. Gating on the filename meant
       anything stored without an extension rendered as a still image of
       a video file — i.e. nothing. */
    const isVideo = looksPlayable(item.media, item.type === 'reel' || item.kind === 'video');
    const content = item.media ? (
      isVideo && Platform.OS === 'web' ? (
        <Pressable onPress={toggleSound} style={{ height: H, justifyContent: 'flex-end', backgroundColor: '#0B0715' }}>
          {/* muted+playsInline = iOS actually autoplays it.
              Some older clips were recorded by a browser that produced a
              file it cannot play back — those used to sit here as a
              black rectangle with no explanation. If the clip refuses to
              load we say so instead of showing nothing. */}
          {/* No crossOrigin. It was here so the blank-frame check could
              read pixels off a canvas, and it cost far more than it
              bought: a host that doesn't return an
              Access-Control-Allow-Origin header makes the browser
              refuse the video outright — 0x0, readyState 0, nothing on
              screen. Measured all four combinations: with the header it
              loads either way, without it, only the plain one loads. The
              attribute can never help playback, only forbid it. The
              blank-frame check already goes quiet when it can't read a
              canvas, which is the right way round: playing the clip
              matters more than being able to inspect it. */}
          <video
            src={item.media}
            autoPlay muted loop playsInline preload="auto"
            ref={(el) => {
              if (!el || el.__wired) return;
              el.__wired = true;
              videosRef.current.push(el);
              applySound(el);
              /* A clip that plays but shows nothing is the common
                 failure here, and it passes every "did it load" test.
                 Look at the pixels. */
              watchForBlankVideo(el, () => {
                const n = el.parentNode;
                const w = n && n.querySelector('.mm-clip-dead');
                if (w) w.style.display = 'flex';
              });
            }}
            onError={(e) => { const n = e && e.currentTarget && e.currentTarget.parentNode; if (n) { const w = n.querySelector('.mm-clip-dead'); if (w) w.style.display = 'flex'; } }}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div className="mm-clip-dead" style={{
            display: 'none', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            background: 'linear-gradient(160deg,#2B1055,#160B2B)', color: '#FFF',
            fontFamily: '-apple-system, system-ui, sans-serif', textAlign: 'center', padding: '0 40px',
          }}>
            <div style={{ fontSize: 34 }}>🎞️</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 10 }}>This clip didn't record properly</div>
            <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 6, lineHeight: 1.5 }}>
              The browser that made it wrote a file it can't play back. Record a new one from the camera and it will work.
            </div>
          </div>
          {inner(item, vibed)}
        </Pressable>
      ) : (
      <ImageBackground source={{ uri: item.media }} style={{ height: H, justifyContent: 'flex-end' }} resizeMode="cover">
        {inner(item, vibed)}
      </ImageBackground>
      )
    ) : (
      <LinearGradient colors={bg ? bg.colors : ['#4C1D95', '#7C3AED']} style={{ height: H, justifyContent: 'flex-end' }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Text style={{ color: bg ? bg.text : '#FFF', fontSize: 26, lineHeight: 38, fontWeight: '800', textAlign: 'center' }}>
            {item.caption}
          </Text>
        </View>
        {inner(item, vibed, true)}
      </LinearGradient>
    );
    return <View style={{ height: H }}>{content}</View>;
  };

  const inner = (item, vibed, textMode) => (
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 28, paddingTop: 70 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1, marginRight: 14 }}>
          {/* author */}
          <Pressable
            onPress={() => openProfile(item.user)}
            hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, alignSelf: 'flex-start' }}
          >
            <Image source={{ uri: item.user.avatar }} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: '#FFF' }} />
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', marginLeft: 9 }}>{item.user.name}</Text>
          </Pressable>
          {!textMode ? (
            <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 13.5, lineHeight: 19, marginBottom: 10 }} numberOfLines={3}>
              {item.caption}
            </Text>
          ) : null}
          <SoundChip sound={item.sound} />
        </View>

        {/* action rail */}
        <View style={{ alignItems: 'center' }}>
          {item.media ? (
            <Pressable onPress={toggleSound} hitSlop={8} style={{ alignItems: 'center', marginBottom: 18 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: sound ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={sound ? 'volume-high' : 'volume-mute'} size={19} color="#FFF" />
              </View>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800', marginTop: 3 }}>{sound ? 'Sound' : 'Muted'}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => onVibe(item)} hitSlop={8} style={{ alignItems: 'center', marginBottom: 18 }}>
            <MaterialCommunityIcons name={vibed ? 'star-four-points' : 'star-four-points-outline'} size={32} color={vibed ? C.gold : '#FFF'} />
            <Text style={{ color: vibed ? C.gold : '#FFF', fontSize: 12, fontWeight: '800', marginTop: 3 }}>
              {(item.vibes || 0) + (vibed ? 1 : 0)}
            </Text>
          </Pressable>
          <Pressable onPress={() => onComment(item)} hitSlop={8} style={{ alignItems: 'center', marginBottom: 18 }}>
            <MaterialCommunityIcons name="script-text-outline" size={30} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 3 }}>{item.comments || 0}</Text>
          </Pressable>
          <Pressable onPress={() => share(item)} hitSlop={8} style={{ alignItems: 'center', marginBottom: 18 }}>
            <Ionicons name="paper-plane-outline" size={26} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 3 }}>Share</Text>
          </Pressable>
          {user && item.user && item.user.id === user.id ? (
            <Pressable onPress={() => openManage(item)} hitSlop={8} style={{ alignItems: 'center' }}>
              <Ionicons name="ellipsis-horizontal-circle-outline" size={30} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 3 }}>Manage</Text>
            </Pressable>
          ) : (
          <Pressable onPress={() => setReport(item)} hitSlop={8} style={{ alignItems: 'center' }}>
            <Ionicons name="flag-outline" size={24} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 3 }}>Report</Text>
          </Pressable>
          )}
        </View>
      </View>
    </LinearGradient>
  );

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          renderItem={renderReel}
          pagingEnabled
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: H, offset: H * i, index: i })}
          showsVerticalScrollIndicator={false}
          snapToInterval={H}
          decelerationRate="fast"
        />
        {/* header */}
        <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', letterSpacing: 2, flex: 1 }}>REELS ✦</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>
        </View>
        {shared ? (
          <View style={{ position: 'absolute', bottom: insets.bottom + 110, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.82)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }}>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{shared}</Text>
          </View>
        ) : null}
        {profileUser ? <ProfileModal user={profileUser} onClose={() => setProfileUser(null)} /> : null}
        {report ? (
          <ReportSheet contentType="reel" contentId={report.id} contentLabel={(report.user && report.user.name) || 'this reel'} onClose={() => setReport(null)} />
        ) : null}
        {manage ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setManage(null)}>
            <Pressable onPress={() => !busy && setManage(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
              <Pressable onPress={() => {}} style={{ backgroundColor: '#150C2B', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 20 }}>
                <View style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', marginBottom: 16 }} />
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900', marginBottom: 4 }}>Your reel</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginBottom: 16 }}>
                  Change what it says, change who sees it, or take it down.
                </Text>

                {/* caption */}
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800', marginBottom: 7 }}>CAPTION</Text>
                <TextInput
                  value={draftCaption}
                  onChangeText={setDraftCaption}
                  multiline
                  placeholder="Say something about it…"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  editable={!busy}
                  style={{
                    color: '#FFF', fontSize: 15, lineHeight: 21, minHeight: 78, maxHeight: 150,
                    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 13,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', textAlignVertical: 'top',
                  }}
                />

                {/* who it's for */}
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800', marginTop: 18, marginBottom: 7 }}>WHO CAN SEE IT</Text>
                <View style={{ flexDirection: 'row' }}>
                  {[
                    { on: false, icon: 'earth', label: 'Everyone', sub: 'Anyone on Moments' },
                    { on: true, icon: 'star', label: 'Close Friends', sub: 'Only your circle' },
                  ].map((opt) => {
                    const picked = closeOnly === opt.on;
                    return (
                      <Pressable
                        key={opt.label}
                        onPress={() => { if (busy) return; tapLight(); setCloseOnly(opt.on); }}
                        style={{
                          flex: 1, marginRight: opt.on ? 0 : 10, borderRadius: 14, padding: 12,
                          backgroundColor: picked ? (opt.on ? 'rgba(52,199,89,0.18)' : 'rgba(124,58,237,0.22)') : 'rgba(255,255,255,0.06)',
                          borderWidth: 1.5, borderColor: picked ? (opt.on ? C.green : C.purple) : 'rgba(255,255,255,0.12)',
                        }}
                      >
                        <Ionicons name={picked ? opt.icon : opt.icon + '-outline'} size={18} color={picked ? (opt.on ? C.green : '#FFF') : 'rgba(255,255,255,0.6)'} />
                        <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800', marginTop: 6 }}>{opt.label}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>{opt.sub}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {manageErr ? (
                  <Text style={{ color: '#FF7A7A', fontSize: 12.5, marginTop: 14 }}>{manageErr}</Text>
                ) : null}

                {/* save */}
                <Pressable
                  onPress={saveManage}
                  disabled={busy}
                  style={{ marginTop: 18, borderRadius: 999, overflow: 'hidden', opacity: busy ? 0.6 : 1 }}
                >
                  <LinearGradient colors={[C.purple, C.coral]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{busy ? 'Saving…' : 'Save changes'}</Text>
                  </LinearGradient>
                </Pressable>

                {/* delete — asks once, because it doesn't come back */}
                {!confirmDel ? (
                  <Pressable
                    onPress={() => { tapLight(); setConfirmDel(true); }}
                    disabled={busy}
                    style={{ marginTop: 12, paddingVertical: 13, borderRadius: 999, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,122,122,0.5)' }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF7A7A" />
                    <Text style={{ color: '#FF7A7A', fontSize: 14, fontWeight: '800', marginLeft: 7 }}>Delete this reel</Text>
                  </Pressable>
                ) : (
                  <View style={{ marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,122,122,0.4)', backgroundColor: 'rgba(255,122,122,0.08)', padding: 13 }}>
                    <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>Delete it for good?</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>
                      The video, its stars and its comments all go. This can't be undone.
                    </Text>
                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                      <Pressable
                        onPress={() => setConfirmDel(false)}
                        disabled={busy}
                        style={{ flex: 1, marginRight: 10, paddingVertical: 11, borderRadius: 999, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}
                      >
                        <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>Keep it</Text>
                      </Pressable>
                      <Pressable
                        onPress={doDelete}
                        disabled={busy}
                        style={{ flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center', backgroundColor: '#E5484D', opacity: busy ? 0.6 : 1 }}
                      >
                        <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>{busy ? 'Deleting…' : 'Delete'}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}
      </View>
    </Modal>
  );
};
