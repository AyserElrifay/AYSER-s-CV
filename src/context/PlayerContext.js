import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { incrementTrackUse } from '../services/music';

/* The app-wide music player. One real <audio> element (web) lives here at
   the root, so playback keeps going as you move between tabs — the whole
   point of a "listen while you browse" music app. Native falls back to a
   no-op until the expo-av build; the app is web/PWA-first for now.

   A track: { id, title, artist, emoji, audio_url, attribution, license } */

const PlayerCtx = createContext(null);
export const usePlayer = () => useContext(PlayerCtx) || {};

const isWeb = Platform.OS === 'web';

export const PlayerProvider = ({ children }) => {
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const [current, setCurrent] = useState(null); // the playing track
  const [index, setIndex] = useState(-1);
  const [queue, setQueue] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [showFull, setShowFull] = useState(false); // Now-Playing sheet open

  // create the single audio element once
  useEffect(() => {
    if (!isWeb || typeof window === 'undefined' || audioRef.current) return;
    const a = new window.Audio();
    a.preload = 'metadata';
    audioRef.current = a;
    const onTime = () => setPosition(a.currentTime || 0);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => nextRef.current && nextRef.current();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, []);

  const loadAndPlay = useCallback((track) => {
    if (!track) return;
    setCurrent(track);
    setPosition(0);
    setDuration(0);
    if (isWeb && audioRef.current) {
      const a = audioRef.current;
      if (track.audio_url) {
        a.src = track.audio_url;
        a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        // no playable file yet (e.g. a curated row without audio) — honest stop
        a.removeAttribute('src'); a.load();
        setPlaying(false);
      }
    }
    if (track.id) incrementTrackUse(track.id); // real play-count
  }, []);

  const playTrack = useCallback((track, list, startIndex) => {
    const q = Array.isArray(list) && list.length ? list : [track];
    const i = typeof startIndex === 'number' ? startIndex : Math.max(0, q.findIndex((t) => t.id === track.id));
    queueRef.current = q;
    setQueue(q);
    setIndex(i);
    loadAndPlay(q[i] || track);
    setShowFull(true);
  }, [loadAndPlay]);

  const toggle = useCallback(() => {
    if (!isWeb || !audioRef.current || !current) return;
    const a = audioRef.current;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    else { a.pause(); setPlaying(false); }
  }, [current]);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (!q.length) return;
    let i;
    if (shuffle && q.length > 1) {
      do { i = Math.floor(Math.random() * q.length); } while (i === index);
    } else {
      i = index + 1;
      if (i >= q.length) i = 0; // loop the queue
    }
    setIndex(i);
    loadAndPlay(q[i]);
  }, [index, shuffle, loadAndPlay]);
  const nextRef = useRef(next);
  nextRef.current = next;

  const prev = useCallback(() => {
    const q = queueRef.current;
    if (!q.length) return;
    if (position > 3 && isWeb && audioRef.current) { audioRef.current.currentTime = 0; return; }
    let i = index - 1;
    if (i < 0) i = q.length - 1;
    setIndex(i);
    loadAndPlay(q[i]);
  }, [index, position, loadAndPlay]);

  const seek = useCallback((sec) => {
    if (isWeb && audioRef.current) { audioRef.current.currentTime = sec; setPosition(sec); }
  }, []);

  const close = useCallback(() => {
    if (isWeb && audioRef.current) { audioRef.current.pause(); audioRef.current.removeAttribute('src'); audioRef.current.load(); }
    setPlaying(false); setCurrent(null); setIndex(-1); setQueue([]); queueRef.current = []; setShowFull(false);
  }, []);

  const value = {
    current, queue, index, playing, position, duration, shuffle, showFull,
    playTrack, toggle, next, prev, seek, close,
    setShuffle: () => setShuffle((s) => !s),
    openFull: () => setShowFull(true),
    closeFull: () => setShowFull(false),
  };

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
};
