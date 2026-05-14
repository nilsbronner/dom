import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

import { makeSkyTexture } from './materials.js';
import { buildGarden, ZONES, GARDEN } from './scene.js';
import { tickWind } from './vegetation.js';

const gsap = window.gsap;

// ---------- LOADER ----------
const loader = document.getElementById('loader');
const loaderBar = loader.querySelector('.loader-bar-fill');
let progress = 0;
function tickLoader(target) {
  progress = target;
  loaderBar.style.width = `${Math.min(100, target)}%`;
}

// ---------- RENDERER ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: window.devicePixelRatio < 2,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

tickLoader(10);

// ---------- SCENE ----------
const scene = new THREE.Scene();
const skyTex = makeSkyTexture();
scene.background = skyTex;
scene.environment = skyTex;
scene.fog = new THREE.FogExp2(0xdcb89a, 0.018);

tickLoader(22);

// ---------- CAMERA ----------
const camera = new THREE.PerspectiveCamera(
  55, window.innerWidth / window.innerHeight, 0.1, 200
);
camera.position.set(7, 7, -7);
camera.lookAt(0, 1, 8);

// ---------- LIGHTS ----------
// Hemisphere — sky + ground ambient
const hemi = new THREE.HemisphereLight(0xdfb98a, 0x3a3624, 0.7);
hemi.position.set(0, 20, 0);
scene.add(hemi);

// Soft fill
const ambient = new THREE.AmbientLight(0xfff0d8, 0.15);
scene.add(ambient);

// Sun — late afternoon warm directional, low angle
const sun = new THREE.DirectionalLight(0xffd9a8, 2.6);
sun.position.set(8, 14, -6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

// Bounce light — cooler from opposite side (simulates sky bounce off walls)
const bounce = new THREE.DirectionalLight(0x8aa3b8, 0.4);
bounce.position.set(-6, 6, 8);
scene.add(bounce);

tickLoader(35);

// ---------- BUILD GARDEN ----------
const garden = buildGarden(scene);
tickLoader(75);

// ---------- CONTROLS ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 1.5;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI / 2 - 0.02; // prevent going below ground
controls.target.set(0, 1, 8);

// ---------- POSTPROCESSING ----------
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.35, // strength
  0.85, // radius
  0.85  // threshold
);
composer.addPass(bloom);
const smaa = new SMAAPass(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());
composer.addPass(smaa);
composer.addPass(new OutputPass());

tickLoader(88);

// ---------- CAMERA MODES ----------
const VIEWS = {
  orbit: {
    position: new THREE.Vector3(7, 7, -2),
    target: new THREE.Vector3(0, 1, 8),
    polar: null,
  },
  aerial: {
    position: new THREE.Vector3(0.01, 22, 8),
    target: new THREE.Vector3(0, 0, 8),
  },
  human: {
    position: new THREE.Vector3(0, 1.65, -1),
    target: new THREE.Vector3(0, 1.5, 8),
  },
};
let currentMode = 'orbit';

function flyTo(position, target, duration = 1.6) {
  controls.enabled = false;
  gsap.to(camera.position, {
    x: position.x, y: position.y, z: position.z,
    duration, ease: 'power3.inOut',
    onUpdate: () => camera.updateProjectionMatrix(),
  });
  gsap.to(controls.target, {
    x: target.x, y: target.y, z: target.z,
    duration, ease: 'power3.inOut',
    onComplete: () => { controls.enabled = true; },
  });
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn[data-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  const v = VIEWS[mode];
  if (v) flyTo(v.position, v.target, 1.4);
}

document.querySelectorAll('.mode-btn[data-mode]').forEach((b) => {
  b.addEventListener('click', () => setMode(b.dataset.mode));
});

// ---------- ZONE NAVIGATION ----------
const zoneInfo = document.getElementById('zone-info');
const ziTitle = zoneInfo.querySelector('.zi-title');
const ziDesc = zoneInfo.querySelector('.zi-desc');
let zoneInfoTimer = null;

function showZoneInfo(zone) {
  ziTitle.textContent = zone.name;
  ziDesc.textContent = zone.desc;
  zoneInfo.classList.add('show');
  if (zoneInfoTimer) clearTimeout(zoneInfoTimer);
  zoneInfoTimer = setTimeout(() => zoneInfo.classList.remove('show'), 5200);
}

function focusZone(key) {
  const zone = ZONES[key];
  if (!zone) return;
  const target = zone.pos;
  // place camera at a pleasant offset
  const offset = new THREE.Vector3(2.8, 2.2, -2.6);
  // for zones deep in the garden, approach from the same side
  if (target.z > 10) offset.z = -2.6;
  const camPos = target.clone().add(offset);
  flyTo(camPos, target, 1.6);
  showZoneInfo(zone);

  // active state in side panel
  document.querySelectorAll('#zones-panel li').forEach((li) => {
    li.classList.toggle('active', li.dataset.zone === key);
  });
}

document.querySelectorAll('#zones-panel li').forEach((li) => {
  li.addEventListener('click', () => focusZone(li.dataset.zone));
});

// ---------- AMBIENT AUDIO (synthesized — no external assets) ----------
let audioCtx = null;
let audioOn = false;
let audioNodes = null;

function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const master = audioCtx.createGain();
  master.gain.value = 0;
  master.connect(audioCtx.destination);
  gsap.to(master.gain, { value: 0.22, duration: 1.5 });

  // wind: filtered brown noise
  const bufferSize = 2 * audioCtx.sampleRate;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const out = noiseBuffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    out[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = out[i];
    out[i] *= 3.5;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 480;
  noiseFilter.Q.value = 0.7;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.5;

  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start();

  // modulate wind LFO
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 200;
  lfo.connect(lfoGain).connect(noiseFilter.frequency);
  lfo.start();

  // gentle bird chirps — sparse triangle blips
  function scheduleBird() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime + 0.5 + Math.random() * 5;
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    const base = 1800 + Math.random() * 1800;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.4, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.18);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.3);
    setTimeout(scheduleBird, 2500 + Math.random() * 6000);
  }
  scheduleBird();

  audioNodes = { master, noise, lfo };
}

function stopAudio() {
  if (!audioCtx) return;
  gsap.to(audioNodes.master.gain, {
    value: 0, duration: 0.6,
    onComplete: () => {
      audioCtx.close();
      audioCtx = null;
      audioNodes = null;
    },
  });
}

const audioBtn = document.getElementById('audio-toggle');
audioBtn.addEventListener('click', () => {
  audioOn = !audioOn;
  audioBtn.classList.toggle('active', audioOn);
  if (audioOn) startAudio(); else stopAudio();
});

// ---------- RESIZE ----------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------- ANIMATION LOOP ----------
const clock = new THREE.Clock();
let frame = 0;

function animate() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // wind anim on vegetation shaders
  tickWind(t);

  // animate water surface (subtle bob)
  for (const a of garden.userData.animatables) {
    if (a.userData.isWater) {
      a.position.y = a.userData.baseY + Math.sin(t * 1.8) * 0.005;
      a.rotation.z = Math.sin(t * 0.4) * 0.005;
    }
  }

  controls.update();
  composer.render();
  frame++;
  requestAnimationFrame(animate);
}

// ---------- KICKOFF ----------
function start() {
  tickLoader(100);
  setTimeout(() => {
    loader.classList.add('hidden');
    // intro camera move
    flyTo(new THREE.Vector3(6, 5.5, -1.5), new THREE.Vector3(0, 1, 8), 2.4);
  }, 300);
  animate();
}

// Defer slightly so the browser can render the loader frame
requestAnimationFrame(() => requestAnimationFrame(start));
