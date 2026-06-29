import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { buildSiteGeometryByKind } from './siteMap'

// Colour the surrounding OSM massing by building use, so a neighbourhood reads
// as houses vs. commercial vs. sheds/outbuildings rather than uniform grey.
const KIND_COLOR = {
  house:       '#c9b79c',  // warm tan
  commercial:  '#9fb0c4',  // cool steel
  outbuilding: '#b6a98f',  // muted khaki (sheds/garages/barns)
  other:       '#b9bcc4',  // neutral grey
  roof:        '#8a6f5e',  // pitched-roof caps on houses/outbuildings
}

// Renders the surrounding OpenStreetMap buildings as an extruded "massing model"
// around the origin (the geocoded address sits at 0,0), tinted by building kind.
export default function SiteContext({ buildings, radiusFt = 820 }) {
  const parts = useMemo(() => buildSiteGeometryByKind(buildings ?? []), [buildings])
  useEffect(() => () => parts.forEach((p) => p.geo.dispose()), [parts])
  if (!parts.length) return null
  return (
    <group>
      {parts.map(({ kind, geo }) => (
        <mesh key={kind} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial color={KIND_COLOR[kind] ?? KIND_COLOR.other} roughness={0.85} metalness={0.05} />
        </mesh>
      ))}
      {/* Subtle parcel ring so the loaded area reads as a "site" */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[radiusFt - 3, radiusFt, 96]} />
        <meshBasicMaterial color="#5a7898" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
