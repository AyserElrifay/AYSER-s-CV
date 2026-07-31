import React, { useState } from 'react';
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
import { tapLight } from '../utils/feedback';

const { height: H } = Dimensions.get('window');

/* TikTok-style full-screen reels: swipe up for the next one, action
   rail on the right, sound tag at the bottom. */
export const ReelsViewer = ({ reels, startIndex = 0, vibes, onVibe, onComment, onClose }) => {
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState(null);
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
        <View style={{ height: H, justifyContent: 'flex-end', backgroundColor: '#0B0715' }}>
          {/* muted+playsInline = iOS actually autoplays it.
              Some older clips were recorded by a browser that produced a
              file it cannot play back — those used to sit here as a
              black rectangle with no explanation. If the clip refuses to
              load we say so instead of showing nothing. */}
          <video
            src={item.media}
            autoPlay muted loop playsInline preload="auto" crossOrigin="anonymous"
            ref={(el) => {
              if (!el || el.__wired) return;
              el.__wired = true;
              el.muted = true;
              el.play().catch(() => {});
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
        </View>
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
          <Pressable onPress={() => setReport(item)} hitSlop={8} style={{ alignItems: 'center' }}>
            <Ionicons name="flag-outline" size={24} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 3 }}>Report</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          data={reels}
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
      </View>
    </Modal>
  );
};
