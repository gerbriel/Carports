import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X, Phone, ChevronDown, Box, MapPin, Search } from 'lucide-react'
import GlobalSearch from '../ui/GlobalSearch'

const SERVICE_LINKS = [
  { label: 'Metal Carports', to: '/services/metal-carports' },
  { label: 'Metal Garages', to: '/services/metal-garages' },
  { label: 'RV Covers', to: '/services/rv-covers' },
  { label: 'Agricultural Buildings', to: '/services/agricultural-buildings' },
  { label: 'Boat Storage', to: '/services/boat-storage' },
]

const NAV_LINKS = [
  { label: 'Services', to: '/services', children: SERVICE_LINKS },
  { label: 'Locations', to: '/locations' },
  { label: 'About', to: '/about' },
  { label: 'Blog', to: '/blog' },
  { label: 'Contact', to: '/contact' },
]

function ServicesDropdown({ open }) {
  return (
    <div
      className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 rounded-lg border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60 overflow-hidden transition-all duration-200 ${
        open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
      }`}
    >
      <div className="py-1.5">
        <Link
          to="/services"
          className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-white transition-colors border-b border-slate-700/70 mb-1"
        >
          All Services
        </Link>
        {SERVICE_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="block px-4 py-2.5 text-sm font-medium text-slate-100 hover:text-white hover:bg-brand/20 transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <Link
          to="/locations"
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-white transition-colors border-t border-slate-700/70 mt-1"
        >
          <MapPin size={11} /> Service Areas
        </Link>
      </div>
    </div>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const servicesRef = useRef(null)
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setServicesOpen(false)
    setMobileServicesOpen(false)
    setSearchOpen(false)
  }, [pathname])

  // Cmd/Ctrl+K toggles global search from anywhere on the marketing site.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  useEffect(() => {
    function handleClickOutside(e) {
      if (servicesRef.current && !servicesRef.current.contains(e.target)) {
        setServicesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navBg = isHome
    ? scrolled
      ? 'bg-slate-950/95 backdrop-blur-md shadow-lg shadow-black/20'
      : 'bg-transparent'
    : 'bg-slate-950 shadow-lg shadow-black/20'

  const isServicesActive = pathname.startsWith('/services')

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
      <div className="container">
        <div className="flex h-18 items-center justify-between py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0" aria-label="Quality Metal Carports home">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Quality Metal Carports" className="h-10 w-auto" loading="eager" />
            <span className="hidden xl:block whitespace-nowrap text-[10px] font-medium uppercase tracking-widest text-slate-400">
              CA LIC# 1096004
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map((link) =>
              link.children ? (
                <div key={link.to} className="relative" ref={servicesRef}>
                  <button
                    onClick={() => setServicesOpen((v) => !v)}
                    className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded transition-colors duration-150 ${
                      isServicesActive || servicesOpen
                        ? 'text-white bg-white/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    {link.label}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <ServicesDropdown open={servicesOpen} />
                </div>
              ) : (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `px-4 py-2 text-sm font-medium rounded transition-colors duration-150 ${
                      isActive
                        ? 'text-white bg-white/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/8'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              )
            )}
          </nav>

          {/* Desktop right */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the site"
              className="flex items-center gap-2 px-3 py-2 rounded border border-white/20 text-xs font-medium text-slate-400 hover:border-white/40 hover:text-white transition-colors"
            >
              <Search size={14} />
              <span className="hidden xl:inline">Search</span>
              <kbd className="hidden xl:inline rounded border border-white/20 px-1 text-[10px] leading-tight text-slate-500">⌘K</kbd>
            </button>
            <Link
              to="/builder"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded border border-white/20 text-xs font-semibold text-slate-300 hover:border-white/40 hover:text-white transition-colors"
            >
              <Box size={13} />
              3D Builder
            </Link>
            <a
              href="tel:5597554900"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <Phone size={14} />
              559-755-4900
            </a>
            <Link to="/contact" className="btn-primary text-sm">
              Free Quote
            </Link>
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-1 lg:hidden">
            <button
              className="flex h-10 w-10 items-center justify-center rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the site"
            >
              <Search size={20} />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {/* Mobile drawer */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 bg-slate-950/98 backdrop-blur-md ${
          mobileOpen ? 'max-h-screen border-t border-white/10' : 'max-h-0'
        }`}
      >
        <nav className="container flex flex-col py-4 gap-0.5">
          {/* Services with sub-items */}
          <div>
            <button
              onClick={() => setMobileServicesOpen((v) => !v)}
              className={`flex w-full items-center justify-between px-4 py-3 text-sm font-medium rounded transition-colors ${
                isServicesActive ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/8'
              }`}
            >
              Services
              <ChevronDown size={14} className={`transition-transform duration-200 ${mobileServicesOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${mobileServicesOpen ? 'max-h-96' : 'max-h-0'}`}>
              <div className="pl-4 py-1 space-y-0.5">
                <Link to="/services" className="block px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-300">
                  All Services
                </Link>
                {SERVICE_LINKS.map((s) => (
                  <Link key={s.to} to={s.to} className="block px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {NAV_LINKS.filter((l) => !l.children).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-4 py-3 text-sm font-medium rounded transition-colors ${
                  isActive ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/8'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}

          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3">
            <Link
              to="/builder"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-300"
            >
              <Box size={14} />
              Open 3D Builder
            </Link>
            <a href="tel:5597554900" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300">
              <Phone size={14} />
              559-755-4900
            </a>
            <Link to="/contact" className="btn-primary mx-4 justify-center">
              Get a Free Quote
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
