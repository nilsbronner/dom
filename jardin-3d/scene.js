// Garden scene construction.
// Coordinate system: 1 unit = 1 meter.
// Garden: width 4m (x: -2 to +2), length 20m (z: -2 to +18), wall height 3.5m.
// Z runs from house (z=-2) to back wall (z=18).

import * as THREE from 'three';
import {
  brickMaterial, woodMaterial, gravelMaterial, soilMaterial, cloverMaterial,
  concreteMaterial, corrugatedMetalMaterial, waterMaterial, spaWallMaterial, bbqMaterial,
} from './materials.js';
import {
  makeShrub, makeFern, makeTomatoPlant, makeLettuce, makeRedCabbage,
  makeHerb, makeGrassPatch, makeIvyPatch, makeTallShrub, makeRose, makeHeuchera,
} from './vegetation.js';

export const GARDEN = {
  width: 4,
  length: 20,
  wallHeight: 3.5,
  zMin: -2,
  zMax: 18,
};

// Zone anchors (world coords) — used by camera focus
export const ZONES = {
  terrasse: { name: 'Terrasse centrale', pos: new THREE.Vector3(0, 1.2, -0.2),
    desc: 'Espace détente bois. Fauteuils, table basse, végétation enveloppante.' },
  miombre: { name: 'Mi-ombre', pos: new THREE.Vector3(-1.1, 0.9, 4.5),
    desc: 'Trèfle dense, fougères, heuchères. Ambiance humide et organique.' },
  potager: { name: 'Potager & herbes', pos: new THREE.Vector3(1.1, 1.0, 7.5),
    desc: 'Tomates, laitues, choux rouges, aromatiques en pleine terre.' },
  bbq: { name: 'Barbecue', pos: new THREE.Vector3(1.4, 1.1, 10.5),
    desc: 'Barbecue noir contre le mur droit, intégré dans la végétation.' },
  atelier: { name: 'Atelier / stockage', pos: new THREE.Vector3(-1.3, 1.4, 13.5),
    desc: 'Structure bois récup, toiture ondulée, étagères, compost à gauche.' },
  jacuzzi: { name: 'Jacuzzi spa', pos: new THREE.Vector3(0, 1.3, 16.5),
    desc: 'Spa Intex Sahara, gravier blanc, traverses bois, jungle dense.' },
};

function rand(min, max) { return min + Math.random() * (max - min); }

// ----------- WALLS -----------
function buildWalls() {
  const g = new THREE.Group();
  const brickMat = brickMaterial(6, 1.5);
  const capMat = concreteMaterial();

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, GARDEN.wallHeight, GARDEN.length),
      brickMat
    );
    wall.position.set(side * (GARDEN.width / 2 + 0.125), GARDEN.wallHeight / 2, (GARDEN.zMin + GARDEN.zMax) / 2);
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);

    // wall cap
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.08, GARDEN.length),
      capMat
    );
    cap.position.set(side * (GARDEN.width / 2 + 0.125), GARDEN.wallHeight + 0.04, (GARDEN.zMin + GARDEN.zMax) / 2);
    cap.castShadow = true;
    g.add(cap);

    // ivy patches climbing the wall — every 3m or so
    for (let z = GARDEN.zMin + 1; z < GARDEN.zMax - 1; z += 3.2) {
      const ivy = makeIvyPatch(2.6, GARDEN.wallHeight * 0.9, 70);
      ivy.position.set(side * (GARDEN.width / 2 - 0.15), 0.2, z + rand(-0.6, 0.6));
      ivy.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(ivy);
    }
  }

  // back wall
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(GARDEN.width + 0.5, GARDEN.wallHeight, 0.25),
    brickMat
  );
  back.position.set(0, GARDEN.wallHeight / 2, GARDEN.zMax + 0.125);
  back.receiveShadow = true;
  back.castShadow = true;
  g.add(back);
  const backCap = new THREE.Mesh(new THREE.BoxGeometry(GARDEN.width + 0.6, 0.08, 0.35), capMat);
  backCap.position.set(0, GARDEN.wallHeight + 0.04, GARDEN.zMax + 0.125);
  g.add(backCap);

  // front wall (toward house) — lower, suggesting house facade
  const front = new THREE.Mesh(
    new THREE.BoxGeometry(GARDEN.width + 0.5, GARDEN.wallHeight + 1.5, 0.25),
    brickMat
  );
  front.position.set(0, (GARDEN.wallHeight + 1.5) / 2, GARDEN.zMin - 0.125);
  front.receiveShadow = true;
  g.add(front);

  return g;
}

// ----------- GROUND -----------
function buildGround() {
  const g = new THREE.Group();
  // base soil across full garden
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(GARDEN.width, GARDEN.length, 8, 32),
    soilMaterial(3)
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, 0, (GARDEN.zMin + GARDEN.zMax) / 2);
  base.receiveShadow = true;
  g.add(base);
  return g;
}

// ----------- MAIN PATH (two long planks) -----------
function buildMainPath() {
  const g = new THREE.Group();
  const plankMat = woodMaterial('aged', 1, 8);
  for (const side of [-0.45, 0.45]) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.06, GARDEN.length - 0.5),
      plankMat
    );
    plank.position.set(side, 0.04, (GARDEN.zMin + GARDEN.zMax) / 2);
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
  }
  return g;
}

// ----------- ZONE: TERRASSE CENTRALE -----------
function buildTerrasse() {
  const g = new THREE.Group();
  g.name = 'zone-terrasse';

  // wood deck
  const deckMat = woodMaterial('warm', 2, 3);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 3.2), deckMat);
  deck.position.set(0, 0.05, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  // visible plank seams
  for (let i = 1; i < 6; i++) {
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.105, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 })
    );
    seam.position.set(0, 0.05, -1.6 + (i * 3.2) / 6);
    g.add(seam);
  }

  // two armchairs
  function makeArmchair() {
    const c = new THREE.Group();
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2e, roughness: 0.85 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), cushionMat);
    seat.position.y = 0.32;
    seat.castShadow = true;
    c.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.15), cushionMat);
    back.position.set(0, 0.65, -0.32);
    back.castShadow = true;
    c.add(back);
    // arms
    for (const sx of [-0.4, 0.4]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.6), cushionMat);
      arm.position.set(sx, 0.42, -0.05);
      arm.castShadow = true;
      c.add(arm);
    }
    // frame legs (rattan-ish)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x5a4a36, roughness: 0.85 });
    for (const sx of [-0.32, 0.32]) for (const sz of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), legMat);
      leg.position.set(sx, 0.11, sz);
      c.add(leg);
    }
    return c;
  }
  const chairA = makeArmchair();
  chairA.position.set(-0.85, 0.1, -0.2);
  chairA.rotation.y = 0.35;
  g.add(chairA);
  const chairB = makeArmchair();
  chairB.position.set(0.85, 0.1, -0.2);
  chairB.rotation.y = -0.35;
  g.add(chairB);

  // low coffee table
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.55),
    woodMaterial('warm', 1, 1));
  tableTop.position.set(0, 0.4, 0.55);
  tableTop.castShadow = true;
  g.add(tableTop);
  for (const sx of [-0.38, 0.38]) for (const sz of [0.32, 0.78]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 }));
    leg.position.set(sx, 0.2, sz);
    g.add(leg);
  }
  // plant pot on table
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.07, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b3a26, roughness: 0.85 })
  );
  pot.position.set(0, 0.495, 0.55);
  g.add(pot);
  const potPlant = makeHerb(0x6e9540, 0.7);
  potPlant.position.set(0, 0.56, 0.55);
  g.add(potPlant);

  // surrounding planters with shrubs
  for (const x of [-1.6, 1.6]) {
    for (let z = -1.4; z <= 1.4; z += 0.7) {
      const s = makeShrub(0.5 + Math.random() * 0.3, Math.floor(Math.random() * 4));
      s.position.set(x, 0, z);
      g.add(s);
    }
  }
  // tall accent shrubs at corners
  const t1 = makeTallShrub(1.8, 2);
  t1.position.set(-1.7, 0, -1.7);
  g.add(t1);
  const t2 = makeTallShrub(1.8, 0);
  t2.position.set(1.7, 0, -1.7);
  g.add(t2);

  return g;
}

// ----------- ZONE: MI-OMBRE -----------
function buildMiOmbre() {
  const g = new THREE.Group();
  g.name = 'zone-miombre';

  // clover ground cover (left and right of the path)
  for (const side of [-1, 1]) {
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 3),
      cloverMaterial(3)
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(side * 1.18, 0.01, 4.5);
    patch.receiveShadow = true;
    g.add(patch);
  }
  // ferns clumps
  for (let i = 0; i < 14; i++) {
    const f = makeFern(0.9 + Math.random() * 0.6);
    f.position.set(
      (Math.random() > 0.5 ? 1 : -1) * (0.85 + Math.random() * 0.7),
      0,
      3.2 + Math.random() * 2.8
    );
    f.rotation.y = Math.random() * Math.PI * 2;
    g.add(f);
  }
  // heucheras
  for (let i = 0; i < 10; i++) {
    const h = makeHeuchera(0.9);
    h.position.set(
      (Math.random() > 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.9),
      0,
      3.2 + Math.random() * 2.7
    );
    g.add(h);
  }
  // tall shrub at the back
  const ts = makeTallShrub(2.0, 1);
  ts.position.set(-1.5, 0, 5.8);
  g.add(ts);

  // grass patches between
  for (let i = 0; i < 4; i++) {
    const grass = makeGrassPatch(80, 0.6, 0x5a7a36);
    grass.position.set(
      (Math.random() > 0.5 ? 1 : -1) * 1.1,
      0,
      3.3 + i * 0.7
    );
    g.add(grass);
  }
  return g;
}

// ----------- ZONE: POTAGER -----------
function buildPotager() {
  const g = new THREE.Group();
  g.name = 'zone-potager';

  // raised bed frames left and right
  const frameMat = woodMaterial('aged', 1, 1);
  for (const side of [-1, 1]) {
    // four sides of a 1m x 2.5m bed
    const bedL = 2.6, bedW = 1.0, bedH = 0.18;
    const bedX = side * 1.2;
    const bedZ = 7.5;
    const tex = side > 0 ? frameMat : frameMat;
    // long sides
    const fa = new THREE.Mesh(new THREE.BoxGeometry(0.06, bedH, bedL), tex);
    fa.position.set(bedX - bedW / 2, bedH / 2, bedZ); fa.castShadow = true;
    g.add(fa);
    const fb = new THREE.Mesh(new THREE.BoxGeometry(0.06, bedH, bedL), tex);
    fb.position.set(bedX + bedW / 2, bedH / 2, bedZ); fb.castShadow = true;
    g.add(fb);
    // short sides
    const fc = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedH, 0.06), tex);
    fc.position.set(bedX, bedH / 2, bedZ - bedL / 2); fc.castShadow = true;
    g.add(fc);
    const fd = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedH, 0.06), tex);
    fd.position.set(bedX, bedH / 2, bedZ + bedL / 2); fd.castShadow = true;
    g.add(fd);

    // soil inside bed
    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(bedW - 0.05, 0.16, bedL - 0.05),
      soilMaterial(2)
    );
    soil.position.set(bedX, 0.085, bedZ);
    soil.receiveShadow = true;
    g.add(soil);

    // plant the bed
    if (side === 1) {
      // tomatoes on the right
      for (let i = 0; i < 4; i++) {
        const t = makeTomatoPlant(0.9 + Math.random() * 0.3);
        t.position.set(bedX + (Math.random() - 0.5) * 0.6, 0.16, bedZ - 1.0 + i * 0.7);
        g.add(t);
      }
    } else {
      // mixed lettuce, cabbage, herbs on the left
      const items = [
        { type: 'lettuce', n: 5 },
        { type: 'cabbage', n: 3 },
      ];
      let zCursor = bedZ - 1.0;
      for (const it of items) {
        for (let i = 0; i < it.n; i++) {
          let plant;
          if (it.type === 'lettuce') plant = makeLettuce(1);
          else plant = makeRedCabbage(1);
          plant.position.set(bedX + (Math.random() - 0.5) * 0.55, 0.16, zCursor);
          g.add(plant);
          zCursor += 0.32;
        }
      }
      // herbs at the front edge
      const herbColors = [0x5a8a3a, 0x6b9a44, 0x4a7a30, 0x7aaa58];
      for (let i = 0; i < 5; i++) {
        const h = makeHerb(herbColors[i % herbColors.length], 0.85);
        h.position.set(bedX + 0.35, 0.16, bedZ + 0.95 + i * 0.1);
        g.add(h);
      }
    }
  }

  return g;
}

// ----------- ZONE: BARBECUE -----------
function buildBBQ() {
  const g = new THREE.Group();
  g.name = 'zone-bbq';

  const wallX = GARDEN.width / 2 - 0.15;
  const bbqZ = 10.5;

  // BBQ body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.4, 0.8),
    bbqMaterial()
  );
  body.position.set(wallX - 0.4, 0.95, bbqZ);
  body.castShadow = true;
  g.add(body);
  // lid (rounded top)
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.7, 16, 1, false, 0, Math.PI),
    bbqMaterial()
  );
  lid.rotation.z = Math.PI / 2;
  lid.position.set(wallX - 0.4, 1.18, bbqZ);
  lid.scale.set(1, 1, 1.1);
  lid.castShadow = true;
  g.add(lid);
  // handle
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.9, roughness: 0.3 })
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(wallX - 0.4, 1.55, bbqZ);
  g.add(handle);
  // base / cabinet
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.55, 0.78),
    bbqMaterial()
  );
  base.position.set(wallX - 0.4, 0.45, bbqZ);
  base.castShadow = true;
  g.add(base);
  // wheels
  for (const sz of [-0.3, 0.3]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wallX - 0.05, 0.1, bbqZ + sz);
    g.add(wheel);
  }
  // side table
  const side = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.04, 0.7),
    woodMaterial('warm', 1, 1)
  );
  side.position.set(wallX - 0.95, 1.18, bbqZ);
  side.castShadow = true;
  g.add(side);

  // vegetation around (right wall side)
  for (let i = 0; i < 6; i++) {
    const s = makeShrub(0.5 + Math.random() * 0.3, i % 4);
    s.position.set(wallX - 0.3 + Math.random() * 0.2, 0, bbqZ - 1.5 + Math.random() * 3);
    g.add(s);
  }
  // tall shrub partner
  const tall = makeTallShrub(1.8, 1);
  tall.position.set(wallX - 0.5, 0, bbqZ + 1.6);
  g.add(tall);

  // left side: foliage and flowers
  for (let i = 0; i < 5; i++) {
    const r = makeRose(0.9);
    r.position.set(-1.6 + Math.random() * 0.3, 0, 9.5 + i * 0.6);
    g.add(r);
  }
  return g;
}

// ----------- ZONE: ATELIER / STOCKAGE -----------
function buildAtelier() {
  const g = new THREE.Group();
  g.name = 'zone-atelier';

  const wallX = -GARDEN.width / 2 + 0.15;
  const atZ = 13.5;
  const atW = 1.4;  // depth from wall (x direction)
  const atL = 2.4;  // length along z
  const atH = 2.0;

  // posts
  const postMat = woodMaterial('aged', 1, 1);
  const postR = 0.05;
  const postPositions = [
    [wallX + 0.05, atZ - atL / 2],
    [wallX + 0.05, atZ + atL / 2],
    [wallX + atW, atZ - atL / 2],
    [wallX + atW, atZ + atL / 2],
  ];
  for (const [px, pz] of postPositions) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, atH, 0.08), postMat);
    post.position.set(px, atH / 2, pz);
    post.castShadow = true;
    g.add(post);
  }
  // back wall planks (against garden wall)
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.32, atL),
      postMat
    );
    plank.position.set(wallX + 0.06, 0.16 + i * 0.34, atZ);
    plank.castShadow = true;
    g.add(plank);
  }
  // 3 horizontal shelves
  const shelfMat = woodMaterial('aged', 1, 1);
  for (let i = 0; i < 3; i++) {
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(atW - 0.05, 0.04, atL - 0.1),
      shelfMat
    );
    shelf.position.set(wallX + atW / 2, 0.55 + i * 0.55, atZ);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    g.add(shelf);
  }
  // stored items on shelves: pots, wood, tools (procedural)
  const potMat = new THREE.MeshStandardMaterial({ color: 0x6b3a26, roughness: 0.85 });
  for (let s = 0; s < 3; s++) {
    const y = 0.6 + s * 0.55;
    for (let k = 0; k < 4; k++) {
      const z = atZ - 1.0 + k * 0.65;
      if (Math.random() < 0.6) {
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08 + Math.random() * 0.04, 0.06, 0.16, 10),
          potMat
        );
        pot.position.set(wallX + atW / 2 + (Math.random() - 0.5) * 0.4, y + 0.08, z);
        pot.castShadow = true;
        g.add(pot);
      } else {
        // stacked wood
        for (let w = 0; w < 3; w++) {
          const log = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8),
            new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.9 })
          );
          log.rotation.z = Math.PI / 2;
          log.position.set(wallX + atW / 2, y + 0.05 + w * 0.085, z);
          log.castShadow = true;
          g.add(log);
        }
      }
    }
  }
  // corrugated roof — slight slope
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(atW + 0.2, 0.04, atL + 0.2),
    corrugatedMetalMaterial()
  );
  roof.position.set(wallX + atW / 2, atH + 0.1, atZ);
  roof.rotation.z = -0.06;
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);
  // roof edge trim
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(atW + 0.22, 0.06, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.85 })
  );
  trim.position.set(wallX + atW / 2, atH + 0.07, atZ + (atL + 0.2) / 2);
  g.add(trim);

  // compost bin to the left (front of atelier zone)
  const compostZ = atZ - 2.0;
  const compostMat = woodMaterial('aged', 1, 1);
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.04), compostMat);
    slat.position.set(wallX + 0.45, 0.1 + i * 0.12, compostZ - 0.35);
    slat.castShadow = true;
    g.add(slat);
    const slat2 = slat.clone();
    slat2.position.z = compostZ + 0.35;
    g.add(slat2);
    const slatSide1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.7), compostMat);
    slatSide1.position.set(wallX + 0.1, 0.1 + i * 0.12, compostZ);
    g.add(slatSide1);
    const slatSide2 = slatSide1.clone();
    slatSide2.position.x = wallX + 0.8;
    g.add(slatSide2);
  }
  // compost contents (organic mound)
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.95 })
  );
  mound.position.set(wallX + 0.45, 0.05, compostZ);
  mound.scale.set(1.05, 0.7, 1.05);
  g.add(mound);

  return g;
}

// ----------- ZONE: JACUZZI / SPA -----------
function buildJacuzzi() {
  const g = new THREE.Group();
  g.name = 'zone-jacuzzi';

  const jacZ = 16.5;
  // gravel zone under the spa
  const gravel = new THREE.Mesh(
    new THREE.BoxGeometry(GARDEN.width - 0.4, 0.04, 3.0),
    gravelMaterial(6)
  );
  gravel.position.set(0, 0.02, jacZ);
  gravel.receiveShadow = true;
  g.add(gravel);

  // wood railroad sleepers around the gravel
  const sleeperMat = woodMaterial('aged', 1, 2);
  const sleepers = [
    { p: new THREE.Vector3(0, 0.08, jacZ - 1.55), s: new THREE.Vector3(GARDEN.width - 0.4, 0.16, 0.25) },
    { p: new THREE.Vector3(0, 0.08, jacZ + 1.55), s: new THREE.Vector3(GARDEN.width - 0.4, 0.16, 0.25) },
    { p: new THREE.Vector3(-(GARDEN.width / 2 - 0.32), 0.08, jacZ), s: new THREE.Vector3(0.25, 0.16, 3.0) },
    { p: new THREE.Vector3(+(GARDEN.width / 2 - 0.32), 0.08, jacZ), s: new THREE.Vector3(0.25, 0.16, 3.0) },
  ];
  for (const sl of sleepers) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sl.s.x, sl.s.y, sl.s.z), sleeperMat);
    m.position.copy(sl.p);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  // inflatable spa (Intex Sahara style)
  const spaRadius = 1.0;
  const ringHeight = 0.65;
  // outer ring (made of stacked tori for inflatable look)
  for (let i = 0; i < 3; i++) {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(spaRadius, 0.13, 14, 30),
      spaWallMaterial()
    );
    torus.rotation.x = Math.PI / 2;
    torus.position.set(0, 0.18 + i * 0.22, jacZ);
    torus.castShadow = true;
    torus.receiveShadow = true;
    g.add(torus);
  }
  // inner cylinder wall (to hide gap between torus stacks)
  const innerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(spaRadius - 0.05, spaRadius - 0.05, ringHeight, 32, 1, true),
    spaWallMaterial()
  );
  innerWall.position.set(0, 0.18 + ringHeight / 2, jacZ);
  g.add(innerWall);

  // base of spa (under water)
  const spaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(spaRadius - 0.05, spaRadius - 0.05, 0.08, 32),
    spaWallMaterial()
  );
  spaBase.position.set(0, 0.16, jacZ);
  g.add(spaBase);

  // water surface
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(spaRadius - 0.08, 32),
    waterMaterial()
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.55, jacZ);
  g.add(water);
  // mark water for animation
  water.userData.isWater = true;
  water.userData.baseY = 0.55;

  // dense surrounding vegetation
  for (let i = 0; i < 16; i++) {
    const s = makeShrub(0.6 + Math.random() * 0.4, i % 4);
    const angle = Math.random() * Math.PI * 2;
    s.position.set(
      Math.cos(angle) * 1.6 + (Math.random() - 0.5) * 0.4,
      0,
      jacZ + Math.sin(angle) * 1.4 + (Math.random() - 0.5) * 0.4
    );
    // keep them outside the gravel + spa
    if (Math.abs(s.position.x) < 1.5 && Math.abs(s.position.z - jacZ) < 1.4) {
      s.position.x = Math.sign(s.position.x || 1) * 1.6;
    }
    g.add(s);
  }
  // tall back-corner shrubs
  for (const sx of [-1.5, 1.5]) {
    const ts = makeTallShrub(2.2, 2);
    ts.position.set(sx, 0, jacZ + 1.4);
    g.add(ts);
  }

  return g;
}

// ----------- SCATTERED VEGETATION ALONG PATH -----------
function scatterAlongPath() {
  const g = new THREE.Group();
  // grass tufts and small shrubs between zones to fill the look
  const safeZ = [
    { z: -1.8, ok: false }, // entrance
    { z: 2.7, ok: true },
    { z: 6.4, ok: true },
    { z: 9.7, ok: true },
    { z: 12.6, ok: true },
    { z: 15.6, ok: true },
  ];
  for (const s of safeZ) {
    if (!s.ok) continue;
    for (const side of [-1, 1]) {
      const grass = makeGrassPatch(60, 0.5, 0x5e7f30);
      grass.position.set(side * 1.0, 0, s.z);
      g.add(grass);
    }
  }
  return g;
}

// ----------- BUILD COMPLETE SCENE -----------
export function buildGarden(scene) {
  const root = new THREE.Group();
  root.name = 'garden';

  root.add(buildGround());
  root.add(buildWalls());
  root.add(buildMainPath());
  root.add(buildTerrasse());
  root.add(buildMiOmbre());
  root.add(buildPotager());
  root.add(buildBBQ());
  root.add(buildAtelier());
  root.add(buildJacuzzi());
  root.add(scatterAlongPath());

  // collect items needing per-frame updates
  const animatables = [];
  root.traverse((obj) => {
    if (obj.userData.isWater) animatables.push(obj);
  });
  root.userData.animatables = animatables;

  scene.add(root);
  return root;
}
