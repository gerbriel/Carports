import { useReducer, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Factory, Store, ShieldCheck, Sparkles, UserRound, Search } from 'lucide-react'
import {
  getOrgs, getUsers, ROLES, setSession, roleScope, loadSampleData, MFR_ORG_ID,
} from '../data/adminData'

// Simulated login / account picker. Stands in for real auth: pick an account to
// "sign in" as that user (which drives every scoped view in /admin). The role
// switcher in the admin header does the same thing once you're in.
export default function LoginPage() {
  const navigate = useNavigate()
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    const h = () => force()
    window.addEventListener('qmc-admin-change', h)
    return () => window.removeEventListener('qmc-admin-change', h)
  }, [])

  const orgs = getOrgs()
  const users = getUsers()
  const dealerOrgs = orgs.filter((o) => o.kind === 'dealer')

  const signIn = (userId) => { setSession(userId); navigate('/admin') }

  const RoleTag = ({ role }) => (
    <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{ROLES[role]?.label || role}</span>
  )
  const UserButton = ({ u }) => (
    <button onClick={() => signIn(u.id)}
      className="group flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-brand/50 hover:bg-brand/5 transition-colors">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-bold text-brand-light">
        {(u.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{u.name}</span>
        <span className="block truncate text-xs text-slate-500">{u.email}</span>
      </span>
      <RoleTag role={u.role} />
    </button>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="container max-w-3xl py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white mb-8">
          <ArrowLeft size={15} /> Back to site
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2 text-brand-light mb-2"><ShieldCheck size={16} /><span className="text-xs font-semibold uppercase tracking-widest">Portal sign-in</span></div>
          <h1 className="font-display text-4xl font-bold text-white">Choose an account</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">
            This is a simulated login for the demo — pick who to sign in as. Quality Metal staff see every dealership and lead; a dealer sees only their own. You can switch accounts any time from the admin header.
          </p>
        </div>

        {/* Manufacturer */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3"><Factory size={15} className="text-brand" /><h2 className="text-sm font-semibold text-white">Quality Metal Carports (Manufacturer)</h2></div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {users.filter((u) => (u.orgId || MFR_ORG_ID) === MFR_ORG_ID && roleScope(u.role) === 'manufacturer').map((u) => <UserButton key={u.id} u={u} />)}
          </div>
        </section>

        {/* Dealerships */}
        {dealerOrgs.length > 0 ? (
          <section className="space-y-6">
            <div className="flex items-center gap-2"><Store size={15} className="text-brand" /><h2 className="text-sm font-semibold text-white">Dealerships</h2></div>
            {dealerOrgs.map((o) => (
              <div key={o.id}>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={13} className="text-slate-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{o.name}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {users.filter((u) => u.orgId === o.id).map((u) => <UserButton key={u.id} u={u} />)}
                </div>
              </div>
            ))}
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-white/12 p-6 text-center">
            <Sparkles size={22} className="mx-auto text-slate-500 mb-2" />
            <p className="text-sm text-slate-300">No dealerships yet.</p>
            <p className="mt-1 text-xs text-slate-500 mb-4">Load the sample data to spin up two demo dealerships, their salespeople, and some leads.</p>
            <button onClick={() => loadSampleData()} className="inline-flex items-center gap-1.5 rounded bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark transition-colors">
              <Sparkles size={14} /> Load sample data
            </button>
          </div>
        )}

        {/* Customer portal */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-sm text-slate-300"><UserRound size={15} className="text-slate-500" /> Are you a customer checking on an order?</div>
          <Link to="/status" className="inline-flex items-center gap-1.5 rounded border border-white/15 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-white/10">
            <Search size={14} /> Track my order
          </Link>
        </div>
      </div>
    </div>
  )
}
