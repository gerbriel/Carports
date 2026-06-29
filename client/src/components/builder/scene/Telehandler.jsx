import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

// Telescopic-handler (telehandler) forklift — blue, boom raised with forks, à la
// Genie GTH / Skytrak. Rounded body panels (RoundedBox), treaded tyres, fenders,
// hydraulics, lights. Local frame: +X forward (forks/boom), +Y up, +Z left; wheels
// on the ground (origin at ground level, centred between the axles).

const C = {
  body:  '#2c7fb8',   // Genie-ish blue (semi-gloss paint)
  bodyD: '#1c5e8e',
  tire:  '#202225',
  rim:   '#c8ccd2',
  dark:  '#2b2e33',
  steel: '#7a818a',   // telescoping boom section
  fork:  '#3c3f44',
  glass: '#bcd6e6',
  amber: '#ffb020',
  lamp:  '#fff3c4',
}

// ── Off-road tyre tread (cached canvas texture, tiled around the carcass) ───────
let _tireTex
function tireTexture() {
  if (_tireTex) return _tireTex
  const s = 64
  const c = document.createElement('canvas'); c.width = s; c.height = s
  const g = c.getContext('2d')
  g.fillStyle = '#26282b'; g.fillRect(0, 0, s, s)
  g.fillStyle = '#0c0d0e'
  const chevron = (yoff) => {
    g.beginPath()
    g.moveTo(6, yoff); g.lineTo(32, yoff + 18); g.lineTo(58, yoff)
    g.lineTo(58, yoff + 9); g.lineTo(32, yoff + 27); g.lineTo(6, yoff + 9)
    g.closePath(); g.fill()
  }
  chevron(4); chevron(36)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(18, 2)
  t.anisotropy = 4
  return t
}

// Painted body panels get an automotive CLEAR-COAT (glossy reflective topcoat over
// the base paint) so they catch the sky/HDRI like real machinery, instead of a flat
// matte box. `flat` opts a part out (rough plastic / rubber bits).
function RBox({ args, radius = 0.12, position, rotation, color, metalness = 0.3, roughness = 0.45, flat = false }) {
  return (
    <RoundedBox args={args} radius={Math.min(radius, Math.min(...args) / 2 - 0.001)} smoothness={4}
      position={position} rotation={rotation} castShadow receiveShadow>
      {flat
        ? <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} envMapIntensity={0.5} />
        : <meshPhysicalMaterial color={color} metalness={metalness} roughness={roughness}
            clearcoat={0.85} clearcoatRoughness={0.18} envMapIntensity={1.15} />}
    </RoundedBox>
  )
}

export default function Telehandler({ position = [0, 0, 0], rotation = [0, 0, 0], boomAngle = 0.5, boomExtend = 3 }) {
  const RT = 1.65, TW = 1.45            // tyre radius / width
  const ay = RT
  const fA = 4.0, rA = -4.4, trk = 2.5
  const θ = boomAngle, cθ = Math.cos(θ), sθ = Math.sin(θ)
  const piv = [rA + 0.2, ay + 2.7, -0.9]
  const al = (s) => [piv[0] + cθ * s, piv[1] + sθ * s, piv[2]]
  const BL = 12, EL = 10, extStart = BL * 0.5
  const tip = al(extStart + EL + boomExtend)

  const tyreMats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ map: tireTexture(), color: '#41444a', roughness: 0.96, metalness: 0.05 })
    const cap  = new THREE.MeshStandardMaterial({ color: C.tire, roughness: 0.9, metalness: 0.05 })
    return [side, cap, cap]
  }, [])
  const chrome = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8dadf', metalness: 1.0, roughness: 0.12, envMapIntensity: 1.6 }), [])

  const wheels = [[fA, trk], [fA, -trk], [rA, trk], [rA, -trk]]

  return (
    <group position={position} rotation={rotation}>
      {/* ── Wheels (treaded tyre + rim + hub + lug bolts) ── */}
      {wheels.map(([x, z], i) => (
        <group key={i} position={[x, ay, z]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow material={tyreMats}>
            <cylinderGeometry args={[RT, RT, TW, 30]} />
          </mesh>
          <mesh position={[0, z > 0 ? 0.04 : -0.04, 0]}>
            <cylinderGeometry args={[RT * 0.54, RT * 0.54, TW + 0.06, 22]} />
            <meshStandardMaterial color={C.rim} metalness={0.9} roughness={0.24} envMapIntensity={1.4} />
          </mesh>
          <mesh position={[0, z > 0 ? 0.08 : -0.08, 0]}>
            <cylinderGeometry args={[RT * 0.2, RT * 0.2, TW + 0.12, 12]} />
            <meshStandardMaterial color={C.dark} metalness={0.5} roughness={0.5} />
          </mesh>
          {Array.from({ length: 6 }, (_, k) => {
            const a = (k / 6) * Math.PI * 2, r = RT * 0.36
            return (
              <mesh key={k} position={[Math.cos(a) * r, (z > 0 ? 0.09 : -0.09), Math.sin(a) * r]}>
                <cylinderGeometry args={[0.07, 0.07, TW + 0.14, 6]} />
                <meshStandardMaterial color="#86888d" metalness={0.7} roughness={0.4} />
              </mesh>
            )
          })}
        </group>
      ))}

      {/* ── Wheel-arch fenders ── */}
      {wheels.map(([x, z], i) => (
        <mesh key={`f${i}`} position={[x, ay + 0.05, z]} rotation={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[RT + 0.28, RT + 0.28, TW + 0.5, 18, 1, true, Math.PI * 0.06, Math.PI * 0.88]} />
          <meshStandardMaterial color={C.dark} side={THREE.DoubleSide} roughness={0.6} metalness={0.2} />
        </mesh>
      ))}

      {/* ── Chassis / lower body ── */}
      <RBox args={[10.6, 2.0, 3.7]} radius={0.35} position={[-0.4, ay + 0.25, 0]} color={C.body} />
      <RBox args={[9.4, 1.0, 4.9]} radius={0.2} position={[-0.4, ay - 0.15, 0]} color={C.dark} roughness={0.6} />
      {/* belly skid + side sills */}
      <RBox args={[8.0, 0.5, 4.2]} radius={0.15} position={[-0.4, ay - 0.55, 0]} color={C.bodyD} />

      {/* ── Rear engine hood (sloped + louvres) + counterweight ── */}
      <RBox args={[3.0, 2.3, 4.3]} radius={0.4} position={[rA - 0.5, ay + 1.55, 0]} color={C.body} />
      <RBox args={[1.2, 1.6, 4.4]} radius={0.35} position={[rA - 1.7, ay + 2.0, 0]} color={C.body} />
      <RBox args={[0.7, 2.8, 4.6]} radius={0.2} position={[rA - 2.05, ay + 0.7, 0]} color={C.dark} roughness={0.7} />
      {/* louvre slits */}
      {[-1.3, -0.6, 0.1, 0.8].map((z, i) => (
        <mesh key={`lv${i}`} position={[rA - 1.95, ay + 0.7 + i * 0.0, z]}><boxGeometry args={[0.05, 1.8, 0.12]} /><meshStandardMaterial color="#15171a" /></mesh>
      ))}
      {/* exhaust stack */}
      <mesh position={[rA + 0.4, ay + 3.0, -1.7]} castShadow><cylinderGeometry args={[0.16, 0.16, 1.4, 12]} /><meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.5} /></mesh>

      {/* ── Boom pivot riser ── */}
      <RBox args={[2.6, 3.0, 1.7]} radius={0.3} position={[rA + 0.3, ay + 1.9, -0.9]} color={C.body} />

      {/* ── Boom: tapered base + telescoping steel section ── */}
      <RBox args={[BL, 1.25, 1.35]} radius={0.28} position={al(BL / 2)} rotation={[0, 0, θ]} color={C.body} />
      <RBox args={[EL, 0.95, 1.05]} radius={0.22} position={al(extStart + EL / 2 + boomExtend)} rotation={[0, 0, θ]} color={C.steel} metalness={0.5} roughness={0.4} />
      {/* hydraulic lift cylinder: chrome rod + coloured barrel */}
      <mesh position={[piv[0] + cθ * 2.2 + 0.6, piv[1] + sθ * 2.2 - 1.6, -0.9]} rotation={[0, 0, θ * 0.45]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 4.2, 14]} />
        <meshStandardMaterial color={C.bodyD} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[piv[0] + cθ * 4.6 + 0.6, piv[1] + sθ * 4.6 - 1.2, -0.9]} rotation={[0, 0, θ * 0.7]} material={chrome}>
        <cylinderGeometry args={[0.13, 0.13, 3.2, 12]} />
      </mesh>

      {/* ── Carriage + forks (kept level) at the boom tip ── */}
      <group position={tip}>
        <RBox args={[0.4, 3.0, 3.4]} radius={0.08} position={[0.2, -0.3, 0]} color={C.dark} roughness={0.55} />
        <RBox args={[0.18, 2.4, 3.4]} radius={0.06} position={[0.0, 1.4, 0]} color={C.dark} roughness={0.55} />
        {[-1.2, -0.4, 0.4, 1.2].map((z, i) => <mesh key={i} position={[0.05, 1.4, z]} castShadow><boxGeometry args={[0.16, 2.3, 0.12]} /><meshStandardMaterial color={C.dark} roughness={0.55} /></mesh>)}
        {[0.8, -0.8].map((z, i) => (
          <group key={i}>
            <mesh position={[2.0, -1.55, z]} castShadow><boxGeometry args={[3.4, 0.2, 0.45]} /><meshStandardMaterial color={C.fork} metalness={0.4} roughness={0.5} /></mesh>
            <mesh position={[0.35, -0.85, z]} castShadow><boxGeometry args={[0.2, 1.6, 0.45]} /><meshStandardMaterial color={C.fork} metalness={0.4} roughness={0.5} /></mesh>
          </group>
        ))}
      </group>

      {/* ── Cab (rounded ROPS + tinted glass + details) on the LEFT (z+) ── */}
      <group position={[0.6, ay + 1.2, 1.05]}>
        {/* tinted glass cab — smooth, reflective automotive glazing */}
        <RoundedBox args={[3.8, 3.4, 2.8]} radius={0.25} smoothness={4} position={[0, 2.0, 0]} castShadow>
          <meshPhysicalMaterial color={C.glass} transparent opacity={0.38} roughness={0.04} metalness={0} ior={1.45} envMapIntensity={2.0} />
        </RoundedBox>
        {/* roof + base */}
        <RBox args={[4.2, 0.28, 3.05]} radius={0.12} position={[0, 3.85, 0]} color={C.dark} roughness={0.5} />
        <RBox args={[3.9, 1.7, 2.85]} radius={0.2} position={[0, -1.6, 0]} color={C.body} />
        {/* ROPS posts */}
        {[[1.9, 1.4], [1.9, -1.4], [-1.9, 1.4], [-1.9, -1.4]].map(([x, z], i) => (
          <mesh key={i} position={[x, 2.0, z]} castShadow><boxGeometry args={[0.16, 3.6, 0.16]} /><meshStandardMaterial color={C.dark} metalness={0.3} roughness={0.5} /></mesh>
        ))}
        {/* amber beacon */}
        <mesh position={[1.6, 4.15, 1.1]}><cylinderGeometry args={[0.12, 0.12, 0.22, 10]} /><meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={0.6} /></mesh>
        {/* wing mirror */}
        <mesh position={[2.0, 2.8, 1.7]}><boxGeometry args={[0.1, 0.5, 0.35]} /><meshStandardMaterial color={C.dark} /></mesh>
      </group>

      {/* ── Front headlights ── */}
      {[1.2, -1.2].map((z, i) => (
        <mesh key={`hl${i}`} position={[fA + 1.7, ay + 0.6, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.2, 14]} />
          <meshStandardMaterial color={C.lamp} emissive={C.lamp} emissiveIntensity={0.45} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}
