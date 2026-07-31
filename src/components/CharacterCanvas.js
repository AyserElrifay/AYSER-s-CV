import React, { useEffect, useRef } from 'react';
import { View, Image, Platform } from 'react-native';
import { drawCharacter, characterToDataUrl } from '../services/characterArt';

/* The whole character, painted straight onto a canvas and repainted the
   instant anything changes — a colour, a jacket, the angle you're
   looking at them from. Nothing loads, so the studio feels live under
   your finger instead of stuttering through images.

   `turn` runs −1 → 1. Drag handling lives in whoever owns this; the
   canvas just draws whatever angle it's handed. */
export const CharacterCanvas = ({ dna, width = 150, turn = 0, shadow = true, style }) => {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const height = Math.round(width * 1.6);
  const key = (typeof dna === 'string' ? dna : JSON.stringify(dna)) + '|' + turn;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const host = hostRef.current;
    if (!host || !host.appendChild) return undefined;

    if (!canvasRef.current) {
      const cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:100%;display:block';
      host.appendChild(cv);
      canvasRef.current = cv;
    }
    const cv = canvasRef.current;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext('2d');
    if (!c) return undefined;
    c.clearRect(0, 0, w, h);
    try { drawCharacter(c, 0, 0, w, h, dna, { turn, shadow }); } catch (e) { /* never break a screen over a drawing */ }
    return undefined;
  }, [key, width, height, shadow]);

  if (Platform.OS !== 'web') {
    const uri = characterToDataUrl(dna, width, { turn, shadow });
    return uri ? <Image source={{ uri }} style={[{ width, height }, style]} /> : null;
  }
  return <View ref={hostRef} style={[{ width, height }, style]} />;
};
