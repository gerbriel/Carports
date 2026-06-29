import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

// Self-propelled electric scissor lift — Genie GS-style blue, raised on a stacked
// X-pattern scissor stack with a railed work platform. Built to match the site
// equipment (Telehandler / DeliveryRig): procedural, feet-scale. Local frame:
// +X forward (drive/steer end), +Y up, +Z left; wheels on the ground, origin at
// ground level centred between the axles.

const C = {
  body:  '#2c7fb8',   // Genie blue (matches the telehandler)
  bodyD: '#1c5e8e',
  tire:  '#202225',
  rim:   '#c8ccd2',
  dark:  '#2b2e33',
  arm:   '#9aa1aa',   // galvanized scissor arms
  deck:  '#3c3f44',   // platform deck plate
  kick:  '#f4c020',   // yellow toe-board / kick plate
  amber: '#ffb020',
}

// Painted parts get an automotive CLEAR-COAT so they reflect the sky/HDRI like real
// equipment paint. `flat` opts a part out (rubber / rough plastic).
function RBox({ args, radius = 0.1, position, rotation, color, metalness = 0.3, roughness = 0.45, material, flat = false }) {
  return (
    <RoundedBox args={args} radius={Math.min(radius, Math.min(...args) / 2 - 0.001)} smoothness={4}
      position={position} rotation={rotation} castShadow receiveShadow>
      {material ?? (flat
        ? <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} envMapIntensity={0.5} />
        : <meshPhysicalMaterial color={color} metalness={metalness} roughness={roughness}
            clearcoat={0.85} clearcoatRoughness={0.18} envMapIntensity={1.15} />)}
    </RoundedBox>
  )
}

export default function ScissorLift({ position = [0, 0, 0], rotation = [0, 0, 0], platformHeight = 12.2 }) {
  const RT = 0.72, TW = 0.7                 // tyre radius / width (solid cushion tyres)
  const ay = RT                             // axle height
  const baseL = 8.0, baseW = 3.0
  const fA = 2.9, rA = -2.9                  // wheel axle X positions
  const trk = baseW / 2 - 0.25               // track half-width
  const baseTop = 1.95                       // chassis top — scissors mount here

  // ── Scissor stack: N stacked X's sharing outer pivots, two parallel planes ──
  const N      = 4
  const spread = 1.25                        // half horizontal opening of each X
  const zArm   = 1.05                        // each scissor plane offset off centre
  const h      = (platformHeight - baseTop) / N
  const stages = useMemo(() => Array.from({ length: N }, (_, k) => baseTop + k * h), [h])

  const armMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: C.arm, metalness: 0.8, roughness: 0.32, envMapIntensity: 1.2 }), [])
  const pinMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: C.dark, metalness: 0.7, roughness: 0.4, envMapIntensity: 0.9 }), [])
  const chrome  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8dadf', metalness: 1.0, roughness: 0.12, envMapIntensity: 1.6 }), [])
  const tyreMat = useMemo(() => new THREE.MeshStandardMaterial({ color: C.tire, roughness: 0.85, metalness: 0.1 }), [])

  // One scissor bar between two points (x,y) in the lift's X–Y plane, at depth z.
  const Bar = ({ a, b, z }) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    return (
      <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]} rotation={[0, 0, Math.atan2(dy, dx)]} material={armMat} castShadow>
        <boxGeometry args={[len, 0.42, 0.14]} />
      </mesh>
    )
  }
  // Cross-axle pin spanning the two scissor planes (the pivot rods you can see).
  const Pin = ({ x, y }) => (
    <mesh position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={pinMat} castShadow>
      <cylinderGeometry args={[0.1, 0.1, zArm * 2 + 0.3, 12]} />
    </mesh>
  )

  const wheels = [[fA, trk], [fA, -trk], [rA, trk], [rA, -trk]]
  const railH  = 3.7
  const deckY  = platformHeight
  const platL  = 7.4, platW = 3.0
  const railTopY = deckY + 0.3 + railH

  return (
    <group position={position} rotation={rotation}>
      {/* ── Solid cushion tyres + rims ── */}
      {wheels.map(([x, z], i) => (
        <group key={i} position={[x, ay, z]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={tyreMat} castShadow><cylinderGeometry args={[RT, RT, TW, 24]} /></mesh>
          <mesh position={[0, z > 0 ? 0.03 : -0.03, 0]}>
            <cylinderGeometry args={[RT * 0.5, RT * 0.5, TW + 0.05, 18]} />
            <meshStandardMaterial color={C.rim} metalness={0.9} roughness={0.24} envMapIntensity={1.4} />
          </mesh>
        </group>
      ))}

      {/* ── Chassis: low deck that carries the battery pack + drive ── */}
      <RBox args={[baseL, 1.5, baseW]} radius={0.22} position={[0, ay + 0.45, 0]} color={C.body} />
      <RBox args={[baseL - 0.6, 0.7, baseW + 0.2]} radius={0.12} position={[0, ay - 0.05, 0]} color={C.dark} roughness={0.6} />
      {/* battery / hydraulic module slung under the deck */}
      <RBox args={[3.4, 1.0, baseW - 0.3]} radius={0.12} position={[1.2, baseTop - 0.35, 0]} color={C.bodyD} />
      {/* pothole-protection bars along the sills */}
      {[trk + 0.35, -(trk + 0.35)].map((z, i) => (
        <RBox key={`pp${i}`} args={[baseL - 1.2, 0.22, 0.18]} radius={0.06} position={[0, ay - 0.5, z]} color={C.dark} roughness={0.6} />
      ))}

      {/* ── Scissor stack (both planes) ── */}
      {[zArm, -zArm].map((z) => (
        <group key={`s${z}`}>
          {stages.map((y0, k) => {
            const y1 = y0 + h
            return (
              <group key={k}>
                <Bar a={[-spread, y0]} b={[spread, y1]} z={z} />
                <Bar a={[spread, y0]}  b={[-spread, y1]} z={z} />
              </group>
            )
          })}
        </group>
      ))}
      {/* centre pivot axle of each X */}
      {stages.map((y0, k) => <Pin key={`pc${k}`} x={0} y={y0 + h / 2} />)}
      {/* outer pivot axles at each shared level (base → platform) */}
      {Array.from({ length: N + 1 }, (_, k) => baseTop + k * h).map((y, k) => (
        <group key={`po${k}`}>
          <Pin x={spread} y={y} /><Pin x={-spread} y={y} />
        </group>
      ))}
      {/* hydraulic lift cylinder pushing the lowest arms */}
      <mesh position={[0.0, baseTop + h * 0.55, 0]} rotation={[0, 0, 1.15]} material={chrome} castShadow>
        <cylinderGeometry args={[0.12, 0.12, h * 1.5, 12]} />
      </mesh>
      <mesh position={[-0.35, baseTop + h * 0.3, 0]} rotation={[0, 0, 1.15]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, h * 0.9, 12]} />
        <meshStandardMaterial color={C.bodyD} metalness={0.4} roughness={0.4} />
      </mesh>

      {/* ── Work platform: deck + perimeter guardrail + toe-boards ── */}
      <group position={[0, deckY, 0]}>
        <RBox args={[platL, 0.3, platW]} radius={0.06} position={[0, 0.15, 0]} color={C.deck} roughness={0.55} />
        {/* toe-boards (yellow kick plate) — [x, z, [w,h,d]] */}
        {[[0, platW / 2 - 0.06, [platL, 0.45, 0.1]],
          [0, -(platW / 2 - 0.06), [platL, 0.45, 0.1]],
          [platL / 2 - 0.06, 0, [0.1, 0.45, platW]],
          [-(platL / 2 - 0.06), 0, [0.1, 0.45, platW]]].map(([x, z, sz], i) => (
          <mesh key={`tb${i}`} position={[x, 0.52, z]} castShadow>
            <boxGeometry args={sz} />
            <meshStandardMaterial color={C.kick} metalness={0.2} roughness={0.6} />
          </mesh>
        ))}
        {/* corner + mid posts */}
        {[[platL / 2 - 0.1, platW / 2 - 0.1], [platL / 2 - 0.1, -(platW / 2 - 0.1)],
          [-(platL / 2 - 0.1), platW / 2 - 0.1], [-(platL / 2 - 0.1), -(platW / 2 - 0.1)],
          [0, platW / 2 - 0.1], [0, -(platW / 2 - 0.1)]].map(([x, z], i) => (
          <RBox key={`pst${i}`} args={[0.14, railH, 0.14]} radius={0.04} position={[x, 0.3 + railH / 2, z]} color={C.body} />
        ))}
        {/* top + mid rails on all four sides */}
        {[0.55, 1.0].map((f, ri) => {
          const ry = 0.3 + railH * f
          return (
            <group key={`r${ri}`}>
              <RBox args={[platL, 0.1, 0.1]} radius={0.04} position={[0, ry, platW / 2 - 0.1]} color={C.body} />
              <RBox args={[platL, 0.1, 0.1]} radius={0.04} position={[0, ry, -(platW / 2 - 0.1)]} color={C.body} />
              <RBox args={[0.1, 0.1, platW]} radius={0.04} position={[platL / 2 - 0.1, ry, 0]} color={C.body} />
              <RBox args={[0.1, 0.1, platW]} radius={0.04} position={[-(platL / 2 - 0.1), ry, 0]} color={C.body} />
            </group>
          )
        })}
        {/* control box on the rail */}
        <RBox args={[0.7, 0.5, 1.0]} radius={0.08} position={[platL / 2 - 0.5, 0.3 + railH * 0.7, 0]} color={C.dark} roughness={0.5} />
      </group>
    </group>
  )
}
