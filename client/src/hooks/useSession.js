import { useEffect, useReducer } from 'react'
import {
  effectiveUser, getOrg, setSession, clearSession,
  roleScope, isManufacturerUser, isDealerUser, MFR_ORG_ID,
} from '../data/adminData'

// Reactive view of the simulated "logged-in" user. Re-renders whenever the
// session (or any admin data) changes. Designed to map onto real auth later:
// swap effectiveUser()/setSession() for a real auth provider and the shape holds.
export function useSession() {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    const h = () => force()
    window.addEventListener('qmc-admin-change', h)
    window.addEventListener('storage', h)
    return () => { window.removeEventListener('qmc-admin-change', h); window.removeEventListener('storage', h) }
  }, [])

  const user = effectiveUser()
  const org = user ? getOrg(user.orgId || MFR_ORG_ID) : null
  return {
    user,
    org,
    scope: roleScope(user?.role),
    isManufacturer: isManufacturerUser(user),
    isDealer: isDealerUser(user),
    login: (userId) => setSession(userId),
    logout: () => clearSession(),
  }
}
