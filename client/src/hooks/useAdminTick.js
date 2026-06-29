import { useEffect, useReducer } from 'react'

// Re-render a component whenever the admin overlay (localStorage) changes, so
// edits made in the admin dashboard reflect on the public site live.
export function useAdminTick() {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    const h = () => force()
    window.addEventListener('qmc-admin-change', h)
    window.addEventListener('storage', h)
    return () => {
      window.removeEventListener('qmc-admin-change', h)
      window.removeEventListener('storage', h)
    }
  }, [])
}
