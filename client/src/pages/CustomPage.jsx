import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SEOHead from '../components/ui/SEOHead'
import FadeIn from '../components/ui/FadeIn'
import { getCustomPage } from '../data/adminData'
import { useAdminTick } from '../hooks/useAdminTick'

// Renders custom / duplicated pages created in the admin (overlay), at /p/<slug>.
export default function CustomPage() {
  useAdminTick()
  const { slug } = useParams()
  const page = getCustomPage(slug)

  if (!page) {
    return (
      <div className="min-h-screen bg-white pt-32">
        <div className="container py-20 text-center">
          <h1 className="font-display text-4xl font-bold text-slate-900 mb-4">Page Not Found</h1>
          <p className="text-slate-500 mb-8">This page may have been moved or deleted.</p>
          <Link to="/" className="btn-primary"><ArrowLeft size={15} /> Back home</Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <SEOHead title={page.title1 || page.name} description={page.intro || ''} canonical={`/p/${slug}`} />
      <div className="min-h-screen bg-white pt-24">
        <div className="bg-slate-950">
          <div className="container py-16">
            {page.eyebrow && <span className="section-label-light">{page.eyebrow}</span>}
            <h1 className="font-display text-5xl lg:text-7xl font-bold text-white leading-none mt-1 mb-4">
              {page.title1}{page.title2 && <><br /><span className="text-brand">{page.title2}</span></>}
            </h1>
            {page.intro && <p className="text-base text-slate-400 max-w-xl leading-relaxed">{page.intro}</p>}
          </div>
        </div>
        {page.body && (
          <FadeIn>
            <div
              className="container py-12 max-w-3xl prose prose-slate prose-sm sm:prose max-w-none prose-headings:font-display prose-a:text-brand"
              dangerouslySetInnerHTML={{ __html: page.body }}
            />
          </FadeIn>
        )}
      </div>
    </>
  )
}
