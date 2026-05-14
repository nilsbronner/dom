# Jardin Urbain — Visite virtuelle 3D

Site web 3D interactif représentant le jardin urbain étroit décrit dans le dossier photo / plan.
Tout est procédural : pas d'assets externes à télécharger, pas d'étape de build.

## Lancer le site

Le site doit être servi en HTTP (pas en `file://`) à cause des modules ES.

**Le plus simple — via Python :**
```bash
cd jardin-3d
python -m http.server 8080
# puis ouvre http://localhost:8080
```

**Via Node (npx) :**
```bash
cd jardin-3d
npx serve .
```

**Via VS Code :** extension *Live Server* → clic droit sur `index.html` → *Open with Live Server*.

## Stack

- **Three.js r160** (CDN jsDelivr via importmap)
- **GSAP 3.12** pour les transitions caméra et fondus audio
- **WebGL** rendu PBR avec `MeshStandardMaterial` / `MeshPhysicalMaterial`
- **EffectComposer** : bloom subtil + SMAA antialiasing
- **Web Audio API** : ambiance vent + chants d'oiseaux générés en temps réel

## Architecture des fichiers

```
jardin-3d/
├── index.html       Entrée, importmap, UI (top bar, panneau zones, loader)
├── style.css        UI glassmorphism, responsive mobile
├── materials.js     Textures procédurales (brique, bois, gravier, terre, trèfle, métal, ciel)
├── vegetation.js    Plantes procédurales (arbustes, fougères, tomates, salades, choux, herbes…)
│                    + shader vent partagé via onBeforeCompile
├── scene.js         Construction du jardin (murs, sol, chemin, 6 zones, lierre, gazon)
└── main.js          Renderer, caméra, OrbitControls, post-processing, audio, GSAP
```

## Le jardin

- **Dimensions** : 4 m × 20 m, deux murs hauts en briques (3,5 m)
- **Chemin principal** : deux longues planches bois parallèles
- **6 zones** réparties depuis la maison vers le fond :

| # | Zone | Position |
|---|------|----------|
| 1 | Terrasse centrale | z ≈ 0 (proche maison) |
| 2 | Mi-ombre | z ≈ 4,5 |
| 3 | Potager & herbes | z ≈ 7,5 |
| 4 | Barbecue | z ≈ 10,5 (mur droit) |
| 5 | Atelier / stockage / compost | z ≈ 13,5 (mur gauche) |
| 6 | Jacuzzi spa Intex Sahara | z ≈ 16,5 (fond du jardin) |

## Interactions

- **Clic-gauche + drag** : orbiter autour du jardin
- **Clic-droit + drag** : déplacer le pivot
- **Molette / pinch** : zoom
- **Panneau gauche** : cliquer une zone → caméra fly-to + carte d'info
- **Top-bar droite** : vue libre / vue aérienne / vue humaine (≈ 1m65) / toggle son

## Ambiance visuelle

- Lumière directionnelle chaude bas-soleil de fin d'après-midi (golden hour)
- Bounce light cyan-doux côté opposé pour simuler le rebond du ciel sur les murs
- Brouillard exponentiel chaud (0xdcb89a) pour la profondeur
- Bloom léger sur les zones brillantes (eau du spa, reflets)
- Vent procédural injecté dans le vertex shader des feuillages

## Performance

- `InstancedMesh` pour les touffes d'herbe (60-200 brins par patch)
- Textures procédurales partagées via cache module-level
- Shadow map 2048², frustum optimisé pour la taille du jardin
- Cible : 60 fps sur desktop intégré récent, 30+ fps sur mobile
