import { useEffect } from 'react'

const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN
const SRC = import.meta.env.VITE_PLAUSIBLE_URL
  ? `${String(import.meta.env.VITE_PLAUSIBLE_URL).replace(/\/$/, '')}/js/script.js`
  : 'https://plausible.io/js/script.js'

// Loads the real Plausible analytics script when VITE_PLAUSIBLE_DOMAIN is set.
// Until then, the admin's built-in client-side analytics covers the demo.
export default function PlausibleScript() {
  useEffect(() => {
    if (!DOMAIN || document.getElementById('plausible-script')) return
    const s = document.createElement('script')
    s.id = 'plausible-script'
    s.defer = true
    s.setAttribute('data-domain', DOMAIN)
    s.src = SRC
    document.head.appendChild(s)
  }, [])
  return null
}
