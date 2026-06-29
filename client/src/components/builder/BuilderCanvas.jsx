import { Suspense, useEffect, useRef, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls, Html, Environment } from '@react-three/drei'
import { useBuilderStore } from '../../store/builderStore'
import Building from './scene/Building'
import SiteContext from './scene/SiteContext'
import SiteFeatures from './scene/SiteFeatures'
import Landscaping from './scene/Landscaping'
import Vehicles from './scene/Vehicles'
import Terrain from './scene/Terrain'
import { deriveStructure } from '../../data/structural'
import { collarHalfX } from './scene/BuildingTrusses'
import { getGroundTexture } from './scene/groundTexture'

const FT_PER_M = 3.28084

// ── Draggable building placement (site map mode) ──────────────────────────────
// Wraps the building in a movable group. In site-map mode you can grab the building
// and drag it across the ground (raycast onto y=0) to position it on its real lot.
// A pad of the chosen GROUND TYPE around the building footprint, used in site-map
// mode to OVERRIDE the map's grass/terrain right around the building (so e.g. a
// gravel or concrete pad reads under the build instead of the lot's lawn). Sized
// to the footprint + a margin and laid just above the OSM ground patches.
const PAD_MARGIN = 4   // ft of prepared ground past each wall (tight skirt, not a big lot)
function PerimeterGround({ width, length, surface }) {
  const w = width + 2 * PAD_MARGIN
  const l = length + 2 * PAD_MARGIN
  const tex = useMemo(() => {
    const t = getGroundTexture(surface).clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(w / 8, l / 8)   // groundTexture tiles every ~8 ft
    return t
  }, [surface, w, l])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} receiveShadow>
      <planeGeometry args={[w, l]} />
      <meshStandardMaterial map={tex} roughness={0.95} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
    </mesh>
  )
}

function SitePlacement({ config }) {
  const { camera, gl } = useThree()
  // Drag-to-place + the ground pad are active when EITHER the OSM site map OR just
  // the satellite terrain is showing (so you can position on the aerial alone).
  const siteLoaded = config.siteMap?.lat != null || config.siteMap?.status === 'ready'
  const satOn   = siteLoaded && config.terrainEnabled !== false && !!config.siteMap?.satUrl
  const enabled = siteLoaded && (config.siteMapEnabled || satOn)
  const placement = config.buildingPlacement ?? { x: 0, z: 0, rotation: 0 }
  const setBuildingPlacement = useBuilderStore((s) => s.setBuildingPlacement)
  const setField             = useBuilderStore((s) => s.setField)

  const placeRef = useRef(placement); placeRef.current = placement
  const dragging = useRef(false)
  const grab     = useRef({ dx: 0, dz: 0 })
  const plane    = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const ray      = useRef(new THREE.Raycaster())
  const v2       = useRef(new THREE.Vector2())
  const hit      = useRef(new THREE.Vector3())

  const ground = (cx, cy) => {
    const r = gl.domElement.getBoundingClientRect()
    v2.current.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.current.setFromCamera(v2.current, camera)
    return ray.current.ray.intersectPlane(plane.current, hit.current) ? hit.current : null
  }

  useEffect(() => {
    if (!enabled) return
    const onMove = (e) => {
      if (!dragging.current) return
      const p = ground(e.clientX, e.clientY)
      if (p) setBuildingPlacement({ x: p.x + grab.current.dx, z: p.z + grab.current.dz })
    }
    const onUp = () => {
      if (dragging.current) { dragging.current = false; setField('isDraggingBuilding', false) }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e) => {
    if (!enabled) return
    e.stopPropagation()
    const p = ground(e.clientX, e.clientY)
    if (!p) return
    grab.current = { dx: placeRef.current.x - p.x, dz: placeRef.current.z - p.z }
    dragging.current = true
    setField('isDraggingBuilding', true)
  }

  return (
    <group position={[placement.x, 0, placement.z]} rotation={[0, placement.rotation, 0]} onPointerDown={onDown}>
      {/* Prepared pad of the building's INSTALLATION SURFACE around the footprint —
          so a different Installation Surface vs. yard Ground Type reads clearly (e.g.
          a gravel pad on a lawn). Always in site-map mode (overrides the lot's
          terrain); in normal mode only when it differs from the yard and isn't
          concrete (concrete already draws its own slab via BuildingFoundation). */}
      {(enabled ||
        (config.installationSurface !== config.groundType && config.installationSurface !== 'concrete')) && (
        <PerimeterGround width={config.width} length={config.length} surface={config.installationSurface} />
      )}
      <Building config={config} />
    </group>
  )
}

// ── Environment / sky (Dawn HDRI — the only sky) ──────────────────────────────
// A single high-quality 2k outdoor HDRI from Poly Haven (CC0), loaded by URL via
// drei's <Environment files>. It is ALWAYS the visible background AND the
// reflection environment for the metal panels (high-metalness steel needs a sky
// to reflect or it renders black). No user-facing sky picker.
const PH = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k'
const DAWN_HDRI = `${PH}/kloppenheim_06_puresky_2k.hdr`

// ── Default 3/4 camera position ───────────────────────────────────────────────
// Negative Z so the FRONT wall (at z = −length/2) faces the camera on load.
function camFor(width, length, height) {
  const dist = Math.max(width, length) * 1.8
  return {
    pos:    [dist * 0.7, height * 1.4 + height, -dist],
    target: [0, height / 2, 0],
  }
}

// ── Named view presets ────────────────────────────────────────────────────────
function getCameraPreset(preset, width, length, height) {
  const hw   = width / 2
  const hl   = length / 2
  const dist = Math.max(width, length) * 1.6
  const mid  = height * 0.55
  switch (preset) {
    case 'front':    return { pos: [0,                    mid, -(hl + dist * 0.55)], target: [0, height * 0.4, 0] }
    case 'back':     return { pos: [0,                    mid,   hl + dist * 0.55 ], target: [0, height * 0.4, 0] }
    case 'left':     return { pos: [-(hw + dist * 0.55),  mid, 0                  ], target: [0, height * 0.4, 0] }
    case 'right':    return { pos: [ hw + dist * 0.55,    mid, 0                  ], target: [0, height * 0.4, 0] }
    case 'top':      return { pos: [0, height * 5 + 20, 0.01                      ], target: [0, 0, 0] }
    case 'interior': return { pos: [0, height * 0.5,     0                        ], target: [0, height * 1.6, 0] }
    default:         return camFor(width, length, height)
  }
}

// ── Animated camera controller ────────────────────────────────────────────────
function CameraController() {
  const { camera, controls } = useThree()
  const buildingType   = useBuilderStore((s) => s.buildingType)
  const width          = useBuilderStore((s) => s.width)
  const length         = useBuilderStore((s) => s.length)
  const height         = useBuilderStore((s) => s.height)
  const requestPreset  = useBuilderStore((s) => s.requestCameraPreset)
  const flyMode        = useBuilderStore((s) => s.flyMode)
  const setField       = useBuilderStore((s) => s.setField)

  const targetPos   = useRef(new THREE.Vector3())
  const targetLook  = useRef(new THREE.Vector3())
  const animating   = useRef(false)
  const typeReady   = useRef(false)  // skip buildingType effect on mount
  const dimSkipped  = useRef(false)  // skip dimension effect on mount
  const dimTimer    = useRef(null)

  function animateTo(pos, look) {
    targetPos.current.set(...pos)
    targetLook.current.set(...look)
    animating.current = true
  }

  // Re-frame when building type changes (skip first mount)
  useEffect(() => {
    if (!typeReady.current) {
      typeReady.current = true
      targetPos.current.copy(camera.position)
      if (controls) targetLook.current.copy(controls.target)
      return
    }
    if (flyMode) return            // don't yank the camera while free-flying
    const { pos, target } = camFor(width, length, height)
    animateTo(pos, target)
  }, [buildingType]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced re-frame on dimension changes (skip first mount)
  useEffect(() => {
    if (!dimSkipped.current) { dimSkipped.current = true; return }
    if (flyMode) return            // don't re-frame on size changes while free-flying
    clearTimeout(dimTimer.current)
    dimTimer.current = setTimeout(() => {
      const { pos, target } = camFor(width, length, height)
      animateTo(pos, target)
    }, 450)
    return () => clearTimeout(dimTimer.current)
  }, [width, length, height]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle named preset requests from outside the canvas
  useEffect(() => {
    if (!requestPreset) return
    if (flyMode) setField('flyMode', false)   // a named view exits free-roam
    const { pos, target } = getCameraPreset(requestPreset, width, length, height)
    animateTo(pos, target)
    setField('requestCameraPreset', null)
  }, [requestPreset]) // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth lerp toward target each frame
  useFrame(() => {
    if (!animating.current || !controls) return
    const SPEED = 0.09
    camera.position.lerp(targetPos.current, SPEED)
    controls.target.lerp(targetLook.current, SPEED)
    controls.update()
    if (camera.position.distanceTo(targetPos.current) < 0.06) {
      camera.position.copy(targetPos.current)
      controls.target.copy(targetLook.current)
      controls.update()
      animating.current = false
    }
  })

  return null
}

// ── Free-roam fly camera (WASD + drag-to-look) ────────────────────────────────
// Active only when store.flyMode is on. OrbitControls is disabled meanwhile so
// the two don't fight over the camera.
function FlyController() {
  const { camera, gl } = useThree()
  const flyMode = useBuilderStore((s) => s.flyMode)
  const keys  = useRef({})
  const drag  = useRef(null)                       // { x, y } of last pointer move
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  useEffect(() => {
    if (!flyMode) return
    const el = gl.domElement
    // Seed yaw/pitch from wherever the camera is currently looking → no snap.
    euler.current.setFromQuaternion(camera.quaternion, 'YXZ')

    const isTyping = (t) =>
      t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
            t.tagName === 'SELECT' || t.isContentEditable)
    const MOVE_KEYS = new Set([
      'KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyC','Space','ShiftLeft','ShiftRight',
    ])

    const onKeyDown = (e) => {
      if (isTyping(e.target) || !MOVE_KEYS.has(e.code)) return
      keys.current[e.code] = true
      e.preventDefault()                            // stop Space/arrows scrolling the page
    }
    const onKeyUp = (e) => { keys.current[e.code] = false }

    const onPointerDown = (e) => {
      drag.current = { x: e.clientX, y: e.clientY }
      el.style.cursor = 'grabbing'
    }
    const onPointerMove = (e) => {
      if (!drag.current) return
      const dx = e.clientX - drag.current.x
      const dy = e.clientY - drag.current.y
      drag.current = { x: e.clientX, y: e.clientY }
      const LOOK = 0.0035
      euler.current.y -= dx * LOOK
      euler.current.x -= dy * LOOK
      const LIM = Math.PI / 2 - 0.05                // don't flip past straight up/down
      euler.current.x = Math.max(-LIM, Math.min(LIM, euler.current.x))
      camera.quaternion.setFromEuler(euler.current)
    }
    const onPointerUp = () => { drag.current = null; el.style.cursor = 'grab' }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    el.style.cursor = 'grab'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      el.style.cursor = ''
      keys.current = {}
      drag.current = null
    }
  }, [flyMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!flyMode) return
    const k = keys.current
    const boost = (k.ShiftLeft || k.ShiftRight) ? 3 : 1
    const speed = 16 * boost * Math.min(delta, 0.05)   // ~ft/sec, clamp big frame gaps
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()
    const move = new THREE.Vector3()
    if (k.KeyW) move.add(forward)
    if (k.KeyS) move.sub(forward)
    if (k.KeyD) move.add(right)
    if (k.KeyA) move.sub(right)
    if (k.KeyE || k.Space) move.y += 1                 // rise
    if (k.KeyQ || k.KeyC)  move.y -= 1                 // descend
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed)
      camera.position.add(move)
    }
  })

  return null
}

// ── Dimension labels ──────────────────────────────────────────────────────────
function DimChip({ position, text }) {
  return (
    <Html position={position} center occlude={false}>
      <div style={{
        background: 'rgba(0,0,0,0.68)',
        color: '#fff',
        fontSize: '11px',
        fontFamily: 'monospace',
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        border: '1px solid rgba(255,255,255,0.18)',
      }}>
        {text}
      </div>
    </Html>
  )
}

// Feet → ft-in string, rounded to the nearest ½ inch (e.g. 10.125 → 10′1.5″)
function ftIn(v) {
  const f = Math.floor(v + 1e-6)
  const inch = Math.round((v - f) * 12 * 2) / 2
  if (inch >= 12) return `${f + 1}′`
  return inch ? `${f}′${inch % 1 ? inch.toFixed(1) : inch}″` : `${f}′`
}

function DimensionLines({ width, length, height, roofPitch = 3, roofStyle }) {
  const hw = width / 2
  const hl = length / 2
  const rise      = hw * Math.tan(Math.atan(roofPitch / 12))
  const peak      = height + rise
  // Bottom chord / underside clearance: midway eave→peak (peak-brace trusses);
  // a widespan truss ties at the eave line, so clearance = eave height there.
  const widespan  = width > 30
  const clearance = widespan ? height : height + rise * 0.5
  return (
    <group>
      <DimChip position={[0,       -0.6, -(hl + 1.6)]}       text={`← ${width}′ →`}  />
      <DimChip position={[hw + 2,  -0.6, 0]}                  text={`← ${length}′ →`} />
      <DimChip position={[hw + 1.2, height / 2, -(hl + 1.2)]} text={`${height}′ H`}   />

      {/* Heights, stacked at the centre of the building */}
      <DimChip position={[0, peak + 0.5,  0]} text={`Peak ${ftIn(peak)}`} />
      {!widespan && <DimChip position={[0, clearance, 0]} text={`Clearance ${ftIn(clearance)}`} />}
      <DimChip position={[0, height - 0.4, 0]} text={`Eave ${ftIn(height)}`} />
    </group>
  )
}

// ── Wall direction labels ─────────────────────────────────────────────────────
function WallChip({ position, text, color = '#fff' }) {
  return (
    <Html position={position} center occlude={false}>
      <div style={{
        color,
        fontSize: '10px',
        fontFamily: 'sans-serif',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        background: 'rgba(0,0,0,0.48)',
        padding: '2px 6px',
        borderRadius: '3px',
        pointerEvents: 'none',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {text}
      </div>
    </Html>
  )
}

function DirectionLabels({ width, length, height }) {
  const hw  = width / 2
  const hl  = length / 2
  const mid = height * 0.55
  return (
    <group>
      <WallChip position={[0,         mid, -(hl + 2)]} text="Front" color="#88ccff" />
      <WallChip position={[0,         mid,   hl + 2]}  text="Back"  color="#88ccff" />
      <WallChip position={[-(hw + 2), mid, 0]}          text="Left"  color="#aaffaa" />
      <WallChip position={[ hw + 2,   mid, 0]}          text="Right" color="#aaffaa" />
    </group>
  )
}

// ── Foot-by-foot perimeter markers ────────────────────────────────────────────
function FootMarkers({ width, length }) {
  const hw = width / 2
  const hl = length / 2

  const marks = []

  for (let x = -hw; x <= hw + 0.01; x++) {
    const major = Math.round(x) % 5 === 0
    marks.push(
      <mesh key={`fx${x}`} position={[x, major ? 0.2 : 0.1, -hl]} castShadow={false}>
        <boxGeometry args={[0.04, major ? 0.4 : 0.2, 0.04]} />
        <meshBasicMaterial color={major ? '#ffffff' : '#aaaaaa'} />
      </mesh>
    )
    if (major) marks.push(
      <Html key={`fxl${x}`} position={[x, 0.5, -hl]} center occlude={false}>
        <div style={{ fontSize: '8px', color: '#fff', fontFamily: 'monospace', pointerEvents: 'none', background: 'rgba(0,0,0,0.5)', padding: '0 3px', borderRadius: 2 }}>{Math.round(x + hw)}′</div>
      </Html>
    )
  }

  for (let x = -hw; x <= hw + 0.01; x++) {
    const major = Math.round(x) % 5 === 0
    marks.push(
      <mesh key={`bx${x}`} position={[x, major ? 0.2 : 0.1, hl]}>
        <boxGeometry args={[0.04, major ? 0.4 : 0.2, 0.04]} />
        <meshBasicMaterial color={major ? '#ffffff' : '#aaaaaa'} />
      </mesh>
    )
  }

  for (let z = -hl; z <= hl + 0.01; z++) {
    const major = Math.round(z) % 5 === 0
    marks.push(
      <mesh key={`lz${z}`} position={[-hw, major ? 0.2 : 0.1, z]}>
        <boxGeometry args={[0.04, major ? 0.4 : 0.2, 0.04]} />
        <meshBasicMaterial color={major ? '#ffffff' : '#aaaaaa'} />
      </mesh>
    )
    if (major) marks.push(
      <Html key={`lzl${z}`} position={[-hw - 0.4, 0.5, z]} center occlude={false}>
        <div style={{ fontSize: '8px', color: '#fff', fontFamily: 'monospace', pointerEvents: 'none', background: 'rgba(0,0,0,0.5)', padding: '0 3px', borderRadius: 2 }}>{Math.round(z + hl)}′</div>
      </Html>
    )
  }

  for (let z = -hl; z <= hl + 0.01; z++) {
    const major = Math.round(z) % 5 === 0
    marks.push(
      <mesh key={`rz${z}`} position={[hw, major ? 0.2 : 0.1, z]}>
        <boxGeometry args={[0.04, major ? 0.4 : 0.2, 0.04]} />
        <meshBasicMaterial color={major ? '#ffffff' : '#aaaaaa'} />
      </mesh>
    )
  }

  return <group>{marks}</group>
}

// ── Component part-name callouts ──────────────────────────────────────────────
function PartChip({ position, text, head = false }) {
  return (
    <Html position={position} center occlude={false} zIndexRange={[100, 0]}>
      <div style={{
        background: head ? 'rgba(2,132,199,0.95)' : 'rgba(245,158,11,0.92)',
        color: head ? '#fff' : '#1a1a1a',
        fontSize: head ? '11px' : '9.5px',
        fontFamily: 'sans-serif',
        fontWeight: head ? 800 : 700,
        letterSpacing: head ? '0.02em' : 0,
        padding: head ? '2px 8px' : '1px 5px',
        borderRadius: head ? '4px' : '3px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        border: '1px solid rgba(0,0,0,0.25)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }}>
        {text}
      </div>
    </Html>
  )
}

function PartLabels({ config }) {
  const { width, length, height, roofPitch, roofStyle, walls, doors } = config
  const hw   = width / 2
  const hl   = length / 2
  const rise = (width / 2) * Math.tan(Math.atan(roofPitch / 12))
  const ridge = height + rise
  const midSlopeY = height + rise * 0.5
  const structure = deriveStructure(config)

  const frontTrussZ = -hl
  const labels = []

  // Overall truss style — headline callout above the front truss peak.
  // >30′ = full triangulated truss (bottom chord + webs); ≤30′ = peak brace.
  const widespan = width > 30
  const webs = structure.webPanels - 1
  const trussStyle =
    roofStyle === 'regular'
      ? 'Rounded Bow Truss'
      : `A-Frame Truss · ` +
        (widespan ? `${webs} web${webs > 1 ? 's' : ''}/side` : 'peak brace')
  labels.push({ p: [0, ridge + 1.1, frontTrussZ], t: `▣ ${trussStyle}`, head: true })

  // Skin / cladding
  labels.push({ p: [-hw * 0.5, midSlopeY + 0.4, hl * 0.25], t: 'Roof Panel' })
  if (roofStyle !== 'regular') labels.push({ p: [0, ridge + 0.45, hl * 0.3], t: 'Ridge Cap' })
  labels.push({ p: [hw + 0.15, height + 0.4, -hl * 0.1], t: 'Eave Trim' })

  // Frame — anchored on the front truss so they read together
  labels.push({ p: [hw * 0.6, rafterAt(hw * 0.6), frontTrussZ], t: 'Rafter (Top Chord)' })
  if (widespan) {
    // Full triangulated truss: chord at eave height + king post + webs
    labels.push({ p: [-hw * 0.55, height + 0.05, frontTrussZ], t: 'Bottom Chord' })
    labels.push({ p: [0.35, (height + ridge) / 2, frontTrussZ], t: 'King Post' })
    labels.push({ p: [hw * 0.45, (height + rafterAt(hw * 0.45)) / 2, frontTrussZ], t: 'Truss Web' })
  } else {
    // Peak-brace collar (A-frame & regular). King post only at 30′+.
    const bcX = collarHalfX(width, hw)
    const bcY = height + rise * (1 - bcX / hw)
    labels.push({ p: [-bcX * 0.55, bcY + 0.05, frontTrussZ], t: 'Peak Brace' })
    if (width >= 30) labels.push({ p: [0.35, (bcY + ridge) / 2, frontTrussZ], t: 'King Post' })
  }
  labels.push({ p: [-hw + 1.1, height - 1.0, frontTrussZ], t: 'Knee Brace' })
  // Base rail — perimeter tube at the column feet
  labels.push({ p: [hw * 0.3, 0.3, hl * 0.55], t: 'Base Rail' })

  // Legs
  const legName = structure.legType === 'zigzag' ? 'ZigZag Leg'
                : structure.legType === 'ladder' ? 'Ladder Leg'
                : structure.legType === 'double' ? 'Double Leg' : 'Leg (Post)'
  labels.push({ p: [-hw, height * 0.42, -hl * 0.55], t: legName })

  // Secondary steel
  if (roofStyle === 'a_frame_vertical')
    labels.push({ p: [hw * 0.5, rafterAt(hw * 0.5) + 0.15, hl * 0.45], t: 'Purlin (Hat Channel)' })
  if (structure.bracing === 'diagonal')
    labels.push({ p: [hw, height * 0.5, -hl + 2.6], t: 'Diagonal Brace' })

  // Walls
  const closedWall = ['front', 'back', 'left', 'right'].find((w) => walls?.[w] && walls[w] !== 'open')
  if (closedWall) {
    const wp = closedWall === 'front' ? [0, height * 0.5, -hl - 0.1]
             : closedWall === 'back'  ? [0, height * 0.5, hl + 0.1]
             : closedWall === 'left'  ? [-hw - 0.1, height * 0.5, 0]
             : [hw + 0.1, height * 0.5, 0]
    labels.push({ p: wp, t: 'Wall Panel' })
    if (config.wainscotEnabled) labels.push({ p: [wp[0], 1.5, wp[2]], t: 'Wainscot' })
  }

  // Openings
  if (doors?.length) {
    const d = doors[0]
    const along = (d.xOffset - 0.5)
    const dp = d.wall === 'front' ? [along * width, d.height / 2, -hl - 0.15]
             : d.wall === 'back'  ? [along * width, d.height / 2, hl + 0.15]
             : d.wall === 'left'  ? [-hw - 0.15, d.height / 2, along * length]
             : [hw + 0.15, d.height / 2, along * length]
    labels.push({ p: dp, t: d.type === 'window' ? 'Window' : d.type === 'walk_in' ? 'Walk-In Door' : 'Roll-Up Door' })
  }

  function rafterAt(x) { return height + rise * (1 - Math.abs(x) / hw) }

  return (
    <group>
      {labels.map((l, i) => <PartChip key={i} position={l.p} text={l.t} head={l.head} />)}
    </group>
  )
}

// ── View preset overlay (HTML, sits above the canvas) ─────────────────────────
const VIEW_PRESETS = [
  { id: 'default',  label: '3/4'   },
  { id: 'front',    label: 'Front' },
  { id: 'left',     label: 'Side'  },
  { id: 'top',      label: 'Top'   },
  { id: 'interior', label: 'Int.'  },
]

function ViewPresetButtons() {
  const setField = useBuilderStore((s) => s.setField)
  const flyMode  = useBuilderStore((s) => s.flyMode)
  return (
    <div className="absolute top-3 right-3 flex flex-col gap-1 z-10 hidden sm:flex">
      <button
        onClick={() => setField('flyMode', !flyMode)}
        className={`rounded border px-2.5 py-1 text-[10px] font-semibold transition-colors backdrop-blur-sm ${
          flyMode
            ? 'bg-emerald-500/80 border-emerald-300 text-white'
            : 'bg-black/55 border-white/15 text-slate-300 hover:bg-black/75 hover:text-white'
        }`}
        title="Free-roam: drag to look, W/A/S/D move, E/Q up/down, Shift to sprint"
      >
        {flyMode ? '✓ Fly' : 'Fly'}
      </button>
      {VIEW_PRESETS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => setField('requestCameraPreset', id)}
          className="rounded bg-black/55 border border-white/15 px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:bg-black/75 hover:text-white transition-colors backdrop-blur-sm"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Main Canvas ───────────────────────────────────────────────────────────────
export default function BuilderCanvas() {
  const config = useBuilderStore()
  const {
    width, length, height,
    installationSurface,
    groundType,
    isDraggingDoor,
    flyMode,
    showDimensions,
    showFootMarkers,
    showLabels,
    siteMapEnabled,
    siteMap,
    isDraggingBuilding,
  } = config
  // Once a valid address has loaded (lat set / status ready). NOT gated on buildings
  // so rural/farmland lots still render. The satellite terrain and the OSM site
  // detail are INDEPENDENT: you can leave just the satellite with "Show site map"
  // off, or just the OSM massing with the satellite off.
  const siteLoaded = siteMap?.lat != null || siteMap?.status === 'ready'
  const satOn  = siteLoaded && config.terrainEnabled !== false && !!siteMap?.satUrl
  const siteOn = siteLoaded && siteMapEnabled          // OSM buildings / features

  // The yard follows the Scene "Ground Type" picker — INDEPENDENT of the building's
  // Installation Surface (slab/anchors), so you can place a concrete pad on a lawn.
  const yard = groundType ?? installationSurface
  const { pos: camPos, target: camTarget } = camFor(width, length, height)

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: camPos, fov: 42, near: 0.1, far: 2000 }}
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onPointerMissed={() => config.selectedEquipmentId && config.setField('selectedEquipmentId', null)}
      >
        <CameraController />
        <FlyController />

        {/* Dawn HDRI — the sky background AND the reflection environment for the
            metal panels (high-metalness steel renders black without a sky to
            reflect). Always on; there is no sky picker. */}
        <Suspense fallback={null}>
          <Environment files={DAWN_HDRI} background />
        </Suspense>

        {/* Lighting */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[60, 80, 40]}
          intensity={1.3}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-80}
          shadow-camera-right={80}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
          shadow-camera-far={300}
        />
        <directionalLight position={[-40, 40, -30]} intensity={0.35} />
        <hemisphereLight skyColor="#c8dff5" groundColor="#6a8a60" intensity={0.5} />

        {/* Ground — textured to the YARD ground type (independent of the building's
            installation surface). Rendered in every mode (incl. the 360 panorama) so
            the building sits on a real surface and has something to cast shadows onto;
            the panorama wraps the horizon above. SKIPPED when the satellite terrain is
            showing — the terrain patch IS the ground then, and a second near-coplanar
            plane would z-fight (flicker) and hide the aerial. */}
        {!satOn && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[600, 600]} />
            <meshStandardMaterial color="#ffffff" map={getGroundTexture(yard)} roughness={0.95} />
          </mesh>
        )}

        {/* Satellite + elevation terrain patch for the geocoded address */}
        {satOn && (
          <Suspense fallback={null}>
            <Terrain satUrl={siteMap.satUrl} elevM={siteMap.elevM} n={siteMap.gridN} radiusM={siteMap.radiusM ?? 250} />
          </Suspense>
        )}

        {/* Surrounding OSM buildings (site map) */}
        {siteOn && <SiteContext buildings={siteMap.buildings} radiusFt={(siteMap.radiusM ?? 250) * FT_PER_M} />}

        {/* Surrounding OSM greenery, roads, parking & fences */}
        {siteOn && <SiteFeatures site={siteMap} show={config.componentVisibility} />}

        {/* Procedural landscaping (trees / shrubs) — placed on the ground */}
        {config.componentVisibility?.landscaping !== false && <Landscaping />}

        {/* Scale-reference vehicles (cars / RVs / boats / planes …) — placed on the ground */}
        <Vehicles />

        {/* Building — wrapped so it can be dragged onto its lot in site-map mode */}
        <SitePlacement config={config} />

        {/* Overlays — follow the building's placement so labels stay attached on a site */}
        <group
          position={[config.buildingPlacement?.x ?? 0, 0, config.buildingPlacement?.z ?? 0]}
          rotation={[0, config.buildingPlacement?.rotation ?? 0, 0]}
        >
          {showDimensions && <DimensionLines width={width} length={length} height={height} roofPitch={config.roofPitch} roofStyle={config.roofStyle} />}
          {showDimensions && <DirectionLabels width={width} length={length} height={height} />}
          {showFootMarkers && <FootMarkers width={width} length={length} />}
          {showLabels && <PartLabels config={config} />}
        </group>

        <OrbitControls
          target={camTarget}
          minPolarAngle={0.05}
          maxPolarAngle={Math.PI * 0.88}   /* allow tilting below the eave to look UP at the base rail */
          minDistance={3}
          maxDistance={350}
          enablePan
          screenSpacePanning            /* pan moves the view straight up/down on screen */
          enableDamping
          dampingFactor={0.06}
          enabled={!isDraggingDoor && !flyMode && !isDraggingBuilding}
          makeDefault
        />
      </Canvas>

      {/* View preset buttons — floats over canvas top-right */}
      <ViewPresetButtons />

      {/* Free-roam controls hint */}
      {flyMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 rounded-md bg-black/70 border border-white/15 px-3 py-1.5 text-[10px] font-semibold text-slate-200 backdrop-blur-sm whitespace-nowrap">
          <span className="text-emerald-300">Free-roam:</span>{' '}
          drag to look · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move ·{' '}
          <kbd>E</kbd>/<kbd>Q</kbd> up·down · <kbd>Shift</kbd> sprint
        </div>
      )}
    </div>
  )
}
