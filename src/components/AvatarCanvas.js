import React, { useEffect, useRef } from 'react';
import { View, Image, Platform } from 'react-native';
import { drawAvatar, avatarToRoundDataUrl } from '../services/avatarArt';

/* Draws an avatar straight onto a canvas and repaints the instant a
   trait changes — that's what makes the editor feel live: you tap a
   hair colour and the face changes under your finger, with nothing to
   load. Falls back to a rendered image where there's no canvas. */
export const AvatarCanvas = ({ dna, size = 200, round = false, style }) => {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const key = typeof dna === 'string' ? dna : JSON.stringify(dna);

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
    const px = Math.round(size * dpr);
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    const c = cv.getContext('2d');
    c.clearRect(0, 0, px, px);
    if (round) {
      c.save();
      c.beginPath(); c.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); c.clip();
      drawAvatar(c, -0.15 * px, -0.16 * px, px * 1.3, dna);
      c.restore();
    } else {
      drawAvatar(c, 0, 0, px, dna);
    }
    return undefined;
  }, [key, size, round]);

  if (Platform.OS !== 'web') {
    const uri = avatarToRoundDataUrl(dna, size);
    return uri ? <Image source={{ uri }} style={[{ width: size, height: size, borderRadius: round ? size / 2 : 18 }, style]} /> : null;
  }
  return <View ref={hostRef} style={[{ width: size, height: size, borderRadius: round ? size / 2 : 18, overflow: 'hidden' }, style]} />;
};
