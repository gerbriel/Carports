import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import ChatwootWidget from './components/ui/ChatwootWidget'
import PlausibleScript from './components/ui/PlausibleScript'
import DemoWidget from './components/ui/DemoWidget'
import { trackPageview } from './data/adminData'
import Home from './pages/Home'
import ServicesPage from './pages/ServicesPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import LoginPage from './pages/LoginPage'
import StatusPortalPage from './pages/StatusPortalPage'
import QuoteDocumentPage from './pages/QuoteDocumentPage'
import PackingListPage from './pages/PackingListPage'
import BlogListPage from './pages/BlogListPage'
import BlogPostPage from './pages/BlogPostPage'
import MetalCarportsPage from './pages/services/MetalCarportsPage'
import MetalGaragesPage from './pages/services/MetalGaragesPage'
import RVCoversPage from './pages/services/RVCoversPage'
import AgriculturalPage from './pages/services/AgriculturalPage'
import BoatStoragePage from './pages/services/BoatStoragePage'
import LocationsPage from './pages/LocationsPage'
import CityPage from './pages/CityPage'
import CustomPage from './pages/CustomPage'

// Lazy-load the 3D builder so Three.js (~800KB) is only fetched when needed
const BuilderPage = lazy(() => import('./pages/BuilderPage'))
// Admin demo dashboard — lazy so normal visitors never download it
const AdminDemoPage = lazy(() => import('./pages/AdminDemoPage'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    // Privacy-friendly, client-side analytics (no API). Skip the admin itself.
    if (!pathname.startsWith('/admin')) trackPageview(pathname)
  }, [pathname])
  return null
}

// Marketing site layout (Navbar + Footer). Mounted under the catch-all route so
// it never renders on /builder — which keeps the builder full-screen and avoids a
// second top-level <Routes> matching nothing.
function SiteLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* Services overview */}
          <Route path="/services" element={<ServicesPage />} />

          {/* Service sub-pages */}
          <Route path="/services/metal-carports" element={<MetalCarportsPage />} />
          <Route path="/services/metal-garages" element={<MetalGaragesPage />} />
          <Route path="/services/rv-covers" element={<RVCoversPage />} />
          <Route path="/services/agricultural-buildings" element={<AgriculturalPage />} />
          <Route path="/services/boat-storage" element={<BoatStoragePage />} />

          {/* Locations / service areas */}
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/locations/:citySlug" element={<CityPage />} />

          {/* Other pages */}
          <Route path="/about" element={<AboutPage />} />
          {/* "Book a Call" retired — send any old links to the contact / call-for-quote page */}
          <Route path="/book" element={<Navigate to="/contact" replace />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* Customer order/quote status lookup */}
          <Route path="/status" element={<StatusPortalPage />} />

          {/* Blog */}
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />

          {/* Custom / duplicated pages created in the admin */}
          <Route path="/p/:slug" element={<CustomPage />} />
        </Routes>
      </main>
      <Footer />
      <DemoWidget />
    </>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter
        basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ScrollToTop />

        <Routes>
          {/* 3D Builder — full-screen, no Navbar/Footer overlay */}
          <Route
            path="/builder"
            element={
              <Suspense fallback={
                <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center">
                  <div className="text-slate-400 text-sm">Loading 3D Builder…</div>
                </div>
              }>
                <BuilderPage />
              </Suspense>
            }
          />

          {/* White-label embed of the builder for a dealer's own site (?org=KEY) */}
          <Route
            path="/embed/builder"
            element={
              <Suspense fallback={
                <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center">
                  <div className="text-slate-400 text-sm">Loading builder…</div>
                </div>
              }>
                <BuilderPage />
              </Suspense>
            }
          />

          {/* Printable quote / purchase agreement for a quote/order */}
          <Route path="/quote/:quoteId" element={<QuoteDocumentPage />} />

          {/* Printable packing list / bill of materials */}
          <Route path="/packing/:quoteId" element={<PackingListPage />} />

          {/* Portal sign-in (simulated) — full-screen */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin demo dashboard — full-screen, no Navbar/Footer */}
          <Route
            path="/admin"
            element={
              <Suspense fallback={
                <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center">
                  <div className="text-slate-400 text-sm">Loading admin…</div>
                </div>
              }>
                <AdminDemoPage />
              </Suspense>
            }
          />

          {/* Everything else → marketing site layout */}
          <Route path="/*" element={<SiteLayout />} />
        </Routes>

        <ChatwootWidget />
        <PlausibleScript />
      </BrowserRouter>
    </HelmetProvider>
  )
}
