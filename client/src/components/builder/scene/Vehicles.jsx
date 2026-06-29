import { useState } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useBuilderStore } from '../../../store/builderStore'

// ── Scale-reference vehicles ─────────────────────────────────────────────────
// Procedural low-poly vehicles built from primitive solids. EVERY dimension is in
// REAL-WORLD FEET so each model reads true-to-scale against the building (which is
// also modelled in feet) — letting a customer see how much room a build leaves for
// their car / RV / boat / etc. Length runs along the local X axis; each model's
// footprint is centred on the origin with its base on y = 0. The body `color` is
// user-editable; glass / tyres / trim use fixed shared materials.

const PAINT  = (color) => ({ color, roughness: 0.42, metalness: 0.45 })
const GLASS  = { color: '#16202b', roughness: 0.12, metalness: 0.6, transparent: true, opacity: 0.62 }
const DARK   = { color: '#26292d', roughness: 0.6, metalness: 0.35 }
const CHROME = { color: '#b8bcc2', roughness: 0.3, metalness: 0.85 }
const TIRE   = { color: '#141414', roughness: 0.92, metalness: 0 }
const HUBCAP = { color: '#9a9ea4', roughness: 0.35, metalness: 0.8 }

// One wheel — cylinder laid on its side (axis along Z, the width axis).
function Wheel({ x, z, y, r = 1.1, w = 0.7 }) {
  return (
    <group position={[x, y ?? r, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow><cylinderGeometry args={[r, r, w, 18]} /><meshStandardMaterial {...TIRE} /></mesh>
      <mesh position={[0, w / 2 + 0.01, 0]}><cylinderGeometry args={[r * 0.5, r * 0.5, 0.05, 14]} /><meshStandardMaterial {...HUBCAP} /></mesh>
    </group>
  )
}

// ── Models ───────────────────────────────────────────────────────────────────
function Sedan({ color }) {
  return (
    <group>
      <mesh position={[0, 1.85, 0]} castShadow><boxGeometry args={[13, 1.7, 5.6]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[-0.4, 3.0, 0]} castShadow><boxGeometry args={[7, 1.6, 5.1]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[-0.4, 2.95, 0]}><boxGeometry args={[5.2, 1.1, 5.25]} /><meshStandardMaterial {...GLASS} /></mesh>
      <mesh position={[6.45, 1.75, 0]}><boxGeometry args={[0.25, 0.8, 5.2]} /><meshStandardMaterial {...CHROME} /></mesh>
      <mesh position={[-6.45, 1.9, 0]}><boxGeometry args={[0.25, 0.6, 5.2]} /><meshStandardMaterial {...DARK} /></mesh>
      <Wheel x={4.3} z={2.5} /><Wheel x={4.3} z={-2.5} /><Wheel x={-4.3} z={2.5} /><Wheel x={-4.3} z={-2.5} />
    </group>
  )
}

function SUV({ color }) {
  return (
    <group>
      <mesh position={[0, 2.0, 0]} castShadow><boxGeometry args={[14, 2.0, 6.0]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[-1.0, 3.8, 0]} castShadow><boxGeometry args={[9.5, 1.9, 5.7]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[-1.0, 3.7, 0]}><boxGeometry args={[7.4, 1.3, 5.85]} /><meshStandardMaterial {...GLASS} /></mesh>
      {/* roof rails */}
      <mesh position={[-1.0, 4.85, 2.4]}><boxGeometry args={[8, 0.18, 0.18]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[-1.0, 4.85, -2.4]}><boxGeometry args={[8, 0.18, 0.18]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[7.0, 1.9, 0]}><boxGeometry args={[0.25, 0.9, 5.6]} /><meshStandardMaterial {...CHROME} /></mesh>
      <Wheel x={4.6} z={2.7} r={1.25} /><Wheel x={4.6} z={-2.7} r={1.25} /><Wheel x={-4.6} z={2.7} r={1.25} /><Wheel x={-4.6} z={-2.7} r={1.25} />
    </group>
  )
}

function Pickup({ color }) {
  return (
    <group>
      <mesh position={[0, 2.0, 0]} castShadow><boxGeometry args={[17, 1.9, 5.9]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      {/* cab (front) */}
      <mesh position={[3.0, 3.7, 0]} castShadow><boxGeometry args={[6, 2.0, 5.7]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[3.1, 3.65, 0]}><boxGeometry args={[4.4, 1.3, 5.85]} /><meshStandardMaterial {...GLASS} /></mesh>
      {/* bed walls (rear) */}
      <mesh position={[-5.2, 3.25, 2.75]} castShadow><boxGeometry args={[8.4, 1.1, 0.35]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[-5.2, 3.25, -2.75]} castShadow><boxGeometry args={[8.4, 1.1, 0.35]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[-9.2, 3.25, 0]} castShadow><boxGeometry args={[0.35, 1.1, 5.7]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[-1.2, 3.25, 0]} castShadow><boxGeometry args={[0.35, 1.1, 5.7]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[8.5, 1.8, 0]}><boxGeometry args={[0.25, 0.8, 5.5]} /><meshStandardMaterial {...CHROME} /></mesh>
      <Wheel x={5.4} z={2.85} r={1.3} /><Wheel x={5.4} z={-2.85} r={1.3} /><Wheel x={-5.4} z={2.85} r={1.3} /><Wheel x={-5.4} z={-2.85} r={1.3} />
    </group>
  )
}

function Van({ color }) {
  return (
    <group>
      <mesh position={[-1.5, 4.0, 0]} castShadow><boxGeometry args={[14, 5.2, 6.4]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      {/* sloped nose / hood */}
      <mesh position={[7.0, 2.3, 0]} castShadow><boxGeometry args={[3, 2.4, 6.3]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[7.3, 4.4, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.3, 2.2, 6.0]} /><meshStandardMaterial {...GLASS} /></mesh>
      <mesh position={[5.0, 4.4, 0]}><boxGeometry args={[3.4, 1.4, 6.5]} /><meshStandardMaterial {...GLASS} /></mesh>
      <mesh position={[8.6, 2.0, 0]}><boxGeometry args={[0.25, 0.8, 6.0]} /><meshStandardMaterial {...CHROME} /></mesh>
      <Wheel x={5.6} z={3.0} r={1.3} /><Wheel x={5.6} z={-3.0} r={1.3} /><Wheel x={-5.6} z={3.0} r={1.3} /><Wheel x={-5.6} z={-3.0} r={1.3} />
    </group>
  )
}

function BoxTruck({ color }) {
  return (
    <group>
      {/* box body */}
      <mesh position={[-2.5, 5.0, 0]} castShadow><boxGeometry args={[15, 7.0, 7.8]} /><meshStandardMaterial {...{ color: '#e9ebee', roughness: 0.6, metalness: 0.15 }} /></mesh>
      {/* cab */}
      <mesh position={[8.0, 2.9, 0]} castShadow><boxGeometry args={[5.5, 4.2, 7.6]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[10.7, 3.7, 0]}><boxGeometry args={[0.3, 1.7, 6.9]} /><meshStandardMaterial {...GLASS} /></mesh>
      <Wheel x={8.5} z={3.6} r={1.5} /><Wheel x={8.5} z={-3.6} r={1.5} />
      <Wheel x={-5.5} z={3.6} r={1.5} /><Wheel x={-5.5} z={-3.6} r={1.5} />
      <Wheel x={-8.0} z={3.6} r={1.5} /><Wheel x={-8.0} z={-3.6} r={1.5} />
    </group>
  )
}

function Semi({ color }) {
  const trailer = { color: '#dfe2e6', roughness: 0.55, metalness: 0.2 }
  return (
    <group>
      {/* trailer (rear) */}
      <mesh position={[-12, 6.6, 0]} castShadow><boxGeometry args={[33, 8.6, 8.0]} /><meshStandardMaterial {...trailer} /></mesh>
      {/* tractor cab */}
      <mesh position={[14, 4.6, 0]} castShadow><boxGeometry args={[7, 7.2, 7.8]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[19.5, 2.6, 0]} castShadow><boxGeometry args={[4, 3.0, 7.5]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[17.6, 5.6, 0]}><boxGeometry args={[0.3, 1.9, 7.0]} /><meshStandardMaterial {...GLASS} /></mesh>
      {/* exhaust stacks */}
      <mesh position={[11.2, 6.5, 3.2]}><cylinderGeometry args={[0.22, 0.22, 6, 10]} /><meshStandardMaterial {...CHROME} /></mesh>
      <mesh position={[11.2, 6.5, -3.2]}><cylinderGeometry args={[0.22, 0.22, 6, 10]} /><meshStandardMaterial {...CHROME} /></mesh>
      {/* steer + drive + trailer axles */}
      <Wheel x={19.5} z={3.6} r={1.6} /><Wheel x={19.5} z={-3.6} r={1.6} />
      {[12, 14.6].map((x) => <group key={x}><Wheel x={x} z={3.6} r={1.6} /><Wheel x={x} z={-3.6} r={1.6} /></group>)}
      {[-23, -25.6].map((x) => <group key={x}><Wheel x={x} z={3.6} r={1.6} /><Wheel x={x} z={-3.6} r={1.6} /></group>)}
    </group>
  )
}

function Bus({ color }) {
  return (
    <group>
      <mesh position={[0, 4.6, 0]} castShadow><boxGeometry args={[32, 6.6, 7.8]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[16.6, 2.7, 0]} castShadow><boxGeometry args={[2.5, 2.8, 7.6]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      {/* window strip */}
      <mesh position={[-0.5, 5.6, 0]}><boxGeometry args={[28, 1.7, 7.9]} /><meshStandardMaterial {...GLASS} /></mesh>
      <mesh position={[17.8, 5.0, 0]}><boxGeometry args={[0.3, 2.0, 7.2]} /><meshStandardMaterial {...GLASS} /></mesh>
      {/* bumper stripe */}
      <mesh position={[0, 1.6, 0]}><boxGeometry args={[32.2, 0.7, 7.85]} /><meshStandardMaterial {...DARK} /></mesh>
      <Wheel x={13} z={3.6} r={1.55} /><Wheel x={13} z={-3.6} r={1.55} /><Wheel x={-12} z={3.6} r={1.55} /><Wheel x={-12} z={-3.6} r={1.55} />
    </group>
  )
}

function RV({ color }) {
  return (
    <group>
      <mesh position={[-1, 5.4, 0]} castShadow><boxGeometry args={[27, 7.6, 8.2]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      {/* over-cab nose */}
      <mesh position={[12.5, 6.2, 0]} castShadow><boxGeometry args={[4, 4.0, 8.0]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[14.4, 3.6, 0]} rotation={[0, 0, -0.35]}><boxGeometry args={[0.3, 3.2, 7.4]} /><meshStandardMaterial {...GLASS} /></mesh>
      {/* accent stripe */}
      <mesh position={[-1, 4.0, 4.12]}><boxGeometry args={[26, 1.0, 0.08]} /><meshStandardMaterial {...{ color: '#9aa3ad', roughness: 0.5, metalness: 0.4 }} /></mesh>
      <mesh position={[-1, 4.0, -4.12]}><boxGeometry args={[26, 1.0, 0.08]} /><meshStandardMaterial {...{ color: '#9aa3ad', roughness: 0.5, metalness: 0.4 }} /></mesh>
      <Wheel x={10.5} z={3.9} r={1.55} /><Wheel x={10.5} z={-3.9} r={1.55} /><Wheel x={-10} z={3.9} r={1.55} /><Wheel x={-10} z={-3.9} r={1.55} />
    </group>
  )
}

function TravelTrailer({ color }) {
  return (
    <group>
      <mesh position={[-2, 4.6, 0]} castShadow><boxGeometry args={[18, 6.0, 7.8]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[-2, 5.2, 4.0]}><boxGeometry args={[8, 1.3, 0.1]} /><meshStandardMaterial {...GLASS} /></mesh>
      <mesh position={[-2, 5.2, -4.0]}><boxGeometry args={[8, 1.3, 0.1]} /><meshStandardMaterial {...GLASS} /></mesh>
      {/* A-frame tongue + coupler */}
      <mesh position={[9, 1.7, 0.6]} rotation={[0, 0.18, 0]}><boxGeometry args={[6, 0.3, 0.3]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[9, 1.7, -0.6]} rotation={[0, -0.18, 0]}><boxGeometry args={[6, 0.3, 0.3]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[11.8, 1.5, 0]}><sphereGeometry args={[0.4, 10, 10]} /><meshStandardMaterial {...CHROME} /></mesh>
      <mesh position={[7.5, 0.9, 0]}><cylinderGeometry args={[0.15, 0.15, 1.6, 8]} /><meshStandardMaterial {...DARK} /></mesh>
      <Wheel x={-1} z={3.95} r={1.3} /><Wheel x={-1} z={-3.95} r={1.3} />
    </group>
  )
}

function Boat({ color }) {
  return (
    <group>
      {/* hull body + pointed bow */}
      <mesh position={[-1, 5.0, 0]} castShadow><boxGeometry args={[13, 2.6, 6.4]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      <mesh position={[7.0, 5.0, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><boxGeometry args={[4.5, 2.6, 4.5]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      {/* cockpit + windshield */}
      <mesh position={[-2, 6.4, 0]}><boxGeometry args={[7, 0.6, 5.2]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[1.5, 7.0, 0]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.2, 1.6, 4.8]} /><meshStandardMaterial {...GLASS} /></mesh>
      {/* outboard motor */}
      <mesh position={[-8, 4.2, 0]}><boxGeometry args={[1.2, 2.6, 1.2]} /><meshStandardMaterial {...DARK} /></mesh>
      {/* trailer frame + tongue + wheels */}
      <mesh position={[-1, 3.4, 0]}><boxGeometry args={[18, 0.4, 0.4]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[10.5, 3.0, 0]} rotation={[0, 0, 0.2]}><boxGeometry args={[5, 0.35, 0.35]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[12.8, 2.4, 0]}><sphereGeometry args={[0.35, 8, 8]} /><meshStandardMaterial {...CHROME} /></mesh>
      <Wheel x={-3} z={3.4} r={1.1} /><Wheel x={-3} z={-3.4} r={1.1} />
    </group>
  )
}

function UtilityTrailer({ color }) {
  const rail = { color: '#3a3f44', roughness: 0.5, metalness: 0.5 }
  return (
    <group>
      {/* deck */}
      <mesh position={[0, 2.2, 0]} castShadow><boxGeometry args={[12, 0.5, 6.6]} /><meshStandardMaterial {...PAINT(color)} /></mesh>
      {/* side rails */}
      {[-5, -2.5, 0, 2.5, 5].map((x) => (
        <group key={x}>
          <mesh position={[x, 3.0, 3.2]}><boxGeometry args={[0.2, 1.4, 0.2]} /><meshStandardMaterial {...rail} /></mesh>
          <mesh position={[x, 3.0, -3.2]}><boxGeometry args={[0.2, 1.4, 0.2]} /><meshStandardMaterial {...rail} /></mesh>
        </group>
      ))}
      <mesh position={[0, 3.6, 3.2]}><boxGeometry args={[12, 0.2, 0.2]} /><meshStandardMaterial {...rail} /></mesh>
      <mesh position={[0, 3.6, -3.2]}><boxGeometry args={[12, 0.2, 0.2]} /><meshStandardMaterial {...rail} /></mesh>
      {/* tongue + coupler */}
      <mesh position={[8.5, 2.0, 0]}><boxGeometry args={[5, 0.35, 0.35]} /><meshStandardMaterial {...rail} /></mesh>
      <mesh position={[11.2, 1.9, 0]}><sphereGeometry args={[0.35, 8, 8]} /><meshStandardMaterial {...CHROME} /></mesh>
      <Wheel x={0} z={3.5} r={1.1} /><Wheel x={0} z={-3.5} r={1.1} />
    </group>
  )
}

function Plane({ color }) {
  const body = PAINT(color)
  return (
    <group>
      {/* fuselage (axis along X) + nose + tail boom */}
      <mesh position={[0, 5.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[1.5, 1.1, 14, 14] } /><meshStandardMaterial {...body} /></mesh>
      <mesh position={[7.5, 5.5, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow><coneGeometry args={[1.5, 3, 14]} /><meshStandardMaterial {...body} /></mesh>
      <mesh position={[-8, 5.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.6, 1.1, 6, 12]} /><meshStandardMaterial {...body} /></mesh>
      {/* cabin glass */}
      <mesh position={[2, 6.4, 0]}><boxGeometry args={[4, 1.4, 2.6]} /><meshStandardMaterial {...GLASS} /></mesh>
      {/* high wing (span along Z) */}
      <mesh position={[0.5, 7.0, 0]} castShadow><boxGeometry args={[4.5, 0.4, 36]} /><meshStandardMaterial {...body} /></mesh>
      <mesh position={[0.5, 6.4, 6]}><boxGeometry args={[0.25, 1.2, 0.25]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[0.5, 6.4, -6]}><boxGeometry args={[0.25, 1.2, 0.25]} /><meshStandardMaterial {...DARK} /></mesh>
      {/* tail: vertical + horizontal stabilisers */}
      <mesh position={[-10.5, 7.2, 0]} castShadow><boxGeometry args={[2.5, 3.2, 0.3]} /><meshStandardMaterial {...body} /></mesh>
      <mesh position={[-10.5, 6.0, 0]} castShadow><boxGeometry args={[2.2, 0.3, 12]} /><meshStandardMaterial {...body} /></mesh>
      {/* propeller */}
      <mesh position={[9.1, 5.5, 0]}><boxGeometry args={[0.15, 7, 0.5]} /><meshStandardMaterial {...DARK} /></mesh>
      <mesh position={[9.15, 5.5, 0]}><sphereGeometry args={[0.5, 8, 8]} /><meshStandardMaterial {...CHROME} /></mesh>
      {/* fixed tricycle gear */}
      <mesh position={[6, 2.0, 0]}><cylinderGeometry args={[0.12, 0.12, 4, 6]} /><meshStandardMaterial {...DARK} /></mesh>
      <Wheel x={6} z={0} y={0.9} r={0.8} w={0.5} />
      <Wheel x={-1} z={3.2} y={0.9} r={0.9} w={0.5} /><Wheel x={-1} z={-3.2} y={0.9} r={0.9} w={0.5} />
    </group>
  )
}

// Catalog — `l`/`w` (feet) drive the menu read-out + the selection ring size.
export const VEHICLE_TYPES = [
  { id: 'sedan',           label: 'Car / Sedan',     l: 15, w: 6,   color: '#b3322f' },
  { id: 'suv',             label: 'SUV',             l: 16, w: 6.5, color: '#2b3a4a' },
  { id: 'pickup',          label: 'Pickup Truck',    l: 19, w: 6.7, color: '#37506b' },
  { id: 'van',             label: 'Cargo Van',       l: 19, w: 6.8, color: '#e7e9ec' },
  { id: 'box_truck',       label: 'Box Truck',       l: 22, w: 8,   color: '#2f6b4f' },
  { id: 'semi',            label: 'Semi + Trailer',  l: 52, w: 8,   color: '#b3322f' },
  { id: 'bus',             label: 'Bus',             l: 35, w: 8,   color: '#f3c01b' },
  { id: 'rv',              label: 'RV / Motorhome',  l: 30, w: 8.5, color: '#e6e2d8' },
  { id: 'travel_trailer',  label: 'Travel Trailer',  l: 24, w: 8,   color: '#dde1e6' },
  { id: 'boat',            label: 'Boat + Trailer',  l: 24, w: 8,   color: '#f0f2f4' },
  { id: 'utility_trailer', label: 'Utility Trailer', l: 18, w: 7,   color: '#3a3f44' },
  { id: 'plane',           label: 'Small Plane',     l: 27, w: 36,  color: '#eef2f6' },
]

const RENDER = {
  sedan: Sedan, suv: SUV, pickup: Pickup, van: Van, box_truck: BoxTruck, semi: Semi,
  bus: Bus, rv: RV, travel_trailer: TravelTrailer, boat: Boat, utility_trailer: UtilityTrailer, plane: Plane,
}

export const vehicleMeta = (id) => VEHICLE_TYPES.find((v) => v.id === id)

// One placed vehicle — click to select / start drag.
function Vehicle({ item, selected, onSelect, onDragStart }) {
  const Body = RENDER[item.type] ?? Sedan
  const meta = vehicleMeta(item.type)
  const ringR = (Math.max(meta?.l ?? 16, meta?.w ?? 6) / 2) + 1.5
  return (
    <group
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotation ?? 0, 0]}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(item.id); onDragStart(item.id) }}
    >
      <Body color={item.color ?? '#c8ccd2'} />
      {selected && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringR, ringR + 0.7, 40]} />
          <meshBasicMaterial color="#00e0ff" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

export default function Vehicles() {
  const items         = useBuilderStore((s) => s.vehicles)
  const placing       = useBuilderStore((s) => s.placing)
  const placeVehicle  = useBuilderStore((s) => s.placeVehicle)
  const selectVehicle = useBuilderStore((s) => s.selectVehicle)
  const removeVehicle = useBuilderStore((s) => s.removeVehicle)
  const setVehiclePos = useBuilderStore((s) => s.setVehiclePos)
  const selectedId    = useBuilderStore((s) => s.selectedVehicleId)
  const setField      = useBuilderStore((s) => s.setField)

  const [dragId, setDragId] = useState(null)
  const placingVehicle = placing?.category === 'vehicle'

  const onDragStart = (id) => { setDragId(id); setField('isDraggingBuilding', true) }
  const onDragEnd   = () => { if (dragId != null) { setDragId(null); setField('isDraggingBuilding', false) } }

  const sel = items.find((v) => v.id === selectedId)

  return (
    <group>
      {items.map((item) => (
        <Vehicle key={item.id} item={item} selected={selectedId === item.id} onSelect={selectVehicle} onDragStart={onDragStart} />
      ))}

      {/* Click-to-place catch plane — only while placing a vehicle */}
      {placingVehicle && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => { e.stopPropagation(); placeVehicle(e.point.x, e.point.z) }}>
          <planeGeometry args={[800, 800]} />
          <meshBasicMaterial color="#3b9eff" transparent opacity={0.06} depthWrite={false} />
        </mesh>
      )}

      {/* Drag plane — active only while dragging a placed vehicle */}
      {dragId != null && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={(e) => { e.stopPropagation(); setVehiclePos(dragId, e.point.x, e.point.z) }}
          onPointerUp={(e) => { e.stopPropagation(); onDragEnd() }}
          onPointerLeave={() => onDragEnd()}>
          <planeGeometry args={[800, 800]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Floating controls above the selected vehicle: rotate 45° + delete */}
      {sel && dragId == null && (
        <Html position={[sel.x, 12, sel.z]} center occlude={false} zIndexRange={[120, 0]}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => useBuilderStore.getState().setVehicleField(sel.id, 'rotation', (sel.rotation ?? 0) + Math.PI / 4)}
              style={{ background: 'rgba(15,23,42,0.95)', color: '#bae6fd', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, fontSize: 10, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Rotate</button>
            <button
              onClick={() => removeVehicle(sel.id)}
              style={{ background: 'rgba(15,23,42,0.95)', color: '#fca5a5', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, fontSize: 10, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Delete</button>
          </div>
        </Html>
      )}
    </group>
  )
}
