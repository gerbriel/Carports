import * as THREE from 'three'

// Procedural ground textures so the slab/yard reads as a real surface, keyed to
// the installationSurface option. Cached per surface.

const rnd = (a, b) => a + Math.random() * (b - a)

function speckle(ctx, S, count, colors, rMin, rMax) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0]
    ctx.beginPath()
    ctx.arc(Math.random() * S, Math.random() * S, rnd(rMin, rMax), 0, Math.PI * 2)
    ctx.fill()
  }
}

function buildCanvas(surface) {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = S; cv.height = S
  const ctx = cv.getContext('2d')

  if (surface === 'concrete') {
    ctx.fillStyle = '#bdbdb6'; ctx.fillRect(0, 0, S, S)
    speckle(ctx, S, 1400, ['#b4b4ac', '#c6c6c0', '#aeaea6'], 0.6, 1.6)
    // faint control joints
    ctx.strokeStyle = 'rgba(120,120,116,0.5)'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke()
  } else if (surface === 'asphalt') {
    ctx.fillStyle = '#2f2f31'; ctx.fillRect(0, 0, S, S)
    speckle(ctx, S, 2600, ['#3a3a3c', '#262628', '#444446', '#202022'], 0.5, 1.3)
  } else if (surface === 'gravel') {
    ctx.fillStyle = '#8a7e70'; ctx.fillRect(0, 0, S, S)
    speckle(ctx, S, 2200, ['#9b8f80', '#766b5e', '#a89c8c', '#6a6258', '#b3a896'], 1.0, 2.6)
  } else {
    // grass (default 'ground')
    ctx.fillStyle = '#7fa05f'; ctx.fillRect(0, 0, S, S)
    speckle(ctx, S, 2400, ['#88aa64', '#6f9152', '#94b06e', '#5f8246', '#7a9c5a'], 0.8, 2.2)
    // a few brighter blades
    ctx.strokeStyle = 'rgba(150,180,110,0.5)'; ctx.lineWidth = 1
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * S, y = Math.random() * S
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rnd(-2, 2), y - rnd(2, 5)); ctx.stroke()
    }
  }
  return cv
}

const cache = {}
export function getGroundTexture(surface = 'ground') {
  if (!cache[surface]) {
    const t = new THREE.CanvasTexture(buildCanvas(surface))
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace   // render the canvas colors true-to-source
    t.needsUpdate = true
    // ~8 ft per tile over the 600 ft plane
    t.repeat.set(75, 75)
    cache[surface] = t
  }
  return cache[surface]
}
