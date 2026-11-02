import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tapLight } from '../../utils/feedback';

/* ─── KARAOKE FROM YOUTUBE, INSIDE MOMENTS ────────────────────────────
   Ayser, November 2026: "خلي الأغاني تشتغل كاريوكي من اليوتيوب … من جوه
   مومنتس … شغالة مع كل اللي داخلين الروم". The host picks a karaoke video;
   it plays in YouTube's own embedded player (youtube-nocookie.com, no app
   to open), and every phone in the room shows the same moment of it: the
   host's player says where it is every two seconds over the room's
   channel, and the others follow (they are muted unless they turn their
   sound on, so a table does not echo). The lyrics are the ones in the
   karaoke video itself — their owners put them there; Moments does not
   copy anybody's lyrics.

   No YouTube script is loaded: the player is driven with its own
   postMessage commands (enablejsapi=1). */
export const ytId = (s) => {
  const t = String(s || '').trim();
  const m = t.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/) || t.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
};

const W = {
  en: { sound: 'Sound on this phone', muted: 'Muted on this phone', host: 'You control the song for the whole room', follow: 'Following the host’s player', blocked: 'If the video says it cannot be played here, its owner does not allow embedding — pick another one.' },
  ar: { sound: 'الصوت شغال على الموبايل ده', muted: 'الصوت مقفول على الموبايل ده', host: 'إنت اللي بتشغّل الأغنية للأوضة كلها', follow: 'ماشي مع موبايل المنظّم', blocked: 'لو الفيديو قال إنه مينفعش يشتغل هنا، صاحبه مش سامح بده — اختار واحد تاني.' },
};
const ww = (lang, k) => W[lang === 'ar' ? 'ar' : 'en'][k];

export const YtKaraoke = ({ videoId, host, sync, onHostTick, lang }) => {
  const frame = useRef(null);
  const info = useRef({ t: 0, state: -1 });
  const [ready, setReady] = useState(false);
  const [sound, setSound] = useState(!!host);       // the host's phone plays the sound; the others choose
  const cmd = (func, args) => {
    try { frame.current && frame.current.contentWindow && frame.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); } catch (e) {}
  };

  // what the player says about itself
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const on = (e) => {
      if (!/youtube(-nocookie)?\.com$/.test(String(e.origin || '').replace(/^https?:\/\/(www\.)?/, ''))) return;
      let d = e.data; try { if (typeof d === 'string') d = JSON.parse(d); } catch (x) { return; }
      if (!d) return;
      if (d.event === 'onReady') setReady(true);
      if (d.event === 'infoDelivery' && d.info) {
        if (typeof d.info.currentTime === 'number') info.current.t = d.info.currentTime;
        if (typeof d.info.playerState === 'number') info.current.state = d.info.playerState;
        setReady(true);
      }
      if (d.event === 'onStateChange' && typeof d.info === 'number') info.current.state = d.info;
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);
  // ask it to keep talking (it answers "listening" with infoDelivery events)
  const listen = () => { try { frame.current && frame.current.contentWindow && frame.current.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (e) {} };
  useEffect(() => { const h = setInterval(listen, 1500); return () => clearInterval(h); }, []);
  useEffect(() => { if (ready) cmd(sound ? 'unMute' : 'mute'); }, [ready, sound]); // eslint-disable-line react-hooks/exhaustive-deps

  // the host says where the song is, every two seconds
  useEffect(() => {
    if (!host) return undefined;
    const h = setInterval(() => { const s = info.current.state; onHostTick && onHostTick({ playing: s === 1, pos: info.current.t || 0 }); }, 2000);
    return () => clearInterval(h);
  }, [host]); // eslint-disable-line react-hooks/exhaustive-deps

  // everybody else follows the host
  useEffect(() => {
    if (host || !ready || !sync) return undefined;
    const fix = () => {
      const target = (sync.pos || 0) + (sync.playing ? (Date.now() - (sync.at || Date.now())) / 1000 : 0);
      const playing = info.current.state === 1;
      if (sync.playing && !playing) cmd('playVideo');
      if (!sync.playing && playing) cmd('pauseVideo');
      if (Math.abs((info.current.t || 0) - target) > 1.5) cmd('seekTo', [Math.max(0, target), true]);
    };
    fix();
    const h = setInterval(fix, 1000);
    return () => clearInterval(h);
  }, [host, ready, sync && sync.at, sync && sync.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS !== 'web' || !videoId) return null;
  const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
  const src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&controls=' + (host ? 1 : 0) + '&origin=' + origin;
  return (
    <View testID="yt-karaoke" style={{ marginTop: 14 }}>
      <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', aspectRatio: 16 / 9 }}>
        {React.createElement('iframe', {
          ref: frame, src, title: 'Karaoke', allow: 'autoplay; encrypted-media; picture-in-picture', allowFullScreen: true,
          onLoad: () => { listen(); },
          style: { width: '100%', height: '100%', border: 0, display: 'block' },
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <Ionicons name={host ? 'radio-outline' : 'sync-outline'} size={14} color="rgba(255,255,255,0.6)" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginStart: 6, flex: 1 }}>{ww(lang, host ? 'host' : 'follow')}</Text>
        {!host ? (
          <Pressable testID="yt-sound" onPress={() => { tapLight(); setSound((v) => !v); }} accessibilityRole="switch" accessibilityState={{ checked: sound }} accessibilityLabel={ww(lang, 'sound')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#D9C08C', backgroundColor: sound ? '#D9C08C' : 'transparent' }}>
              <Ionicons name={sound ? 'volume-high' : 'volume-mute'} size={13} color={sound ? '#17131F' : '#D9C08C'} />
              <Text style={{ color: sound ? '#17131F' : '#D9C08C', fontSize: 12, fontWeight: '800', marginStart: 5 }}>{ww(lang, sound ? 'sound' : 'muted')}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, lineHeight: 16, marginTop: 8 }}>{ww(lang, 'blocked')}</Text>
    </View>
  );
};
