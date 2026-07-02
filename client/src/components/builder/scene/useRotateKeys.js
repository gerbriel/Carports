import { useEffect, useRef } from 'react'
import { useBuilderStore } from '../../../store/builderStore'

// Keyboard rotation for the currently-selected scene object — works at ANY zoom,
// so you don't have to fly back in to reach the tiny floating rotate buttons.
//
//   Q / ←  rotate counter-clockwise      E / →  rotate clockwise
//   plain = 15° per press · Shift = 45°
//
// Each selectable (vehicle, landscaping prop, staged equipment, the building) calls
// this with `active` = "I am the selected thing"; selections are mutually exclusive
// in the store so only one listener fires. Skipped while typing in an input and in
// fly mode (fly uses Q/E to rise/descend).
const FINE   = Math.PI / 12   // 15°
const COARSE = Math.PI / 4    // 45° with Shift

export function useRotateKeys(active, onRotate) {
  const cb = useRef(onRotate); cb.current = onRotate
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (useBuilderStore.getState().flyMode) return
      const k = e.key.toLowerCase()
      const dir = (k === 'q' || k === 'arrowleft') ? 1 : (k === 'e' || k === 'arrowright') ? -1 : 0
      if (!dir) return
      e.preventDefault()
      cb.current(dir * (e.shiftKey ? COARSE : FINE))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}
