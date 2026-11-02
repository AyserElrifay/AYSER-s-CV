import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { mw } from '../constants/memoryWords';

/* ─── DRAW HOW TODAY FELT ─────────────────────────────────────────────
   Ayser, November 2026: "أرسم الإحساس بتاعي". A sheet of the book's own
   cream paper, a finger for a pen, five inks and two widths, undo and
   clear. "Put it in the book" hands back a small WebP of the drawing;
   the book uploads it and pins it to the page (RUN_ME.sql page_add). */
const INKS = ['#2A2118', '#7C3AED', '#FFC233', '#FF5A6E', '#22C7A9'];
const PAPER = '#F5EFE6';

export const DrawSheet = ({ lang, onDone, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const cv = useRef(null);
  const strokes = useRef([]);          // [{ ink, w, pts:[[x,y]…] }]
  const cur = useRef(null);
  const [ink, setInk] = useState(INKS[0]);
  const [wide, setWide] = useState(false);
  const [n, setN] = useState(0);       // how many strokes, so the buttons know
  const [busy, setBusy] = useState(false);

  const paint = () => {
    const c = cv.current; if (!c) return;
    const x = c.getContext('2d');
    x.fillStyle = PAPER; x.fillRect(0, 0, c.width, c.height);
    x.lineCap = 'round'; x.lineJoin = 'round';
    strokes.current.concat(cur.current ? [cur.current] : []).forEach((s) => {
      x.strokeStyle = s.ink; x.lineWidth = s.w;
      x.beginPath();
      s.pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
      if (s.pts.length === 1) x.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
      x.stroke();
    });
  };
  useEffect(() => {
    const c = cv.current; if (!c) return undefined;
    const fit = () => { const r = c.getBoundingClientRect(); c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2); paint(); };
    fit();
    const at = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * 2, (e.clientY - r.top) * 2]; };
    const down = (e) => { e.preventDefault(); c.setPointerCapture && c.setPointerCapture(e.pointerId); cur.current = { ink: c.dataset.ink, w: Number(c.dataset.w), pts: [at(e)] }; paint(); };
    const move = (e) => { if (!cur.current) return; e.preventDefault(); cur.current.pts.push(at(e)); paint(); };
    const up = () => { if (!cur.current) return; strokes.current.push(cur.current); cur.current = null; setN(strokes.current.length); paint(); };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); c.addEventListener('pointerleave', up);
    window.addEventListener('resize', fit);
    return () => {
      c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); c.removeEventListener('pointerleave', up);
      window.removeEventListener('resize', fit);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const c = cv.current; if (c) { c.dataset.ink = ink; c.dataset.w = String(wide ? 22 : 8); } }, [ink, wide]);

  const undo = () => { tapLight(); strokes.current.pop(); setN(strokes.current.length); paint(); };
  const clear = () => { tapLight(); strokes.current = []; setN(0); paint(); };
  const done = () => {
    const c = cv.current; if (!c || !n || busy) return;
    setBusy(true);
    // a book page does not need more than 1080 wide
    const k = Math.min(1, 1080 / c.width);
    const out = document.createElement('canvas'); out.width = Math.round(c.width * k); out.height = Math.round(c.height * k);
    out.getContext('2d').drawImage(c, 0, 0, out.width, out.height);
    const finish = (blob, ext, type) => { if (!blob) { setBusy(false); return; } tapSuccess(); Promise.resolve(onDone({ blob, ext, type })).finally(() => setBusy(false)); };
    out.toBlob((b) => (b && b.type === 'image/webp' ? finish(b, 'webp', 'image/webp') : out.toBlob((j) => finish(j, 'jpg', 'image/jpeg'), 'image/jpeg', 0.85)), 'image/webp', 0.8);
  };

  if (Platform.OS !== 'web') return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View testID="draw-sheet" style={{ flex: 1, backgroundColor: '#EDE5D8', paddingTop: insets.top + 8, paddingBottom: insets.bottom + 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={mw(lang, 'close')}>
            <Ionicons name="close" size={26} color="#2A2118" />
          </Pressable>
          <Text style={{ flex: 1, color: '#2A2118', fontSize: 18, fontWeight: '600', marginStart: 12, fontStyle: lang === 'ar' ? 'normal' : 'italic', fontFamily: 'Georgia, "Times New Roman", serif' }}>{mw(lang, 'drawTitle')}</Text>
        </View>
        <View style={{ flex: 1, margin: 14, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E7DDCC', backgroundColor: PAPER }}>
          {React.createElement('canvas', { ref: cv, 'data-testid': 'draw-canvas', style: { width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'crosshair' } })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          {INKS.map((c) => (
            <Pressable key={c} onPress={() => { tapLight(); setInk(c); }} accessibilityRole="button" accessibilityLabel={c} accessibilityState={{ selected: ink === c }} style={{ marginEnd: 10 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: ink === c ? 3 : 0, borderColor: '#FFFFFF' }} />
            </Pressable>
          ))}
          <Pressable onPress={() => { tapLight(); setWide((v) => !v); }} accessibilityRole="button" accessibilityLabel="width" style={{ marginEnd: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#2A2118', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: wide ? 16 : 7, height: wide ? 16 : 7, borderRadius: 8, backgroundColor: '#2A2118' }} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={undo} disabled={!n} accessibilityRole="button" accessibilityLabel={mw(lang, 'undo')} hitSlop={8} style={{ opacity: n ? 1 : 0.3, marginEnd: 14 }}>
            <Ionicons name="arrow-undo-outline" size={22} color="#2A2118" />
          </Pressable>
          <Pressable onPress={clear} disabled={!n} accessibilityRole="button" accessibilityLabel={mw(lang, 'clear')} hitSlop={8} style={{ opacity: n ? 1 : 0.3 }}>
            <Ionicons name="trash-outline" size={21} color="#2A2118" />
          </Pressable>
        </View>
        <Pressable testID="draw-done" onPress={done} disabled={!n || busy} accessibilityRole="button" style={{ marginHorizontal: 16, marginTop: 12 }}>
          <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: '#2A2118', opacity: n ? 1 : 0.4 }}>
            {busy ? <ActivityIndicator color="#F5EFE6" /> : <Text style={{ color: '#F5EFE6', fontSize: 15.5, fontWeight: '700' }}>{mw(lang, 'done')}</Text>}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};
