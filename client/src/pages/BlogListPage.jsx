import { Link } from 'react-router-dom'
import { Calendar, Clock, Tag, ArrowRight, ExternalLink } from 'lucide-react'
import SEOHead from '../components/ui/SEOHead'
import FadeIn from '../components/ui/FadeIn'
import { useGhostPosts } from '../hooks/useGhostPosts'

const GHOST_ADMIN = import.meta.env.VITE_GHOST_URL
  ? `${import.meta.env.VITE_GHOST_URL}/ghost`
  : 'https://blog.qualitymetalcarportsca.com/ghost'

const PLACEHOLDER_POSTS = [
  {
    slug: '#',
    title: 'How to Choose the Right Roof Style for Your Metal Carport',
    excerpt: 'Standard, A-frame horizontal, and A-frame vertical roof styles each have trade-offs for cost, water runoff, and structural strength. Here\'s how to pick the right one for your property.',
    feature_image: 'https://qualitymetalcarportsca.com/wp-content/uploads/2026/01/strong-carport.jpg',
    published_at: '2025-10-15',
    reading_time: 4,
    tags: [{ name: 'Metal Carports' }],
  },
  {
    slug: '#',
    title: 'Do You Need a Permit for a Metal Carport in Fresno County?',
    excerpt: 'Permit requirements for metal carports and garages in Fresno County vary by structure size and jurisdiction. We break down what you need to know before your build.',
    feature_image: 'https://qualitymetalcarportsca.com/wp-content/uploads/2025/11/construction-of-metal-carpor.jpg',
    published_at: '2025-09-08',
    reading_time: 5,
    tags: [{ name: 'Permits & Process' }],
  },
  {
    slug: '#',
    title: 'What Size Metal Garage Do You Actually Need?',
    excerpt: 'Buying too small is the most common regret we hear. Here is how to size a garage around your vehicles, your projects, and the stuff that always seems to pile up.',
    feature_image: 'https://qualitymetalcarportsca.com/wp-content/uploads/2025/11/metal-buildings-in-ca.jpg',
    published_at: '2025-08-20',
    reading_time: 6,
    tags: [{ name: 'Metal Garages' }],
  },
  {
    slug: '#',
    title: '5 Reasons Central Valley Farmers Choose Metal Agricultural Buildings',
    excerpt: 'Metal barns are faster to build, lower maintenance, and more durable than wood-frame alternatives. Here\'s what Fresno-area farmers are saying about the switch.',
    feature_image: 'https://qualitymetalcarportsca.com/wp-content/uploads/2025/11/barn-in-mountains.jpg',
    published_at: '2025-07-14',
    reading_time: 5,
    tags: [{ name: 'Agricultural Buildings' }],
  },
  {
    slug: '#',
    title: 'What to Prepare Before Your Metal Building Installation Day',
    excerpt: 'A smooth installation day starts weeks before the crew arrives. Here\'s the site prep checklist our customers use to ensure everything goes without a hitch.',
    feature_image: 'https://qualitymetalcarportsca.com/wp-content/uploads/2025/11/carports-in-the-woods.jpg',
    published_at: '2025-06-30',
    reading_time: 4,
    tags: [{ name: 'Installation Tips' }],
  },
  {
    slug: '#',
    title: 'How to Protect Your RV From California\'s Extreme Summer Heat',
    excerpt: 'UV exposure is the leading cause of RV roof and gel coat degradation. A purpose-built metal RV cover can extend the life of your vehicle by years.',
    feature_image: 'https://qualitymetalcarportsca.com/wp-content/uploads/2025/10/carports-california.jpg',
    published_at: '2025-05-22',
    reading_time: 4,
    tags: [{ name: 'RV Covers' }],
  },
]

function PostCard({ post, index }) {
  const date = new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const isExternal = post.slug === '#'
  const CardLink = isExternal ? 'div' : Link
  const linkProps = isExternal ? {} : { to: `/blog/${post.slug}` }

  return (
    <FadeIn delay={index * 70}>
      <CardLink
        {...linkProps}
        className="group flex flex-col h-full rounded-lg border border-slate-100 bg-white overflow-hidden hover:border-slate-200 hover:shadow-md transition-all duration-200"
      >
        {post.feature_image && (
          <div className="aspect-[16/9] overflow-hidden bg-slate-100">
            <img
              src={post.feature_image}
              alt={post.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}
        <div className="flex flex-col flex-1 p-6">
          {post.tags?.[0] && (
            <div className="flex items-center gap-1.5 mb-3">
              <Tag size={11} className="text-brand" />
              <span className="text-xs font-semibold text-brand uppercase tracking-widest">{post.tags[0].name}</span>
            </div>
          )}
          <h2 className="font-display text-xl font-bold text-slate-900 mb-2 leading-snug group-hover:text-brand transition-colors">
            {post.title}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed flex-1 mb-4">{post.excerpt}</p>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Calendar size={11} />{date}</span>
              {post.reading_time && <span className="flex items-center gap-1"><Clock size={11} />{post.reading_time} min read</span>}
            </div>
            {!isExternal && (
              <span className="flex items-center gap-1 text-brand font-semibold group-hover:gap-2 transition-all">
                Read <ArrowRight size={12} />
              </span>
            )}
          </div>
        </div>
      </CardLink>
    </FadeIn>
  )
}

export default function BlogListPage() {
  const { posts: livePosts, loading } = useGhostPosts({ limit: 12 })
  const posts = livePosts.length ? livePosts : PLACEHOLDER_POSTS
  const usingPlaceholder = !livePosts.length

  return (
    <>
      <SEOHead
        title="Metal Building Tips, Guides & News"
        description="Expert advice on metal carports, garages, agricultural buildings, and steel structures in Fresno and Northern California. Permits, roof styles, sizing guides, and installation tips."
        canonical="/blog"
        schemas={[{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'Quality Metal Carports Blog',
          description: 'Expert tips and guides on metal building construction in California.',
          publisher: {
            '@type': 'Organization',
            name: 'Quality Metal Carports Inc.',
            url: 'https://qualitymetalcarportsca.com',
          },
        }]}
      />

      <div className="min-h-screen bg-white pt-24">
        {/* Header */}
        <div className="bg-slate-950">
          <div className="container py-14">
            <span className="section-label-light">Metal Building Tips &amp; Guides</span>
            <h1 className="font-display text-5xl lg:text-6xl font-bold text-white leading-none mt-1 mb-4">
              The QMC Blog
            </h1>
            <p className="text-base text-slate-400 max-w-xl leading-relaxed">
              Sizing guides, permit advice, roof style comparisons, installation tips, and more, all from a local California contractor who does this every day.
            </p>
          </div>
        </div>

        <div className="container section">
          {usingPlaceholder && (
            <FadeIn>
              <div className="mb-10 rounded-lg border border-brand/20 bg-brand/5 px-5 py-4 flex items-center justify-between gap-4">
                <p className="text-sm text-slate-600">
                  Showing sample articles. To publish real posts, connect your self-hosted Ghost instance.
                </p>
                <a
                  href={GHOST_ADMIN}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark transition-colors"
                >
                  <ExternalLink size={12} />
                  Open Ghost Admin
                </a>
              </div>
            </FadeIn>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <PostCard key={post.slug + i} post={post} index={i} />
            ))}
          </div>

          {loading && (
            <div className="text-center py-12 text-sm text-slate-400">Loading posts...</div>
          )}
        </div>
      </div>
    </>
  )
}
