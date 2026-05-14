// Procedural materials — generated on canvas, no external assets needed.
// Goal: realistic-feeling PBR materials for an urban garden scene.

import * as THREE from 'three';

const TEX_CACHE = new Map();

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function noise(ctx, w, h, amount = 0.18) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function toTexture(canvas, repeatX = 1, repeatY = 1, anisotropy = 8) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---------- BRICK ----------
function makeBrickTexture() {
  if (TEX_CACHE.has('brick')) return TEX_CACHE.get('brick');
  const size = 1024;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');

  // mortar base
  ctx.fillStyle = '#3a3128';
  ctx.fillRect(0, 0, size, size);

  const brickW = 128;
  const brickH = 44;
  const gap = 4;
  const rows = Math.ceil(size / (brickH + gap));

  for (let r = 0; r < rows; r++) {
    const y = r * (brickH + gap);
    const offset = (r % 2) * (brickW / 2);
    for (let x = -brickW; x < size + brickW; x += brickW + gap) {
      const bx = x + offset;
      // varied old brick palette
      const palette = [
        '#7a3d2a', '#8a4a35', '#6f3322', '#9a5640', '#5e2a1c',
        '#864535', '#7f3b2b', '#a05a44', '#6a3020', '#90503a',
      ];
      const base = palette[Math.floor(Math.random() * palette.length)];
      ctx.fillStyle = base;
      ctx.fillRect(bx, y, brickW, brickH);

      // brick texture: streaks and patches
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#000';
      for (let k = 0; k < 6; k++) {
        const sx = bx + Math.random() * brickW;
        const sy = y + Math.random() * brickH;
        const sw = 2 + Math.random() * 18;
        const sh = 1 + Math.random() * 3;
        ctx.fillRect(sx, sy, sw, sh);
      }
      // weathering
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#d8c8a8';
      for (let k = 0; k < 3; k++) {
        const sx = bx + Math.random() * brickW;
        const sy = y + Math.random() * brickH;
        ctx.beginPath();
        ctx.arc(sx, sy, 2 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // chip on edge sometimes
      if (Math.random() < 0.08) {
        ctx.fillStyle = '#3a3128';
        ctx.beginPath();
        ctx.arc(bx + Math.random() * brickW, y + (Math.random() < 0.5 ? 0 : brickH),
          3 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // moss patches near bottom
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * size;
    const y = size * (0.55 + Math.random() * 0.45);
    ctx.globalAlpha = 0.2 + Math.random() * 0.25;
    ctx.fillStyle = ['#4f6b2f', '#6a8a3f', '#3a4a22'][Math.floor(Math.random() * 3)];
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + Math.random() * 30, 8 + Math.random() * 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  noise(ctx, size, size, 0.08);

  const tex = toTexture(c, 1, 1);
  TEX_CACHE.set('brick', tex);
  return tex;
}

// Brick normal — emboss bricks by drawing dark/light at brick boundaries
function makeBrickNormal() {
  if (TEX_CACHE.has('brick-n')) return TEX_CACHE.get('brick-n');
  const size = 1024;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, size, size);

  const brickW = 128, brickH = 44, gap = 4;
  const rows = Math.ceil(size / (brickH + gap));
  ctx.lineWidth = gap;
  for (let r = 0; r < rows; r++) {
    const y = r * (brickH + gap) - gap / 2;
    // horizontal grooves (darker = recessed)
    ctx.strokeStyle = '#6060c0';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();

    const offset = (r % 2) * (brickW / 2);
    for (let x = -brickW; x < size + brickW; x += brickW + gap) {
      const bx = x + offset - gap / 2;
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.lineTo(bx, y + brickH + gap);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.set('brick-n', tex);
  return tex;
}

export function brickMaterial(repeatX = 4, repeatY = 2) {
  const map = makeBrickTexture().clone();
  map.repeat.set(repeatX, repeatY);
  map.needsUpdate = true;
  const normal = makeBrickNormal().clone();
  normal.repeat.set(repeatX, repeatY);
  normal.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    normalMap: normal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.92,
    metalness: 0.0,
  });
}

// ---------- WOOD ----------
function makeWoodTexture(tone = 'warm') {
  const key = `wood-${tone}`;
  if (TEX_CACHE.has(key)) return TEX_CACHE.get(key);
  const w = 512, h = 1024;
  const c = makeCanvas(w);
  c.height = h;
  const ctx = c.getContext('2d');

  const palettes = {
    warm: ['#6b4a2c', '#7a5634', '#8c6840', '#5d3f25', '#9d7948'],
    aged: ['#4a3a2a', '#5a4a36', '#3a2e22', '#6a5740', '#4e3f2e'],
    light: ['#a78657', '#b89466', '#c2a378', '#917551', '#d4b48a'],
  };
  const pal = palettes[tone] || palettes.warm;

  // base
  ctx.fillStyle = pal[1];
  ctx.fillRect(0, 0, w, h);

  // grain lines
  for (let i = 0; i < 220; i++) {
    const y = Math.random() * h;
    const len = 100 + Math.random() * (w - 100);
    const x = Math.random() * (w - len);
    ctx.globalAlpha = 0.04 + Math.random() * 0.16;
    ctx.strokeStyle = pal[Math.floor(Math.random() * pal.length)];
    ctx.lineWidth = 0.5 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    // wavy line
    let cx = x;
    while (cx < x + len) {
      cx += 10;
      ctx.lineTo(cx, y + Math.sin(cx * 0.05) * (1 + Math.random() * 2));
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // knots
  const knots = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < knots; i++) {
    const kx = Math.random() * w;
    const ky = Math.random() * h;
    const kr = 8 + Math.random() * 16;
    const grad = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr);
    grad.addColorStop(0, '#2a1c10');
    grad.addColorStop(0.4, pal[0]);
    grad.addColorStop(1, pal[1]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr, kr * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // plank separators (horizontal)
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const plankH = h / 4;
  for (let i = 1; i < 4; i++) {
    ctx.fillRect(0, i * plankH - 1, w, 2);
  }

  noise(ctx, w, h, 0.06);
  const tex = toTexture(c, 1, 1);
  TEX_CACHE.set(key, tex);
  return tex;
}

export function woodMaterial(tone = 'warm', repeatX = 1, repeatY = 1) {
  const map = makeWoodTexture(tone).clone();
  map.repeat.set(repeatX, repeatY);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.85,
    metalness: 0.02,
  });
}

// ---------- GRAVEL ----------
function makeGravelTexture() {
  if (TEX_CACHE.has('gravel')) return TEX_CACHE.get('gravel');
  const size = 1024;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#d8d0bf';
  ctx.fillRect(0, 0, size, size);

  // pebbles
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 8;
    const shade = 180 + Math.random() * 70;
    const tint = Math.random();
    let col;
    if (tint < 0.7) col = `rgb(${shade}, ${shade - 10}, ${shade - 25})`;
    else if (tint < 0.9) col = `rgb(${shade - 30}, ${shade - 25}, ${shade - 40})`;
    else col = `rgb(${shade - 60}, ${shade - 55}, ${shade - 70})`;

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.7 + Math.random() * 0.3), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();

    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.4, y + r * 0.4, r * 0.5, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  noise(ctx, size, size, 0.05);

  const tex = toTexture(c, 1, 1);
  TEX_CACHE.set('gravel', tex);
  return tex;
}

export function gravelMaterial(repeat = 8) {
  const map = makeGravelTexture().clone();
  map.repeat.set(repeat, repeat);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.95,
    metalness: 0,
  });
}

// ---------- SOIL / EARTH ----------
function makeSoilTexture() {
  if (TEX_CACHE.has('soil')) return TEX_CACHE.get('soil');
  const size = 1024;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(0, 0, size, size);

  // earth clumps
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 14;
    const t = Math.random();
    let col;
    if (t < 0.4) col = `rgb(${50 + Math.random() * 30}, ${36 + Math.random() * 24}, ${22 + Math.random() * 18})`;
    else if (t < 0.75) col = `rgb(${80 + Math.random() * 30}, ${60 + Math.random() * 20}, ${36 + Math.random() * 18})`;
    else col = `rgb(${25 + Math.random() * 20}, ${18 + Math.random() * 14}, ${10 + Math.random() * 10})`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // organic debris
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgb(${60 + Math.random() * 40}, ${50 + Math.random() * 30}, ${30 + Math.random() * 20})`;
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1 + Math.random() * 8, 1 + Math.random() * 2);
  }
  noise(ctx, size, size, 0.08);

  const tex = toTexture(c, 1, 1);
  TEX_CACHE.set('soil', tex);
  return tex;
}

export function soilMaterial(repeat = 4) {
  const map = makeSoilTexture().clone();
  map.repeat.set(repeat, repeat);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.98,
    metalness: 0,
  });
}

// ---------- CLOVER / GROUND COVER ----------
function makeCloverTexture() {
  if (TEX_CACHE.has('clover')) return TEX_CACHE.get('clover');
  const size = 1024;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');

  // moist soil base
  ctx.fillStyle = '#2c3a1c';
  ctx.fillRect(0, 0, size, size);

  // clover leaves — three small lobes each
  for (let i = 0; i < 900; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 6 + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;
    const greens = ['#5a7d2f', '#6b8f38', '#4d6b28', '#7ba042', '#3f5520', '#82a84a'];
    const col = greens[Math.floor(Math.random() * greens.length)];
    ctx.fillStyle = col;
    for (let k = 0; k < 3; k++) {
      const a = angle + (k * Math.PI * 2) / 3;
      const lx = cx + Math.cos(a) * r * 0.55;
      const ly = cy + Math.sin(a) * r * 0.55;
      ctx.beginPath();
      ctx.ellipse(lx, ly, r * 0.55, r * 0.45, a, 0, Math.PI * 2);
      ctx.fill();
    }
    // vein highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // small flowers
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = ['#e8d8c0', '#f4e8d0', '#d8b890'][Math.floor(Math.random() * 3)];
    ctx.beginPath();
    ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = toTexture(c, 1, 1);
  TEX_CACHE.set('clover', tex);
  return tex;
}

export function cloverMaterial(repeat = 4) {
  const map = makeCloverTexture().clone();
  map.repeat.set(repeat, repeat);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.88,
    metalness: 0,
  });
}

// ---------- CONCRETE / WALL CAP ----------
export function concreteMaterial() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9a958a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = `rgba(${Math.random() * 60 + 100}, ${Math.random() * 60 + 95}, ${Math.random() * 60 + 90}, 0.4)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  noise(ctx, size, size, 0.15);
  const tex = toTexture(c, 4, 1);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
}

// ---------- CORRUGATED METAL ROOF ----------
export function corrugatedMetalMaterial() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  // base
  ctx.fillStyle = '#dcd5c4';
  ctx.fillRect(0, 0, size, size);
  // corrugation gradient stripes
  const wave = 32;
  for (let x = 0; x < size; x += wave) {
    const grad = ctx.createLinearGradient(x, 0, x + wave, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.35)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, wave, size);
  }
  // rust streaks
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.08 + Math.random() * 0.18;
    ctx.fillStyle = ['#7a3a20', '#5a2a14', '#6b4a2c'][Math.floor(Math.random() * 3)];
    const x = Math.random() * size;
    ctx.fillRect(x, Math.random() * size, 1 + Math.random() * 3, 30 + Math.random() * 200);
  }
  ctx.globalAlpha = 1;
  noise(ctx, size, size, 0.1);
  const tex = toTexture(c, 3, 2);
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.55,
    metalness: 0.6,
  });
}

// ---------- WATER (jacuzzi) ----------
export function waterMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x4a90a8,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.55,
    thickness: 0.4,
    transparent: true,
    opacity: 0.85,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
}

// ---------- INFLATABLE SPA WALL ----------
export function spaWallMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x8a7355,
    roughness: 0.78,
    metalness: 0.0,
  });
}

// ---------- BBQ METAL ----------
export function bbqMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.42,
    metalness: 0.85,
  });
}

// ---------- LEAF (sprite-like billboard) ----------
export function makeLeafTexture(variant = 0) {
  const key = `leaf-${variant}`;
  if (TEX_CACHE.has(key)) return TEX_CACHE.get(key);
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const greens = [
    ['#3f5520', '#6b8f38', '#a3c25c'],
    ['#4d6b28', '#7ba042', '#b8d272'],
    ['#5a7d2f', '#82a84a', '#c8dd84'],
    ['#3a4a22', '#5e7a30', '#92b558'],
  ];
  const pal = greens[variant % greens.length];

  // leaf shape (pointed oval)
  ctx.save();
  ctx.translate(cx, cy);
  const grad = ctx.createRadialGradient(0, -20, 5, 0, 0, 110);
  grad.addColorStop(0, pal[2]);
  grad.addColorStop(0.5, pal[1]);
  grad.addColorStop(1, pal[0]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -100);
  ctx.bezierCurveTo(60, -80, 70, 60, 0, 100);
  ctx.bezierCurveTo(-70, 60, -60, -80, 0, -100);
  ctx.fill();

  // central vein
  ctx.strokeStyle = pal[0];
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -90);
  ctx.lineTo(0, 90);
  ctx.stroke();

  // side veins
  ctx.lineWidth = 1.2;
  for (let i = -3; i <= 3; i++) {
    const y = i * 22;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(40, y + 22);
    ctx.moveTo(0, y);
    ctx.lineTo(-40, y + 22);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  TEX_CACHE.set(key, tex);
  return tex;
}

// ---------- SKY ----------
export function makeSkyTexture() {
  const w = 2048, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // Late afternoon golden hour gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a2e4a');     // upper sky
  grad.addColorStop(0.35, '#4a6582');  // mid sky
  grad.addColorStop(0.55, '#c08868');  // golden band
  grad.addColorStop(0.75, '#e2b585');  // warm glow
  grad.addColorStop(1, '#fdd9a8');     // horizon
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // soft warm clouds
  for (let i = 0; i < 30; i++) {
    const cx = Math.random() * w;
    const cy = h * (0.05 + Math.random() * 0.35);
    const cr = 60 + Math.random() * 180;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    cg.addColorStop(0, 'rgba(255, 220, 190, 0.45)');
    cg.addColorStop(0.5, 'rgba(255, 200, 165, 0.18)');
    cg.addColorStop(1, 'rgba(255, 200, 165, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cr * 1.5, cr * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
