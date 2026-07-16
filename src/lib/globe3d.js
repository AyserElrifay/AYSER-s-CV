/* A REAL 3-D Earth (WebGL / three.js) for the zoom-out view — an actual
   sphere with the continents genuinely curving over the horizon, floating
   in starry space with a blue atmosphere rim. Not a flat map clipped into
   a circle: a true globe you can spin. Loaded from CDN the same way we
   load Leaflet, so nothing is bundled. Web only. */

let threePromise = null;
function loadThree() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.THREE) return Promise.resolve(window.THREE);
  if (threePromise) return threePromise;
  threePromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = () => resolve(window.THREE);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return threePromise;
}

const EARTH_TEX = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg';
const BUMP_TEX = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png';

/* Cartoonify the satellite texture in-memory: boost saturation and
   lightness toward Snap's candy palette (mint land, playful blue sea)
   so the planet matches the app's cartoon map instead of NASA colours. */
function cartoonify(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  // saturate + brighten via filter re-draw when supported
  if ('filter' in x) {
    x.filter = 'saturate(1.9) brightness(1.25) contrast(1.05) hue-rotate(-8deg)';
    x.drawImage(c, 0, 0);
  }
  return c;
}

/* mountGlobe3D(container, { onDive }) → { setVisible, resize, destroy }.
   onDive() is called when the user taps the globe (to dive into the flat
   map). The globe auto-rotates and can be dragged to spin. */
export function mountGlobe3D(container, { onDive } = {}) {
  let THREE, renderer, scene, camera, earth, clouds, atmosphere, raf, stars;
  let visible = false, disposed = false;
  let dragging = false, lastX = 0, lastY = 0, velX = 0.0015, velY = 0;
  let moved = 0;

  loadThree().then((T) => {
    if (!T || disposed) return;
    THREE = T;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.set(0, 0, 3.05);

    // lights — a soft "sun" plus fill so the night side isn't pure black
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(-2, 1.2, 2.5);
    scene.add(sun);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    // the planet — Snap-candy colours: the satellite texture is
    // re-painted through cartoonify() so land pops mint-green and the
    // sea goes playful blue, matching the app's cartoon map.
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const mat = new THREE.MeshPhongMaterial({
      map: loader.load(EARTH_TEX, (tex) => {
        try {
          tex.image = cartoonify(tex.image);
          tex.needsUpdate = true;
        } catch (e) { /* CORS-blocked canvas → keep natural colours */ }
      }),
      bumpMap: loader.load(BUMP_TEX),
      bumpScale: 0.012,
      specular: new THREE.Color(0x224466),
      shininess: 12,
    });
    earth = new THREE.Mesh(geo, mat);
    earth.rotation.y = -Math.PI * 0.55; // start roughly on Africa/Europe
    scene.add(earth);

    // atmosphere — a slightly bigger back-side shell with a blue rim glow
    const atmMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: {},
      vertexShader:
        'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} ',
      fragmentShader:
        // soft halo in the PLANET'S own candy colours (aqua-mint), not a ring
        'varying vec3 vN; void main(){ float i = pow(0.66 - dot(vN, vec3(0.0,0.0,1.0)), 4.0); gl_FragColor = vec4(0.36,0.78,0.72,1.0) * i * 0.55; }',
    });
    atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.09, 64, 64), atmMat);
    scene.add(atmosphere);

    // starfield
    const starGeo = new THREE.BufferGeometry();
    const N = 1400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 30 + Math.random() * 30;
      const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      pos[i * 3 + 2] = r * Math.cos(p);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
    scene.add(stars);

    // drag to spin
    const el = renderer.domElement;
    const down = (x, y) => { dragging = true; lastX = x; lastY = y; moved = 0; };
    const move = (x, y) => {
      if (!dragging) return;
      const dx = x - lastX, dy = y - lastY;
      lastX = x; lastY = y; moved += Math.abs(dx) + Math.abs(dy);
      velX = dx * 0.005; velY = dy * 0.005;
      earth.rotation.y += velX; earth.rotation.x += velY;
      earth.rotation.x = Math.max(-1.2, Math.min(1.2, earth.rotation.x));
    };
    const up = () => {
      if (dragging && moved < 6 && onDive) onDive(); // a tap (not a drag) dives in
      dragging = false;
    };
    el.addEventListener('mousedown', (e) => down(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    window.addEventListener('mouseup', up);
    el.addEventListener('touchstart', (e) => down(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    el.addEventListener('touchmove', (e) => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    el.addEventListener('touchend', up);

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      if (!dragging) { earth.rotation.y += 0.0016; velY *= 0.94; earth.rotation.x += velY; }
      stars.rotation.y += 0.0003;
      renderer.render(scene, camera);
    };
    tick();
    applyVisible();
  });

  function applyVisible() {
    if (renderer && renderer.domElement) renderer.domElement.style.opacity = visible ? '1' : '0';
    container.style.pointerEvents = visible ? 'auto' : 'none';
    container.style.opacity = visible ? '1' : '0';
  }

  return {
    setVisible(v) { visible = v; applyVisible(); },
    resize() {
      if (!renderer || !camera) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    },
    destroy() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (renderer) { renderer.dispose(); if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }
    },
  };
}
