import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, ScrollView, Modal, Platform, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { submitScore, fetchLeaderboard } from '../services/games';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxStar, sfxSuccess } from '../utils/sfx';
import { SekoSeko } from './SekoSeko';

/* ─── سيكو سيكو 3D · first-person استغماية in an old-Cairo alley ────────────
   A real stylised-3D neighbourhood built with WebGL (three.js, loaded on
   demand only in the browser). You walk the hara in first person — drag to
   look around, use the pad / WASD to move — and hunt the kids hiding down
   the alley before the timer runs out. If the device can't do WebGL (or
   three fails to load) it falls back to the 2D <SekoSeko/> so nobody is
   left without the game. Real global leaderboard, same as everywhere. */

const ROUND_SEC = 60;
const FIND_RADIUS = 2.4;
const MOVE_SPEED = 3.4;           // units / second
const BOUND_X = 4.0;
const BOUND_Z_MIN = -44;
const BOUND_Z_MAX = 6;
const KID_SHIRTS = ['#ff5e8a', '#3bd1c0', '#f2b134', '#7c5cff', '#ff9e2c', '#25c2e8'];
// where the kids hide down the alley (x, z on the ground)
const HIDE = [
  { x: 3.3, z: -7 }, { x: -3.3, z: -15 }, { x: 3.2, z: -27 },
  { x: -3.2, z: -35 }, { x: 0.4, z: -42 }, { x: -2.0, z: 3.5 },
];

// runtime-only WebGL check
const webglOK = () => {
  try {
    if (typeof document === 'undefined') return false;
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
};

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rrect = (x, a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };

// ── procedural textures (warm old-Cairo sandstone / cobble / mashrabiya) ──
function sandTex(THREE, tone) {
  const c = cv(256, 512), x = c.getContext('2d');
  x.fillStyle = tone; x.fillRect(0, 0, 256, 512);
  x.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 500; i++) x.fillRect(Math.random() * 256, Math.random() * 512, 2, 2);
  x.strokeStyle = 'rgba(60,42,22,0.28)'; x.lineWidth = 2;
  for (let yy = 0; yy <= 512; yy += 64) { x.beginPath(); x.moveTo(0, yy); x.lineTo(256, yy); x.stroke(); }
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = 30 + col * 80, wy = 34 + row * 68, ww = 40, wh = 42;
      const lit = ((row * 3 + col) % 5) < 2;
      x.fillStyle = lit ? '#ffcf7a' : '#2a2013';
      x.beginPath();
      x.moveTo(wx, wy + wh); x.lineTo(wx, wy + 15);
      x.arc(wx + ww / 2, wy + 15, ww / 2, Math.PI, 0); x.lineTo(wx + ww, wy + wh); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(50,34,16,0.7)'; x.lineWidth = 3; x.stroke();
      if (lit) { x.fillStyle = 'rgba(255,150,60,0.25)'; x.fillRect(wx - 3, wy + wh - 6, ww + 6, 8); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function cobbleTex(THREE) {
  const c = cv(160, 160), x = c.getContext('2d');
  x.fillStyle = '#6f6248'; x.fillRect(0, 0, 160, 160);
  const cols = ['#c4b592', '#b8a983', '#cabb98', '#b0a079', '#bcae86'];
  for (let yy = 4, r = 0; yy < 164; yy += 26, r++) {
    for (let xx = 4; xx < 164; xx += 30) {
      x.fillStyle = cols[(xx + yy) % cols.length];
      rrect(x, xx + (r % 2) * 15, yy, 24, 20, 8); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.08)'; rrect(x, xx + (r % 2) * 15 + 2, yy + 2, 20, 6, 4); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function mashTex(THREE) {
  const c = cv(128, 128), x = c.getContext('2d');
  x.fillStyle = '#6e4a28'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#241505';
  for (let yy = 8; yy < 128; yy += 15) for (let xx = 8; xx < 128; xx += 15) { x.beginPath(); x.arc(xx, yy, 4.2, 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(20,10,2,0.5)'; x.lineWidth = 2;
  for (let g = 0; g <= 128; g += 30) { x.beginPath(); x.moveTo(g, 0); x.lineTo(g, 128); x.stroke(); x.beginPath(); x.moveTo(0, g); x.lineTo(128, g); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function skyTex(THREE) {
  const c = cv(16, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#5aa0d8'); g.addColorStop(0.5, '#a9c7e0'); g.addColorStop(0.78, '#f0d9a8'); g.addColorStop(1, '#e8b878');
  x.fillStyle = g; x.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ── build the whole 3D world; returns handles the game loop drives ──
function buildScene(THREE, W, H) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe8c890, 22, 76);

  // sky dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex(THREE), side: THREE.BackSide, fog: false }));
  scene.add(sky);

  // lights — warm afternoon
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0xd8b878, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.5); sun.position.set(8, 16, 6); scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.28));

  // ground — cobblestone
  const ct = cobbleTex(THREE); ct.repeat.set(12, 26);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 130), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -40; scene.add(ground);

  const tones = ['#c9a878', '#d0b487', '#bf9d6c', '#c7a670', '#d4b98e'];
  const mash = mashTex(THREE);

  function building(x, z, w, d, h, tone) {
    const g = new THREE.Group();
    const st = sandTex(THREE, tone); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 3)));
    const side = new THREE.MeshStandardMaterial({ map: st, roughness: 0.9 });
    const top = new THREE.MeshStandardMaterial({ color: 0x9c8560, roughness: 1 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, side, side, side]);
    box.position.set(x, h / 2, z); g.add(box);
    // mashrabiya balcony on the street-facing side
    const face = x > 0 ? -1 : 1;
    const mb = new THREE.Mesh(new THREE.BoxGeometry(Math.min(2.4, w * 0.6), 1.3, 0.35), new THREE.MeshStandardMaterial({ map: mash, roughness: 0.7 }));
    mb.position.set(x + face * (w / 2 + 0.02), h * 0.55, z + 1.6); g.add(mb);
    const mb2 = mb.clone(); mb2.position.z = z - 2.2; g.add(mb2);
    // rooftop water tank
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.8 }));
    tank.position.set(x + (face * -0.6), h + 0.45, z - 1); g.add(tank);
    scene.add(g);
  }

  // two rows of houses lining the alley
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let z = -2; z > -46; z -= 6) {
    const h1 = 6 + rnd() * 7, h2 = 6 + rnd() * 7;
    building(6.5, z, 5, 5.4, h1, tones[Math.floor(rnd() * tones.length)]);
    building(-6.5, z, 5, 5.4, h2, tones[Math.floor(rnd() * tones.length)]);
  }

  // mosque closing the alley + minaret + green dome
  const mosque = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 7), new THREE.MeshStandardMaterial({ map: sandTex(THREE, '#d8c49a'), roughness: 0.9 }));
  mosque.position.set(0, 4, -50); scene.add(mosque);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f8f7d, roughness: 0.5, metalness: 0.2 }));
  dome.position.set(-2, 8, -50); scene.add(dome);
  const minMat = new THREE.MeshStandardMaterial({ color: 0xd8c49a, roughness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.55 - i * 0.1, 0.62 - i * 0.1, 3, 12), minMat);
    seg.position.set(3.5, 9 + i * 2.8, -50); scene.add(seg);
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0x3f8f7d }));
  cap.position.set(3.5, 17.6, -50); scene.add(cap);

  // palms
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 1 }));
    trunk.position.y = 1.6; g.add(trunk);
    for (let a = 0; a < 7; a++) {
      const frond = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2f8f52, roughness: 1 }));
      frond.scale.set(1.4, 0.18, 0.5); frond.position.set(Math.cos(a) * 0.7, 3.3, Math.sin(a) * 0.7); frond.rotation.y = a; g.add(frond);
    }
    g.position.set(x, 0, z); scene.add(g);
  }
  palm(3.6, -3); palm(-3.6, -20); palm(3.6, -38); palm(-3.6, 2);

  // lanterns (soft warm point light + glowing box)
  const lamps = [];
  function lantern(x, z) {
    const p = new THREE.PointLight(0xffc070, 5, 9, 2); p.position.set(x, 3.1, z); scene.add(p);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.28), new THREE.MeshStandardMaterial({ color: 0xffcf80, emissive: 0xffb040, emissiveIntensity: 1.4 }));
    b.position.set(x, 3.1, z); scene.add(b); lamps.push(p);
  }
  lantern(3.2, -10); lantern(-3.2, -30); lantern(0, -46);

  // market stalls (cover) + awnings
  function stall(x, z, col) {
    const g = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.2), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.9 }));
    table.position.y = 0.45; g.add(table);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.5), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
    awn.position.y = 1.9; g.add(awn);
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a })); post.position.set(sx * 1.1, 0.95, 0.6); g.add(post); }
    g.position.set(x, 0, z); scene.add(g);
  }
  stall(2.6, -13, 0xd8443c); stall(-2.6, -25, 0x2f8f7d); stall(2.4, 4.5, 0xe0a92c);

  // a black-and-white Cairo taxi
  const taxi = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 3.6), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.4 }));
  body.position.y = 0.6; taxi.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.7, 1.8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 }));
  cabin.position.set(0, 1.25, -0.1); taxi.add(cabin);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.28, 3.62), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
  band.position.y = 0.42; taxi.add(band);
  taxi.position.set(-3.0, 0, -9); taxi.rotation.y = 0.15; scene.add(taxi);

  // ── the hiding kids ──
  const kids = HIDE.map((h, i) => {
    const g = new THREE.Group();
    const shirt = new THREE.Color(KID_SHIRTS[i % KID_SHIRTS.length]);
    const body2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.85, 10), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 }));
    body2.position.y = 0.5; g.add(body2);
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x30363f, roughness: 1 }));
    legs.position.y = 0.12; g.add(legs);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }));
    head.position.y = 1.08; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a1a10 }));
    hair.position.y = 1.12; g.add(hair);
    g.position.set(h.x, 0, h.z); g.rotation.y = i * 1.3; scene.add(g);
    return { group: g, body: body2, x: h.x, z: h.z, found: false, foundAt: 0, baseCol: shirt };
  });

  const camera = new THREE.PerspectiveCamera(74, W / H, 0.1, 200);
  camera.position.set(0, 1.65, 4);
  camera.rotation.order = 'YXZ';

  return { scene, camera, kids, dispose: () => { try { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); }); } }); } catch (e) {} } };
}

export const SekoSeko3D = ({ onClose }) => {
  const { user } = useAuth();
  const [support, setSupport] = useState('checking'); // checking | ok | no
  const [phase, setPhase] = useState('ready');
  const [foundCount, setFoundCount] = useState(0);
  const [left, setLeft] = useState(ROUND_SEC);
  const [hint, setHint] = useState('');
  const [board, setBoard] = useState(null);

  const hostRef = useRef(null);
  const engine = useRef(null);            // { THREE, renderer, scene, camera, kids, dispose }
  const look = useRef({ yaw: 0, pitch: 0.03 });
  const move = useRef({ f: 0, s: 0 });
  const rafRef = useRef(null);
  const timer = useRef(null);
  const phaseRef = useRef('ready');
  const startedAt = useRef(0);

  const setP = (p) => { phaseRef.current = p; setPhase(p); };

  // decide support once
  useEffect(() => { setSupport(Platform.OS === 'web' && webglOK() ? 'ok' : 'no'); }, []);

  // boot the 3D engine (web + supported only)
  useEffect(() => {
    if (support !== 'ok') return undefined;
    let alive = true;
    const host = hostRef.current;
    if (!host || !host.appendChild) return undefined;

    (async () => {
      let THREE;
      try { THREE = await import('three'); } catch (e) { if (alive) setSupport('no'); return; }
      if (!alive) return;
      let rect = host.getBoundingClientRect();
      let W = Math.max(1, rect.width), Hh = Math.max(1, rect.height);
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
        renderer.setSize(W, Hh);
      } catch (e) { if (alive) setSupport('no'); return; }
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      host.appendChild(renderer.domElement);

      let built;
      try { built = buildScene(THREE, W, Hh); } catch (e) { if (alive) setSupport('no'); try { host.removeChild(renderer.domElement); } catch (_) {} renderer.dispose(); return; }
      const { scene, camera, kids, dispose } = built;
      engine.current = { THREE, renderer, scene, camera, kids, dispose };

      const forward = new THREE.Vector3();
      const right = new THREE.Vector3();
      let last = performance.now();
      let lastHint = '', hintTick = 0;

      const frame = () => {
        if (!alive) return;
        rafRef.current = requestAnimationFrame(frame);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000); last = now;

        // resize if needed
        const r = host.getBoundingClientRect();
        const nw = Math.max(1, r.width), nh = Math.max(1, r.height);
        if (Math.abs(nw - W) > 1 || Math.abs(nh - Hh) > 1) {
          W = nw; Hh = nh; renderer.setSize(W, Hh); camera.aspect = W / Hh; camera.updateProjectionMatrix();
        }

        // aim
        camera.rotation.y = look.current.yaw;
        camera.rotation.x = look.current.pitch;

        // movement (only while playing), relative to yaw on the ground
        const m = move.current;
        if (phaseRef.current === 'playing' && (m.f || m.s)) {
          camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
          right.setFromMatrixColumn(camera.matrix, 0); right.y = 0; right.normalize();
          const step = MOVE_SPEED * dt;
          const p = camera.position;
          p.addScaledVector(forward, m.f * step);
          p.addScaledVector(right, m.s * step);
          p.x = Math.max(-BOUND_X, Math.min(BOUND_X, p.x));
          p.z = Math.max(BOUND_Z_MIN, Math.min(BOUND_Z_MAX, p.z));
          p.y = 1.65;

          // find kids + hot/cold
          let nearest = Infinity, gained = 0;
          for (const k of kids) {
            if (k.found) continue;
            const d = Math.hypot(k.x - p.x, k.z - p.z);
            if (d < nearest) nearest = d;
            if (d < FIND_RADIUS) { k.found = true; k.foundAt = now; gained++; k.body.material.emissive = new THREE.Color(0xffd23f); k.body.material.emissiveIntensity = 0.9; }
          }
          if (gained) {
            const total = kids.filter((k) => k.found).length;
            setFoundCount(total); tapSuccess(); sfxStar();
            if (total >= kids.length) doWin();
          }
          hintTick += dt;
          if (hintTick > 0.2) {
            hintTick = 0;
            const lbl = nearest === Infinity ? '' : nearest < 6 ? 'سخن جدًا 🔥' : nearest < 12 ? 'سخن 🌡️' : nearest < 22 ? 'دافي' : 'بارد ❄️';
            if (lbl !== lastHint) { lastHint = lbl; setHint(lbl); }
          }
        }

        // little hop when just found
        for (const k of kids) {
          if (k.found && k.foundAt) {
            const t = (now - k.foundAt) / 1000;
            k.group.position.y = t < 0.7 ? Math.abs(Math.sin(t * 9)) * 0.35 : 0;
            k.group.rotation.y += dt * 2.2;
          }
        }

        renderer.render(scene, camera);
      };
      rafRef.current = requestAnimationFrame(frame);
    })();

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const e = engine.current;
      if (e) { try { host.removeChild(e.renderer.domElement); } catch (_) {} try { e.dispose(); } catch (_) {} try { e.renderer.dispose(); } catch (_) {} }
      engine.current = null;
    };
  }, [support]);

  // keyboard (web)
  useEffect(() => {
    if (support !== 'ok' || typeof window === 'undefined') return undefined;
    const set = (e, on) => {
      const k = e.key.toLowerCase(); const m = move.current;
      if (k === 'w' || k === 'arrowup') m.f = on ? 1 : (m.f > 0 ? 0 : m.f);
      else if (k === 's' || k === 'arrowdown') m.f = on ? -1 : (m.f < 0 ? 0 : m.f);
      else if (k === 'd' || k === 'arrowright') m.s = on ? 1 : (m.s > 0 ? 0 : m.s);
      else if (k === 'a' || k === 'arrowleft') m.s = on ? -1 : (m.s < 0 ? 0 : m.s);
      else return;
      e.preventDefault();
    };
    const kd = (e) => set(e, true), ku = (e) => set(e, false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [support]);

  useEffect(() => () => { clearInterval(timer.current); }, []);

  // drag-to-look over the viewport — RN gives cumulative dx/dy, so track deltas
  const dragPrev = useRef({ x: 0, y: 0, active: false });
  const looker = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { dragPrev.current = { x: 0, y: 0, active: true }; },
    onPanResponderMove: (_e, g) => {
      const dx = g.dx - dragPrev.current.x, dy = g.dy - dragPrev.current.y;
      dragPrev.current.x = g.dx; dragPrev.current.y = g.dy;
      look.current.yaw -= dx * 0.006;
      look.current.pitch = Math.max(-0.7, Math.min(0.55, look.current.pitch - dy * 0.006));
    },
    onPanResponderRelease: () => { dragPrev.current.active = false; },
    onPanResponderTerminate: () => { dragPrev.current.active = false; },
  })).current;

  const doWin = () => {
    clearInterval(timer.current); tapSuccess(); sfxSuccess();
    const timeLeft = Math.max(0, ROUND_SEC - Math.round((Date.now() - startedAt.current) / 1000));
    if (user) submitScore(user.id, 'sekoseko', 600 + timeLeft * 12);
    setP('won');
  };
  const doLose = () => {
    clearInterval(timer.current); tapLight(); sfxPop();
    const e = engine.current; const score = e ? e.kids.filter((k) => k.found).length * 60 : 0;
    if (user && score > 0) submitScore(user.id, 'sekoseko', score);
    setP('lost');
  };

  const start = () => {
    tapMedium(); sfxPop();
    const e = engine.current;
    if (e) {
      for (const k of e.kids) { k.found = false; k.foundAt = 0; k.group.position.y = 0; k.body.material.emissive = new e.THREE.Color(0x000000); k.body.material.emissiveIntensity = 0; }
      e.camera.position.set(0, 1.65, 4);
    }
    look.current = { yaw: 0, pitch: 0.03 };
    move.current = { f: 0, s: 0 };
    setFoundCount(0); setLeft(ROUND_SEC); setHint('');
    startedAt.current = Date.now();
    setP('playing');
    clearInterval(timer.current);
    timer.current = setInterval(() => { setLeft((s) => { if (s <= 1) { doLose(); return 0; } return s - 1; }); }, 1000);
  };

  const total = engine.current ? engine.current.kids.length : HIDE.length;
  const padBtn = (which, dx) => ({
    onPressIn: () => { tapLight(); if (which === 'f') move.current.f = dx; else move.current.s = dx; },
    onPressOut: () => { if (which === 'f') move.current.f = 0; else move.current.s = 0; },
  });

  // fallback to the 2D game when WebGL isn't available
  if (support === 'no') return <SekoSeko onClose={onClose} />;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#160E2E' }}>
        {/* top bar */}
        <View style={{ paddingTop: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}><Ionicons name="chevron-down" size={28} color="#FFF" /></Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#FF2E88', fontSize: 15, fontWeight: '900', letterSpacing: 2 }}>سيكو سيكو</Text>
            <Text style={{ color: '#20E3D2', fontSize: 11, marginTop: 2, fontWeight: '700' }}>🇪🇬 حارة مصرية · 3D استغماية</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800' }}>لقيت</Text>
            <Text style={{ color: C.gold, fontSize: 18, fontWeight: '900' }}>{foundCount}/{total}</Text>
          </View>
        </View>

        {/* the 3D viewport — drag anywhere here to look around */}
        <View style={{ flex: 1, marginTop: 12, marginHorizontal: 10, borderRadius: 22, overflow: 'hidden', backgroundColor: '#1E1436', borderWidth: 1, borderColor: 'rgba(255,46,136,0.35)' }}>
          <View ref={hostRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} {...looker.panHandlers} />

          {support === 'checking' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 13 }}>بيجهّز الحارة… 🌆</Text>
            </View>
          ) : null}

          {/* hot/cold + timer */}
          {phase === 'playing' && hint ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{hint}</Text>
            </View>
          ) : null}
          {phase === 'playing' ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: left <= 10 ? C.coral : '#FFF', fontSize: 13, fontWeight: '900' }}>⏱ {left}s</Text>
            </View>
          ) : null}
          {phase === 'playing' ? (
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10.5, fontWeight: '700' }}>اسحب بصباعك تبص حواليك 👀</Text>
            </View>
          ) : null}

          {/* READY */}
          {phase === 'ready' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,14,46,0.62)', padding: 24 }}>
              <Text style={{ fontSize: 44 }}>🫣</Text>
              <Text style={{ color: '#FF2E88', fontSize: 20, fontWeight: '900', marginTop: 6, letterSpacing: 1 }}>استغماية بمنظور أول شخص</Text>
              <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 21, maxWidth: 320 }}>
                إنت واقف في قلب الحارة القديمة 🌆{'\n'}اسحب بصباعك علشان تبص حواليك، واتحرّك بالأزرار تحت (أو WASD).{'\n'}العيال متخبّيين في الطرقة — لفّ ولاقيهم كلهم قبل ما الوقت يخلص.
              </Text>
              <Pressable onPress={() => { tapLight(); setBoard('loading'); fetchLeaderboard('sekoseko').then(setBoard).catch(() => setBoard([])); }} style={{ marginTop: 16 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>🏆 الترتيب العالمي</Text>
                </View>
              </Pressable>
              <Pressable onPress={start} style={{ marginTop: 18 }}>
                <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 44, paddingVertical: 15 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>يلا نلعب ▶</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* WON / LOST */}
          {phase === 'won' || phase === 'lost' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,14,46,0.86)', padding: 26 }}>
              <Text style={{ fontSize: 50 }}>{phase === 'won' ? '🏆' : '⏱️'}</Text>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>{phase === 'won' ? 'لقيتهم كلهم! 🎉' : 'الوقت خلص!'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 }}>لقيت {foundCount} من {total}</Text>
              <Pressable onPress={start} style={{ marginTop: 22 }}>
                <View style={{ backgroundColor: '#FF2E88', borderRadius: 999, paddingHorizontal: 38, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="refresh" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>تاني</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); onClose(); }} style={{ marginTop: 14 }}><Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' }}>خروج</Text></Pressable>
            </View>
          ) : null}

          {/* LEADERBOARD */}
          {board != null ? (
            <Pressable onPress={() => setBoard(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(22,14,46,0.94)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
              <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: 16, maxHeight: '80%' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>🏆 الترتيب العالمي</Text>
                {board === 'loading' ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>…</Text>
                ) : board.length === 0 ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>مفيش نتايج لسه — كن أول واحد!</Text>
                ) : (
                  <ScrollView>
                    {board.map((r, i) => (
                      <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < board.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                        <Text style={{ color: i === 0 ? C.gold : i < 3 ? '#FFF' : 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '900', width: 34 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</Text>
                        {r.avatar ? <Image source={{ uri: r.avatar }} style={{ width: 30, height: 30, borderRadius: 15, marginRight: 9 }} /> : <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', marginRight: 9 }} />}
                        <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700', flex: 1 }} numberOfLines={1}>{r.flag ? r.flag + ' ' : ''}{r.name}</Text>
                        <Text style={{ color: C.gold, fontSize: 14, fontWeight: '900' }}>{r.score}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
                <Pressable onPress={() => setBoard(null)} style={{ marginTop: 12, alignSelf: 'center' }}><Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' }}>إغلاق</Text></Pressable>
              </Pressable>
            </Pressable>
          ) : null}
        </View>

        {/* movement pad */}
        {phase === 'playing' ? (
          <View style={{ paddingVertical: 14, paddingBottom: 26, alignItems: 'center' }}>
            <Pressable {...padBtn('f', 1)}><View style={padStyle}><Ionicons name="chevron-up" size={26} color="#FFF" /></View></Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable {...padBtn('s', -1)}><View style={padStyle}><Ionicons name="chevron-back" size={26} color="#FFF" /></View></Pressable>
              <View style={{ width: 58 }} />
              <Pressable {...padBtn('s', 1)}><View style={padStyle}><Ionicons name="chevron-forward" size={26} color="#FFF" /></View></Pressable>
            </View>
            <Pressable {...padBtn('f', -1)}><View style={padStyle}><Ionicons name="chevron-down" size={26} color="#FFF" /></View></Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const padStyle = {
  width: 58, height: 52, margin: 3, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(255,46,136,0.18)', borderWidth: 1, borderColor: 'rgba(255,46,136,0.5)',
};
