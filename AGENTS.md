# AGENTS.md — Quality Metal Carports

Fast orientation for AI agents. Read this first; it saves re-deriving the codebase.
Most work happens in the **3D building configurator** (`client/src/components/builder`).

---

## 1. What this is

Marketing site + a **3D metal-building configurator** ("the builder"). Users size a
carport/garage/barn, set walls/roof/colors/doors/lean-tos, and get a price + quote.

- **client/** — React 18 + Vite SPA. 3D via **React Three Fiber (R3F) + Drei + three.js**. State in **Zustand**. No TypeScript (JSX).
- **server/** — Express API (`server/index.js`): reviews, geocoding, elevation, leads.
- No root `package.json`. `client/` and `server/` are independent npm packages.

---

## 2. Run / build / verify (do this, don't guess)

```bash
# Client dev (Vite). Auto-picks a port from 5173 up. Builder at /builder.
cd client && npm run dev

# Type/compile check — FAST (~2-3s). Use this to verify edits compile.
cd client && npx vite build

# Server dev (Express, port 4000, node --watch). Loads repo-root .env via dotenv.
cd server && npm run dev
```

- **Always `npx vite build` after editing** `client/` — it catches errors quickly. There are no unit tests for the 3D scene; the build + a screenshot are the verification loop.
- **Headless screenshots:** `playwright` is a devDependency in `client/`. Put the script *inside* `client/` (ESM ignores `NODE_PATH`) and run `node script.mjs`.
  - **`waitUntil: 'networkidle'` never settles** (HMR websocket). Use `'domcontentloaded'` or `'load'` + a `waitForTimeout`.
  - The builder is at `http://localhost:<port>/builder`. Left panel = config accordions; bottom toolbar = Frame View / Dims / Parts / Anchors; top-right = camera presets + Fly.
  - Driving the UI sliders headlessly is flaky; prefer switching **Building Type** cards (preset sizes) to reach a state (e.g. a tall/wide barn turns on diagonal bracing).

---

## 3. Coordinate system & global constants

- **X = width, Z = length, Y = up (feet, always).** `hw = width/2`, `hl = length/2`.
- Walls: **front** `z=-hl`, **back** `z=+hl`, **left** `x=-hw`, **right** `x=+hw`.
- Exported from `scene/BuildingTrusses.jsx` (import these, don't hardcode):
  - `M = 0.21` — main frame tube (2.5" sq). Legs/trusses/rails share it.
  - `TRUSS_OH = 0.5` — rafter-tail / eave overhang (6").
  - `GABLE_OH = 0.5` — gable (front/back) roof overhang (6").
  - `roofLift(width)` — skin lift above rafters (0.28, or 0.40 over 30′).
  - Helpers: `TubeBox` (hollow square-tube box, auto long-axis), `Member` (2-pt tube in X-Y), `frameSpan(span, maxSpacing)` (evenly-spaced frame planes incl. both ends), `tubeGeo`, `TubeWallContext` (gauge → wall thickness).
- `CLAD ≈ 0.13` — wall panels sit this far **outboard** of the frame. **Invariant: the steel frame reads as INTERIOR** — hidden behind panels from outside, visible inside / through open walls. Keep new framing inboard of the cladding.

---

## 4. Builder architecture & file map

Data flows **store → `BuilderPage` → `BuilderCanvas` → `Building.jsx` → sub-components.**
`Building.jsx` computes `structure = deriveStructure(config)` once and passes it down.

| File | Responsibility |
|---|---|
| `components/builder/BuilderCanvas.jsx` | R3F `<Canvas>`, `CameraController` (lerp + presets), `FlyController` (WASD free-roam, `flyMode`), `ViewPresetButtons`, lighting, ground, panorama bg. |
| `components/builder/BuilderPanel.jsx` | Left accordion: Building Type, Size & Structure, Walls, Doors & Windows, Colors, Lean-To Wings, Options, Components, Scene. |
| `components/builder/BuilderToolbar.jsx` | Bottom bar: price, CTA, Frame View / Dims / Parts / Anchors toggles. |
| `scene/Building.jsx` | **Root scene assembly.** Gates every sub-component on `componentVisibility` + `frameOnly`. Derives `roofStyle`, `ridgeHeight`, `structure`, effective surface/anchor. |
| `scene/BuildingTrusses.jsx` | Trusses (`AFrameTruss`, `RegularBow`, widespan styles), purlins, girts, base rails, **`DiagonalBraces` + `GussetPlate`** (9" plates), peak gussets, sleeves. Exports the global constants/helpers above. |
| `scene/BuildingColumns.jsx` | Side legs (`Leg`: standard/double/ladder/zigzag) + end posts (`EndLeg`). Legs stop `COL/2` short so the rafter sits on top. |
| `scene/BuildingRoof.jsx` | Roof skin. A-frame = flat `QuadMesh` slopes; Regular = swept curved ribbon. Eave overhang = `TRUSS_OH`. |
| `scene/BuildingWalls.jsx` | Wall panels (`WallFace`, gable, partial, segments w/ door cutouts), **opening placement** (`PlacePlane`/`DragPlane` — double-sided so clickable from outside), `DoorVisual`. |
| `scene/BuildingOpenings.jsx` | Door/window jamb posts + headers (frame-outs). |
| `scene/BuildingLeanTo.jsx` | Lean-to wings (`SideLeanTo` left/right, `EndLeanTo` front/back). `roofConnection`: `continuous` (one roofline) vs `step_down`. Has own rafters/purlins/girts/walls/trim. |
| `scene/BuildingFoundation.jsx` | Slab (concrete/asphalt/gravel) + per-post **anchors** (`showAnchors`); concrete edge details; welded L-brackets. |
| `scene/TrimMesh.jsx` | Ridge cap (14" strip), eave trim (boxed-eave `BoxedEave`/`BoxedEaveRun`), `CornerTrim`, `LTrim` (8" open-end), corner/edge caps. Most trims are **extruded from a 2-D cross-section** (closed-loop ribbon → `ExtrudeGeometry`), segmented ≤11′ w/ laps via `segmentRun`. |
| `scene/Skylight.jsx` | Roof/wall skylight placement (`SkylightSurface`, `flatBasis`). Catch-surface is double-sided + proud of the skin. |
| `scene/Terrain.jsx`, `SiteFeatures.jsx`, `SiteContext.jsx`, `siteMap.js`, `Landscaping.jsx` | "Place on a real site": satellite tile + elevation relief mesh, trees/landscaping. |
| `scene/corrugatedTexture.js`, `groundTexture.js` | Procedural panel (L5/PBR rib profiles) and ground textures. |
| `store/builderStore.js` | **Zustand store** — all config + actions (see §5). |
| `data/structural.js` | **`deriveStructure(config)`** → `{ legType, trussType, spacing, bracing, endPostSpacing, frame/purlin/girt spacing, certified, … }`. `isFullyClosed(style)`. Encodes stamped engineering schedules. |
| `data/builderData.js` | Building types, wall/roof style options, `panelFinish`, suggested color combos. |
| `data/pricing.js` | Price calc. |

---

## 5. State (Zustand `store/builderStore.js`)

Read fields with `useBuilderStore((s) => s.field)`. Key ones:

- **Size/identity:** `buildingType`, `width`, `length`, `height`, `roofStyle`, `roofPitch`, `gauge`, `certification`.
- **Walls/openings:** `walls` `{front,back,left,right}` (`'open' | 'closed' | 'gable' | 'top_N' | 'extended_gable_N'`), `doors[]`, `placing`, `selectedDoorId`.
- **Colors:** `roofColor`/`wallColor`/`trimColor` `{name,hex}`, `wainscot*`.
- **Lean-tos:** `leanTos.{left,right,front,back}` = `{enabled, width, attachHeight, pitch, roofConnection, walls:{outer,front/back or left/right}}`.
- **Loads/site:** `groundSnow`, `windSpeed`, `installationSurface`, `anchorType`, `slabEdge`.
- **View toggles:** `viewMode` (`'normal'|'wireframe'` → `frameOnly`), `showDimensions`, `showAnchors`, `showLabels`, `flyMode`, `requestCameraPreset`, `componentVisibility` (per-component show/hide), `hiddenParts` (per-instance).
- Actions: `setField`, `setWall`, `setLeanTo`, `startPlacing/placeDoor/...`, `toggleComponent`, `togglePart`.

---

## 6. Conventions & invariants (don't break these)

- **Feet everywhere.** **Frame is interior** (behind cladding). **Rafter/top chord sits ON TOP of the leg** (legs stop `COL/2` short). **Panels + rafter tails overhang the eave `TRUSS_OH` (6")**, gables `GABLE_OH`.
- **Frame View** (`viewMode==='wireframe'` → `frameOnly`) hides cladding + trim, shows structure. New cladding/trim must gate on `!frameOnly`; structure renders in both.
- **Components panel** toggles groups via `componentVisibility` — gate new top-level meshes on `show('key')` in `Building.jsx`.
- **Diagonal braces + 9" gusset plates** only render when bracing is on (`structure.bracing==='diagonal'`: height≥11, certified, or widespan >30′). Gusset center plate = 22 SDS, corners = 14.
- **Trim = extruded sheet-metal** sections (ridge cap, corner, L-trim, boxed eave): author a 2-D centreline → `ribbonShape`/closed loop → `ExtrudeGeometry`; segment runs ≤11′ with ~3" laps (`segmentRun`). Lean-tos pass a smaller `scale` (thinner members).
- **No trim on top of roof panels near end walls** (gable rake on top of panels was removed — keep it that way).
- Widths >30′ force a widespan A-frame truss; Regular roof is capped ≤30′ wide/long.

---

## 7. Server / open-source backends (`server/index.js`, port 4000)

No Google API required. Endpoints (CORS open):
- `GET /geocode?q=` → address → `{lat,lng,label}` via **Nominatim (OpenStreetMap)**. `NOMINATIM_URL` overrides.
- `GET /elevation?lat=&lng=&radiusM=&n=` → `{n, elevations[]}` grid via **Open-Elevation** (`OPEN_ELEVATION_URL`, defaults to public; self-host for prod). Powers the site-relief terrain mesh.
- `GET /reviews` → Google business reviews **only if** `GOOGLE_PLACES_API_KEY` set; else static fallback (no Google call).
- `POST /leads` → forwards to Twenty CRM if configured.

Env loads from **repo-root `.env`** (dotenv, path resolved from the server file). `.env` is gitignored; `.env.example` documents vars.

---

## 8. Gotchas (learned the hard way)

- **Files are often edited concurrently by the user.** Re-`Read` a file right before `Edit`; expect "modified since read".
- `BuildingTrusses.jsx` exports the shared geometry constants — **import them**, never re-declare `M`, `TRUSS_OH`, etc. per file.
- R3F **interaction planes must be `THREE.DoubleSide`** or they're only hittable from one side (was the door-placement bug).
- Raycast events only fire on meshes **with handlers**; the nearest such mesh wins (`e.stopPropagation()` blocks the rest).
- After a size change the camera **auto-reframes** (debounced); `flyMode` suppresses that.
- Stamped engineering sheets live in `~/Downloads` (poppler `pdftotext`/`pdftoppm`); they drive truss/brace/leg/load rules in `data/structural.js`.
