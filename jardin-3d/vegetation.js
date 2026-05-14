// Procedural vegetation — plants built from primitives + instancing for performance.
// All plants expose an animate(time) hook for wind sway.

import * as THREE from 'three';
import { makeLeafTexture } from './materials.js';

// Shared leaf material with a vertex-shader wind sway based on world position.
// We use onBeforeCompile to inject the sway into MeshStandardMaterial.
function makeFoliageMaterial(color = 0x6b8f38, leafTex = null, alphaTest = 0.5) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: leafTex,
    side: THREE.DoubleSide,
    alphaTest,
    transparent: !!leafTex,
    roughness: 0.85,
    metalness: 0,
  });
  mat.userData.windTime = { value: 0 };
  mat.userData.windStrength = { value: 0.06 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = mat.userData.windTime;
    shader.uniforms.windStrength = mat.userData.windStrength;
    shader.vertexShader =
      `uniform float windTime;\nuniform float windStrength;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
        // World-space sway, stronger at the top of the plant
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        float heightFactor = max(0.0, transformed.y) * 0.4 + 0.1;
        float sway = sin(windTime * 1.3 + wp.x * 0.6 + wp.z * 0.5) * windStrength * heightFactor;
        float sway2 = cos(windTime * 0.9 + wp.z * 0.7) * windStrength * 0.6 * heightFactor;
        transformed.x += sway;
        transformed.z += sway2;
      `
    );
  };
  return mat;
}

const MATS = {};
function getFoliage(variant) {
  const key = `foliage-${variant}`;
  if (MATS[key]) return MATS[key];
  const tex = makeLeafTexture(variant);
  const colors = [0xa3c25c, 0xb8d272, 0xc8dd84, 0x92b558];
  MATS[key] = makeFoliageMaterial(colors[variant % colors.length], tex, 0.45);
  return MATS[key];
}

function getSolidFoliage(color = 0x6b8f38) {
  const key = `solid-${color}`;
  if (MATS[key]) return MATS[key];
  MATS[key] = makeFoliageMaterial(color, null, 0);
  return MATS[key];
}

const BARK_MAT = new THREE.MeshStandardMaterial({
  color: 0x3a2a1c,
  roughness: 0.95,
  metalness: 0,
});
const STAKE_MAT = new THREE.MeshStandardMaterial({
  color: 0x6b4a2c,
  roughness: 0.9,
});

// Update all foliage wind uniforms
const ALL_FOLIAGE_MATS = new Set();
export function tickWind(t) {
  for (const k in MATS) {
    const m = MATS[k];
    if (m.userData.windTime) m.userData.windTime.value = t;
  }
  for (const m of ALL_FOLIAGE_MATS) {
    if (m.userData.windTime) m.userData.windTime.value = t;
  }
}

// ------------- LEAF CLUSTER (billboarded crossed quads) -------------
function leafCluster(scale = 1, variant = 0) {
  const group = new THREE.Group();
  const mat = getFoliage(variant);
  const geo = new THREE.PlaneGeometry(0.5, 0.55);
  // 3 crossed planes form a denser cluster from any angle
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.y = (i / 3) * Math.PI;
    m.rotation.x = (Math.random() - 0.5) * 0.3;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  group.scale.setScalar(scale);
  return group;
}

// ------------- SHRUB -------------
export function makeShrub(scale = 1, variant = 0) {
  const g = new THREE.Group();
  const leafCount = 18 + Math.floor(Math.random() * 14);
  const radius = 0.5 * scale;
  for (let i = 0; i < leafCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.6;
    const r = radius * (0.6 + Math.random() * 0.5);
    const c = leafCluster(0.7 + Math.random() * 0.5, variant);
    c.position.set(
      Math.sin(theta) * Math.cos(phi) * r,
      Math.cos(phi) * r * 0.9 + 0.1,
      Math.sin(theta) * Math.sin(phi) * r
    );
    c.rotation.y = Math.random() * Math.PI * 2;
    g.add(c);
  }
  // small stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025 * scale, 0.04 * scale, 0.25 * scale, 6),
    BARK_MAT
  );
  stem.position.y = 0.12 * scale;
  stem.castShadow = true;
  g.add(stem);
  return g;
}

// ------------- FERN -------------
export function makeFern(scale = 1) {
  const g = new THREE.Group();
  const frondCount = 7 + Math.floor(Math.random() * 5);
  const mat = getFoliage(2);
  for (let i = 0; i < frondCount; i++) {
    const frond = new THREE.Group();
    // central rachis
    const segCount = 8;
    for (let s = 0; s < segCount; s++) {
      const segY = (s / segCount) * 0.7 * scale;
      const sideScale = (1 - s / segCount) * 0.9 + 0.1;
      for (const side of [-1, 1]) {
        const leaflet = new THREE.Mesh(new THREE.PlaneGeometry(0.18 * sideScale, 0.07), mat);
        leaflet.position.set(side * 0.07 * sideScale, segY, 0);
        leaflet.rotation.y = side * Math.PI / 2;
        leaflet.rotation.z = side * 0.3;
        leaflet.castShadow = true;
        frond.add(leaflet);
      }
    }
    frond.rotation.y = (i / frondCount) * Math.PI * 2;
    frond.rotation.z = -0.45 - Math.random() * 0.3;
    frond.position.y = 0.04;
    g.add(frond);
  }
  return g;
}

// ------------- TOMATO PLANT -------------
const TOMATO_MAT = new THREE.MeshStandardMaterial({
  color: 0xc23a26,
  roughness: 0.55,
  metalness: 0,
});

export function makeTomatoPlant(scale = 1) {
  const g = new THREE.Group();
  // stake
  const stake = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1.4 * scale, 8),
    STAKE_MAT
  );
  stake.position.y = 0.7 * scale;
  stake.castShadow = true;
  g.add(stake);

  // main stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 1.1 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0x4f6b2f, roughness: 0.85 })
  );
  stem.position.y = 0.55 * scale;
  g.add(stem);

  // foliage clumps
  const mat = getFoliage(0);
  const clumps = 14;
  for (let i = 0; i < clumps; i++) {
    const y = 0.15 + (i / clumps) * 1.0 * scale;
    const angle = (i * 0.7);
    const r = 0.22 + Math.random() * 0.15;
    const c = leafCluster(0.45 + Math.random() * 0.3, 0);
    c.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
    g.add(c);
  }

  // tomatoes
  const tomatoes = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < tomatoes; i++) {
    const t = new THREE.Mesh(
      new THREE.SphereGeometry(0.045 + Math.random() * 0.025, 10, 8),
      TOMATO_MAT
    );
    const angle = Math.random() * Math.PI * 2;
    const r = 0.18 + Math.random() * 0.1;
    t.position.set(
      Math.cos(angle) * r,
      0.3 + Math.random() * 0.7 * scale,
      Math.sin(angle) * r
    );
    t.castShadow = true;
    g.add(t);
  }

  return g;
}

// ------------- LETTUCE -------------
export function makeLettuce(scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9bbd4a,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  mat.userData.windTime = { value: 0 };
  mat.userData.windStrength = { value: 0.02 };
  ALL_FOLIAGE_MATS.add(mat);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = mat.userData.windTime;
    shader.uniforms.windStrength = mat.userData.windStrength;
    shader.vertexShader = `uniform float windTime; uniform float windStrength;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        transformed.x += sin(windTime * 1.4 + wp.x * 2.0) * windStrength * max(0.0, transformed.y);
      `
    );
  };
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const r = (0.16 - i * 0.022) * scale;
    const segs = 8 + i;
    for (let s = 0; s < segs; s++) {
      const angle = (s / segs) * Math.PI * 2 + i * 0.4;
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.6, r * 1.4), mat);
      leaf.position.set(Math.cos(angle) * r * 0.4, 0.04 + i * 0.025, Math.sin(angle) * r * 0.4);
      leaf.rotation.y = angle + Math.PI / 2;
      leaf.rotation.x = -0.7 + i * 0.12;
      leaf.castShadow = true;
      g.add(leaf);
    }
  }
  return g;
}

// ------------- RED CABBAGE -------------
export function makeRedCabbage(scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6e3d6b,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  mat.userData.windTime = { value: 0 };
  mat.userData.windStrength = { value: 0.015 };
  ALL_FOLIAGE_MATS.add(mat);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = mat.userData.windTime;
    shader.uniforms.windStrength = mat.userData.windStrength;
    shader.vertexShader = `uniform float windTime; uniform float windStrength;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        transformed.x += sin(windTime + wp.x) * windStrength;
      `
    );
  };
  // outer leaves
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.32 * scale, 0.28 * scale), mat);
    leaf.position.set(Math.cos(angle) * 0.08, 0.04, Math.sin(angle) * 0.08);
    leaf.rotation.y = angle + Math.PI / 2;
    leaf.rotation.x = -0.5;
    leaf.castShadow = true;
    g.add(leaf);
  }
  // tight head core
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14 * scale, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x5a2a55, roughness: 0.55 })
  );
  head.position.y = 0.13 * scale;
  head.scale.y = 0.85;
  head.castShadow = true;
  g.add(head);
  return g;
}

// ------------- HERB TUFT (basil/parsley/thyme) -------------
export function makeHerb(color = 0x5a8a3a, scale = 1) {
  const g = new THREE.Group();
  const mat = getSolidFoliage(color);
  const blades = 18 + Math.floor(Math.random() * 10);
  for (let i = 0; i < blades; i++) {
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.16 * scale), mat);
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.08;
    blade.position.set(Math.cos(angle) * r, 0.08 * scale, Math.sin(angle) * r);
    blade.rotation.y = Math.random() * Math.PI;
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    blade.castShadow = true;
    g.add(blade);
  }
  return g;
}

// ------------- GRASS PATCH (instanced billboard tufts) -------------
export function makeGrassPatch(count = 200, radius = 1.5, color = 0x6e9540) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.4,
  });
  mat.userData.windTime = { value: 0 };
  mat.userData.windStrength = { value: 0.08 };
  ALL_FOLIAGE_MATS.add(mat);

  // make a small blade gradient texture for the tips
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.2, 'rgba(200, 220, 140, 1)');
  grad.addColorStop(1, 'rgba(80, 110, 50, 1)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(28, 64);
  ctx.lineTo(4, 64);
  ctx.closePath();
  ctx.fill();
  const bladeTex = new THREE.CanvasTexture(c);
  bladeTex.colorSpace = THREE.SRGBColorSpace;
  mat.map = bladeTex;
  mat.needsUpdate = true;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = mat.userData.windTime;
    shader.uniforms.windStrength = mat.userData.windStrength;
    shader.vertexShader = `uniform float windTime; uniform float windStrength;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
        vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        float h = max(0.0, transformed.y);
        transformed.x += sin(windTime * 1.6 + wp.x * 0.8 + wp.z * 0.7) * windStrength * h;
        transformed.z += cos(windTime * 1.2 + wp.z * 0.9) * windStrength * 0.5 * h;
      `
    );
  };

  const geo = new THREE.PlaneGeometry(0.08, 0.22);
  geo.translate(0, 0.11, 0);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    dummy.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.setScalar(0.7 + Math.random() * 0.7);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

// ------------- IVY / CLIMBING VINE ON WALLS -------------
export function makeIvyPatch(width = 2, height = 1.8, density = 80) {
  const g = new THREE.Group();
  const mat = getFoliage(1);
  for (let i = 0; i < density; i++) {
    const c = leafCluster(0.3 + Math.random() * 0.3, 1);
    c.position.set(
      (Math.random() - 0.5) * width,
      Math.random() * height,
      (Math.random() - 0.5) * 0.25
    );
    c.rotation.y = Math.random() * Math.PI * 2;
    g.add(c);
  }
  return g;
}

// ------------- SMALL TREE / TALL SHRUB -------------
export function makeTallShrub(height = 2.2, variant = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, height * 0.4, 8),
    BARK_MAT
  );
  trunk.position.y = height * 0.2;
  trunk.castShadow = true;
  g.add(trunk);

  // foliage volume
  const foliageCount = 35;
  for (let i = 0; i < foliageCount; i++) {
    const c = leafCluster(0.6 + Math.random() * 0.5, variant);
    const angle = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.7;
    const r = (height * 0.32) * (0.5 + Math.random() * 0.6);
    c.position.set(
      Math.sin(phi) * Math.cos(angle) * r,
      height * 0.45 + Math.cos(phi) * r * 0.9,
      Math.sin(phi) * Math.sin(angle) * r
    );
    c.rotation.y = Math.random() * Math.PI * 2;
    g.add(c);
  }
  return g;
}

// ------------- FLOWER (red rose accent) -------------
export function makeRose(scale = 1) {
  const g = new THREE.Group();
  // stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.5 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a5a20, roughness: 0.8 })
  );
  stem.position.y = 0.25 * scale;
  g.add(stem);
  // bloom
  const bloomMat = new THREE.MeshStandardMaterial({ color: 0xa8202a, roughness: 0.45 });
  for (let i = 0; i < 8; i++) {
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.05 * scale, 8, 6),
      bloomMat
    );
    const angle = (i / 8) * Math.PI * 2;
    petal.position.set(Math.cos(angle) * 0.03, 0.5 * scale, Math.sin(angle) * 0.03);
    petal.scale.set(1, 0.6, 1);
    g.add(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.04 * scale, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a0a14 })
  );
  center.position.y = 0.5 * scale;
  g.add(center);
  return g;
}

// ------------- HEUCHERA (purple ground perennial) -------------
export function makeHeuchera(scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6a3a52,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  const leaves = 14;
  for (let i = 0; i < leaves; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.14 * scale, 0.11 * scale), mat);
    const angle = (i / leaves) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 0.04, 0.06 * scale, Math.sin(angle) * 0.04);
    leaf.rotation.y = angle;
    leaf.rotation.x = -0.7;
    g.add(leaf);
  }
  return g;
}
