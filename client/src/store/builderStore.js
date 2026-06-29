import { create } from 'zustand'
import { BUILDING_TYPES } from '../data/builderData'

const DEFAULT_TYPE = BUILDING_TYPES.find((t) => t.id === 'standard_garage')

// attachHeight: null → auto-connect at main building eave; number → ft from ground
const LEAN_TO_DEFAULT = (walls) => ({
  enabled:      false,
  width:        12,
  attachHeight: null,   // null = main eave height
  pitch:        2,      // n/12 — controls outer eave height derivation
  // 'continuous' = roof carries the main slope past the eave (one unbroken
  // roofline, lean-to pitch = main pitch, connects at the main eave).
  // 'step_down'  = separate lower roofline at its own pitch / attach height.
  roofConnection: 'step_down',
  walls:        walls ?? { front: 'open', back: 'open', outer: 'closed' },
  // Each lean-to can sit on its own installation surface, independent of the main
  // building. null → inherit the main building's surface; otherwise one of
  // 'concrete' | 'asphalt' | 'ground' | 'gravel'. Anchor is auto-picked per surface.
  surface:      null,
})

const DEFAULT_LEAN_TOS = {
  left:  LEAN_TO_DEFAULT(),
  right: LEAN_TO_DEFAULT(),
  front: LEAN_TO_DEFAULT({ left: 'open', right: 'open', outer: 'closed' }),
  back:  LEAN_TO_DEFAULT({ left: 'open', right: 'open', outer: 'closed' }),
}

// Strictly-increasing unique id (Date.now alone collides when several items are
// placed within the same millisecond during sticky placement).
let _seq = 0
const uid = () => Date.now() + _seq++

// Minimum clearance (ft) required from the top of a door / roll-up to the eave
// (leg height) — leaves room for the header. Below this the opening can't be placed.
const DOOR_CLEAR = 1

export const useBuilderStore = create((set) => ({
  // ── Building identity ──────────────────────────────────────────────────────
  buildingType:  DEFAULT_TYPE.id,
  width:         DEFAULT_TYPE.defaultWidth,
  length:        DEFAULT_TYPE.defaultLength,
  height:        DEFAULT_TYPE.defaultHeight,
  roofStyle:     DEFAULT_TYPE.defaultRoofStyle,
  roofPitch:     3,
  // Free-standing lean-to only: explicit LOW-side leg height (the HIGH side = `height`).
  // null → derive the low eave from the pitch; a number → use it directly, and the
  // roof slope then follows the two leg heights instead of the pitch.
  lowEaveHeight: null,
  gauge:         12,    // structural frame tube gauge: 12 (default) | 14

  // ── Walls & doors ─────────────────────────────────────────────────────────
  walls: { ...DEFAULT_TYPE.defaultWalls },
  doors: [],

  // ── Colors ────────────────────────────────────────────────────────────────
  roofColor:     { name: 'Pewter Gray', hex: '#887c6c' },
  wallColor:     { name: 'Galvalume (Bare Metal Finish)', hex: '#C6CACE' },
  trimColor:     { name: 'Black',       hex: '#2f2f30' },
  wainscotEnabled: false,
  wainscotColor: { name: 'Barn Red',    hex: '#924130' },
  // Per-wall wainscot overrides: { [wallKey]: true | false }. Effective value for a
  // wall = wainscotWalls[key] ?? wainscotEnabled (global default). Keys: center
  // walls 'front'|'back'|'left'|'right', lean-to walls 'lean:<side>:<face>'.
  wainscotWalls: {},

  // ── Skylights ───────────────────────────────────────────────────────────────
  // Semi-transparent L5 panel strips (one panel ≈ 3′ wide) placed on roof slopes or
  // walls. Each: { id, surfaceKey, lane (0..1 across the run), alongOffset (0..1
  // start along the run), length (ft, 4–12 clamped to the run). L5 profile only.
  skylights:         [],
  selectedSkylightId: null,

  // ── Landscaping (procedural low-poly site props: trees, shrubs) ──────────────
  // Each: { id, type, x, z (ground feet), scale, rotation }. Placed on the ground.
  landscaping:    [],
  selectedPropId: null,

  // ── Vehicles (scale reference props: cars, trucks, RVs, boats, planes…) ───────
  // Real-world-sized low-poly models placed on the ground to visualize how much
  // room a build has. Each: { id, type, x, z (ground feet), rotation, color (hex) }.
  vehicles:         [],
  selectedVehicleId: null,
  showVehicles:     false,    // opens the Vehicles menu sidebar (toolbar toggle)

  // ── Panel orientation ─────────────────────────────────────────────────────
  wallOrientation: 'auto',   // 'auto' | 'horizontal' | 'vertical'

  // Panel profile: 'l5' (¾″ rib @ 9″, standard) | 'pbr' (1¼″ rib @ 12″, upgrade)
  panelProfile: 'l5',
  // Panel sheet gauge: 26 (default, heavier) | 29 (thinner)
  panelGauge:   26,

  // ── Structural options ────────────────────────────────────────────────────
  bracingType:    'none',
  certification:  'uncertified',
  legHeightType:  'standard',
  ladderLegsBaserail: false,

  // ── Design loads (drive frame / purlin / girt spacing per stamped schedules) ─
  groundSnow:     30,    // PSF — Table rows 30…90 (ground snow / roof live)
  windSpeed:      105,   // MPH — Vult, Exposure C (105…180)

  // Widespan (>30′) truss web style: 'sloping_flat' | 'fink' | 'warren'
  widespanTrussStyle: 'sloping_flat',

  // ── Add-ons ───────────────────────────────────────────────────────────────
  extraOptions: {
    // Anchors — gated by installation surface (see ANCHOR_OPTIONS_BY_SURFACE):
    //   ground / gravel → pin, rock, mobile-home
    //   asphalt         → asphalt
    //   cement          → titen, concrete wedge, welded L-brackets
    pinAnchor:           false,   // rebar / pin (ground+gravel)
    rockAnchor:          false,   // rock anchor (ground+gravel)
    mobileHomeAnchor:    false,   // mobile-home anchor (ground+gravel)
    asphaltAnchor:       false,   // asphalt anchor (asphalt)
    titenHDScrew:        false,   // Titen HD screw (cement)
    concreteAnchor:      false,   // concrete wedge anchor (cement)
    weldedOnBrackets:    false,   // welded L-brackets (cement)
    extraTrusses:        false,
    gauge26PanelUpgrade: false,
    pbr26GaPanelUpgrade: false,
    coloredScrews:       false,
  },

  // ── Install equipment the CUSTOMER provides ────────────────────────────────
  // null = use the size-based auto suggestion (installRequirements); a number is a
  // manual override (also drives how many props are staged in the 3-D scene).
  scissorLiftCount:  null,
  telehandlerCount:  null,

  // ── Site / quote metadata ─────────────────────────────────────────────────
  installationSurface:  'ground',  // what the BUILDING is built on (slab/anchors/price): 'concrete' | 'asphalt' | 'ground' | 'gravel'
  groundType:           'ground',  // the surrounding YARD surface (visual only) — independent of installationSurface so you can mix & match (e.g. concrete pad on a lawn)
  anchorType:           'pin',     // see SURFACE_ANCHORS (auto-picked per surface)
  slabEdge:             'flat',    // concrete pour: 'flush' | 'beveled' | 'notched' | 'flat'
  jobSiteLevel:         true,
  electricityAvailable: false,
  drawings:             'none',
  notes:                '',
  customComponents:     [],

  // ── Loft ──────────────────────────────────────────────────────────────────
  loft: { enabled: false, size: null, position: 'center' },

  // ── Lean-tos ──────────────────────────────────────────────────────────────
  leanTos:       { ...DEFAULT_LEAN_TOS },
  wrapAroundRoof: false,

  // ── Interior partition walls ───────────────────────────────────────────────
  // Each: { id, axis:'cross'|'length', t }. axis 'cross' = spans the WIDTH (gable
  // shaped), positioned along the LENGTH; 'length' = spans the LENGTH, positioned
  // along the WIDTH. `t` ∈ [0,1] along the perpendicular span; the renderer snaps
  // it to the nearest interior frame/post line. Unlimited count.
  interiorWalls: [],

  // ── Opening placement / selection ──────────────────────────────────────────
  placing:        null,    // { type, sizeLabel, width, height, framed } while placing
  selectedDoorId: null,    // currently-selected opening in the 3D view
  placeError:     null,    // reason a place/resize was refused (e.g. < 1′ door clearance)

  // ── View / overlay ────────────────────────────────────────────────────────
  viewMode:            'normal',   // 'normal' | 'wireframe'
  showDimensions:      false,      // Dims OFF by default on first entry
  showFootMarkers:     false,
  showLabels:          false,      // Parts: 3D part-name callouts + Components sidebar
  showAnchors:         false,      // per-post ground anchors (toggle view)
  isDraggingDoor:      false,
  isDark:              true,
  requestCameraPreset: null,       // 'front' | 'back' | 'left' | 'right' | 'top' | 'interior' | 'default'
  flyMode:             false,      // WASD + drag-to-look free-roam camera (disables OrbitControls + auto-reframe)

  // ── Scene / background ────────────────────────────────────────────────────
  // The sky is always the Dawn HDRI (Poly Haven) — it doubles as the reflection
  // environment for the metal panels. No user-facing sky picker.

  // ── Site map (free OpenStreetMap 3-D context) ──────────────────────────────
  // Address → geocode → real neighbouring building footprints extruded around the
  // origin, so you can drop the building onto its actual lot and drag it around.
  siteMapEnabled: false,
  // Satellite imagery + elevation relief patch under the building (filled on geocode).
  terrainEnabled: true,
  siteMap: {
    address: '', lat: null, lng: null, label: '',
    buildings: [],            // [{ pts:[{x,z}], height }] in scene feet
    radiusM: 250,             // search radius around the address
    status: 'idle',           // 'idle' | 'loading' | 'ready' | 'error'
    error: null,
    satUrl: null,             // Esri satellite tile for the address patch
    elevM: null,              // n×n elevation grid (metres) or null (flat)
    gridN: 0,                 // elevation grid dimension
  },
  // Where the configured building sits on the site (feet from the address point) + spin.
  buildingPlacement: { x: 0, z: 0, rotation: 0 },
  isDraggingBuilding: false,  // disables OrbitControls while dragging placement

  // Per-prop placement overrides for the staged site equipment (truck/trailer,
  // telehandler, scissor lift). Keyed by prop id (e.g. 'telehandler-0'); absent →
  // the auto-staged default position. Each: { x, z, rotation } in building-local feet.
  equipment: {},
  selectedEquipmentId: null,  // currently-selected draggable prop (shows its toolbar)

  // ── Component show/hide (Components panel) ─────────────────────────────────
  // Each key toggles a group of meshes on/off in the 3D scene. All on by default.
  componentVisibility: {
    // Structure
    foundation: true,   // slab + per-post anchors
    baseRails:  true,   // perimeter base rail
    sideLegs:   true,   // side-wall legs
    endPosts:   true,   // end-wall posts
    frames:     true,   // trusses / structural frames
    purlins:    true,   // roof purlins
    girts:      true,   // wall girts
    braces:     true,   // diagonal sway braces
    // Skin
    roof:       true,   // roof panels
    walls:      true,   // wall panels
    wainscot:   true,   // wainscot band
    skylights:  true,   // skylight panels
    doors:      true,   // doors & windows
    landscaping: true,  // trees, shrubs & site props
    siteTrees:   true,  // OSM trees / woods around the address
    siteRoads:   true,  // OSM roads, driveways & parking
    siteCars:    true,  // parked cars scattered on OSM parking lots
    sitePools:   true,  // swimming pools detected from the satellite tile
    siteFences:  true,  // OSM fences, walls & hedges
    siteGround:  true,  // OSM ground cover (grass / crop / dirt / concrete / asphalt / water)
    // Trim
    ridgeCap:   true,   // ridge cap
    eaveTrim:   true,   // eave trim
    rakeTrim:   true,   // gable rake trim
    cornerTrim: true,   // corner trim
    // Lean-tos
    leanTos:    true,   // lean-to wings
    interiorWalls: true, // interior partition walls
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  applyBuildingType: (type) =>
    set((s) => ({
      buildingType: type.id,
      width:        type.defaultWidth,
      length:       type.defaultLength,
      height:       type.defaultHeight,
      roofStyle:    type.defaultRoofStyle,
      walls:        { ...type.defaultWalls },
      leanTos: type.defaultLeanTos
        ? {
            ...DEFAULT_LEAN_TOS,
            left:  { ...LEAN_TO_DEFAULT(), ...type.defaultLeanTos.left  },
            right: { ...LEAN_TO_DEFAULT(), ...type.defaultLeanTos.right },
          }
        : { ...DEFAULT_LEAN_TOS },
    })),

  setField: (key, value) => set({ [key]: value }),

  setSiteMap: (updates) => set((s) => ({ siteMap: { ...s.siteMap, ...updates } })),
  setBuildingPlacement: (updates) =>
    set((s) => ({ buildingPlacement: { ...s.buildingPlacement, ...updates } })),

  setEquipment: (id, updates) =>
    set((s) => ({ equipment: { ...s.equipment, [id]: { ...(s.equipment[id] || {}), ...updates } } })),
  resetEquipment: (id) =>
    set((s) => { const e = { ...s.equipment }; delete e[id]; return { equipment: e } }),

  toggleComponent: (key) =>
    set((s) => ({ componentVisibility: { ...s.componentVisibility, [key]: !s.componentVisibility[key] } })),

  setAllComponents: (value) =>
    set((s) => ({
      componentVisibility: Object.fromEntries(
        Object.keys(s.componentVisibility).map((k) => [k, value]),
      ),
      hiddenParts: value ? {} : s.hiddenParts,   // "Show all" also un-hides individuals
    })),

  // ── Per-INSTANCE show/hide ── e.g. { 'purlins#3': true } hides Roof Purlin 4.
  hiddenParts: {},
  togglePart: (id) =>
    set((s) => {
      const h = { ...s.hiddenParts }
      if (h[id]) delete h[id]; else h[id] = true
      return { hiddenParts: h }
    }),

  setWall: (side, style) =>
    set((s) => ({ walls: { ...s.walls, [side]: style } })),

  setColor: (part, color) =>
    set({ [`${part}Color`]: color }),

  setWainscot: (enabled) => set({ wainscotEnabled: enabled }),

  // Per-wall wainscot override. on = true | false (explicit). Pass undefined to
  // clear back to the global default.
  setWainscotWall: (key, on) =>
    set((s) => {
      const w = { ...s.wainscotWalls }
      if (on === undefined) delete w[key]; else w[key] = on
      return { wainscotWalls: w }
    }),

  setLeanTo: (side, updates) =>
    set((s) => ({
      leanTos: { ...s.leanTos, [side]: { ...s.leanTos[side], ...updates } },
    })),

  // ── Interior walls ──
  addInteriorWall: (axis = 'cross') =>
    set((s) => ({
      interiorWalls: [...s.interiorWalls, { id: `iw-${Date.now()}-${s.interiorWalls.length}`, axis, t: 0.5 }],
    })),
  setInteriorWall: (id, updates) =>
    set((s) => ({
      interiorWalls: s.interiorWalls.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),
  removeInteriorWall: (id) =>
    set((s) => ({ interiorWalls: s.interiorWalls.filter((w) => w.id !== id) })),

  setExtraOption: (key, value) =>
    set((s) => ({ extraOptions: { ...s.extraOptions, [key]: value } })),

  setLoft: (updates) =>
    set((s) => ({ loft: { ...s.loft, ...updates } })),

  addDoor: (door) =>
    set((s) => ({
      doors: [...s.doors, {
        ...door,
        id: uid(),
        xOffset: door.xOffset ?? 0.5,
        // Windows can be raised/lowered; default centred at mid-wall. Doors sit
        // on the floor (yOffset null → grounded).
        yOffset: door.yOffset ?? (door.type === 'window' ? 0.5 : null),
      }],
    })),

  removeDoor: (id) =>
    set((s) => ({ doors: s.doors.filter((d) => d.id !== id) })),

  setDoorOffset: (id, xOffset) =>
    set((s) => ({
      doors: s.doors.map((d) => (d.id === id ? { ...d, xOffset } : d)),
    })),

  setDoorYOffset: (id, yOffset) =>
    set((s) => ({
      doors: s.doors.map((d) => (d.id === id ? { ...d, yOffset } : d)),
    })),

  setDoorWall: (id, wall) =>
    set((s) => ({
      doors: s.doors.map((d) => (d.id === id ? { ...d, wall } : d)),
    })),

  setDoorField: (id, key, value) =>
    set((s) => ({ doors: s.doors.map((d) => (d.id === id ? { ...d, [key]: value } : d)) })),

  // ── Placement / selection ──────────────────────────────────────────────────
  // spec.category: 'door' (default) | 'skylight'. Skylight specs carry { length }.
  startPlacing: (spec) => set({ placing: spec, selectedDoorId: null, selectedSkylightId: null, selectedPropId: null, selectedVehicleId: null, placeError: null }),
  cancelPlacing: () => set({ placing: null, placeError: null }),

  placeDoor: (wall, xOffset, yOffset) =>
    set((s) => {
      if (!s.placing || s.placing.category === 'skylight') return {}
      // A door / roll-up needs ≥1′ clearance from its top to the eave (leg height)
      // for the header. Not enough → don't place; surface why in the banner.
      if (s.placing.type !== 'window' && s.placing.height + DOOR_CLEAR > s.height) {
        return { placeError: `${s.placing.sizeLabel} needs ≥1′ above it — raise the eave or pick a shorter door.` }
      }
      const d = {
        ...s.placing,
        id: uid(),
        wall,
        xOffset,
        yOffset: s.placing.type === 'window' ? (yOffset ?? 0.5) : null,
      }
      // STICKY: keep `placing` active so the same item can be applied again with
      // another click (no need to re-pick it). Cancel to stop.
      return { doors: [...s.doors, d], placeError: null }
    }),

  selectDoor: (id) => set({ selectedDoorId: id, selectedSkylightId: null, placing: null }),

  // ── Skylights ───────────────────────────────────────────────────────────────
  placeSkylight: (surfaceKey, lane, alongOffset) =>
    set((s) => {
      if (!s.placing || s.placing.category !== 'skylight') return {}
      const sk = { id: uid(), surfaceKey, lane, alongOffset, length: s.placing.length ?? 8 }
      // STICKY: keep placing active for repeated placement (Cancel to stop).
      return { skylights: [...s.skylights, sk] }
    }),

  selectSkylight: (id) => set({ selectedSkylightId: id, selectedDoorId: null, placing: null }),

  removeSkylight: (id) =>
    set((s) => ({
      skylights: s.skylights.filter((k) => k.id !== id),
      selectedSkylightId: s.selectedSkylightId === id ? null : s.selectedSkylightId,
    })),

  duplicateSkylight: (id) =>
    set((s) => {
      const k = s.skylights.find((x) => x.id === id)
      if (!k) return {}
      // Offset the copy one panel-width across so the pair reads as a chained run.
      const nk = { ...k, id: uid(), lane: Math.min(1, (k.lane ?? 0.5) + 0.12) }
      return { skylights: [...s.skylights, nk], selectedSkylightId: nk.id }
    }),

  setSkylightField: (id, key, value) =>
    set((s) => ({ skylights: s.skylights.map((k) => (k.id === id ? { ...k, [key]: value } : k)) })),

  setSkylightOffset: (id, lane, alongOffset) =>
    set((s) => ({ skylights: s.skylights.map((k) => (k.id === id ? { ...k, lane, alongOffset } : k)) })),

  // ── Landscaping props ───────────────────────────────────────────────────────
  placeProp: (x, z) =>
    set((s) => {
      if (!s.placing || s.placing.category !== 'prop') return {}
      // Aligned props (houses / fences / driveways) drop axis-aligned; plants get a
      // random spin so a cluster looks natural.
      const rotation = s.placing.rotation != null ? s.placing.rotation : Math.random() * Math.PI * 2
      const p = { id: uid(), type: s.placing.propType, x, z, scale: 1, rotation }
      // STICKY: keep placing active so you can drop several of the same prop.
      return { landscaping: [...s.landscaping, p] }
    }),

  // Fence / driveway DRAWN by click-dragging a line: center + rotation + length
  // come from the two endpoints. Sticky (placing stays active to draw more).
  placeDrawnProp: (type, x, z, rotation, length) =>
    set((s) => ({ landscaping: [...s.landscaping, { id: uid(), type, x, z, scale: 1, rotation, length }] })),

  selectProp: (id) => set({ selectedPropId: id, selectedDoorId: null, selectedSkylightId: null, selectedVehicleId: null, placing: null }),

  removeProp: (id) =>
    set((s) => ({
      landscaping: s.landscaping.filter((p) => p.id !== id),
      selectedPropId: s.selectedPropId === id ? null : s.selectedPropId,
    })),

  duplicateProp: (id) =>
    set((s) => {
      const p = s.landscaping.find((x) => x.id === id)
      if (!p) return {}
      const np = { ...p, id: uid(), x: p.x + 3, z: p.z + 3, rotation: Math.random() * Math.PI * 2 }
      return { landscaping: [...s.landscaping, np], selectedPropId: np.id }
    }),

  setPropField: (id, key, value) =>
    set((s) => ({ landscaping: s.landscaping.map((p) => (p.id === id ? { ...p, [key]: value } : p)) })),

  setPropPos: (id, x, z) =>
    set((s) => ({ landscaping: s.landscaping.map((p) => (p.id === id ? { ...p, x, z } : p)) })),

  // ── Vehicles (scale-reference props) ─────────────────────────────────────────
  placeVehicle: (x, z) =>
    set((s) => {
      if (!s.placing || s.placing.category !== 'vehicle') return {}
      const v = { id: uid(), type: s.placing.vehicleType, x, z, rotation: 0, color: s.placing.color ?? '#c8ccd2' }
      // STICKY: keep placing active so several of the same vehicle can be dropped.
      return { vehicles: [...s.vehicles, v], selectedVehicleId: v.id }
    }),

  selectVehicle: (id) =>
    set({ selectedVehicleId: id, selectedPropId: null, selectedDoorId: null, selectedSkylightId: null, placing: null }),

  removeVehicle: (id) =>
    set((s) => ({
      vehicles: s.vehicles.filter((v) => v.id !== id),
      selectedVehicleId: s.selectedVehicleId === id ? null : s.selectedVehicleId,
    })),

  duplicateVehicle: (id) =>
    set((s) => {
      const v = s.vehicles.find((x) => x.id === id)
      if (!v) return {}
      const nv = { ...v, id: uid(), x: v.x + 6, z: v.z + 6 }
      return { vehicles: [...s.vehicles, nv], selectedVehicleId: nv.id }
    }),

  setVehicleField: (id, key, value) =>
    set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, [key]: value } : v)) })),

  setVehiclePos: (id, x, z) =>
    set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, x, z } : v)) })),

  duplicateDoor: (id) =>
    set((s) => {
      const d = s.doors.find((x) => x.id === id)
      if (!d) return {}
      const nd = { ...d, id: uid(), xOffset: Math.min(0.93, (d.xOffset ?? 0.5) + 0.12) }
      return { doors: [...s.doors, nd], selectedDoorId: nd.id }
    }),

  // Resize an existing opening to a new size from its type's size list. Doors /
  // roll-ups must keep ≥1′ clearance to the eave — too tall → refuse + warn.
  setDoorSize: (id, width, height, sizeLabel) =>
    set((s) => {
      const d = s.doors.find((x) => x.id === id)
      if (!d) return {}
      if (d.type !== 'window' && height + DOOR_CLEAR > s.height) {
        return { placeError: `${sizeLabel} needs ≥1′ above it — raise the eave or pick a shorter door.` }
      }
      return { doors: s.doors.map((x) => (x.id === id ? { ...x, width, height, sizeLabel } : x)), placeError: null }
    }),

  // Evenly justify every opening on a wall (xOffset = 1/(n+1) … n/(n+1))
  distributeWall: (wall) =>
    set((s) => {
      const ids = s.doors.filter((d) => d.wall === wall).map((d) => d.id)
      if (!ids.length) return {}
      return {
        doors: s.doors.map((d) => {
          const i = ids.indexOf(d.id)
          return i < 0 ? d : { ...d, xOffset: (i + 1) / (ids.length + 1) }
        }),
      }
    }),

  setViewMode:       (mode) => set({ viewMode: mode }),
  setIsDraggingDoor: (v)    => set({ isDraggingDoor: v }),
  toggleTheme:       ()     => set((s) => ({ isDark: !s.isDark })),
}))
