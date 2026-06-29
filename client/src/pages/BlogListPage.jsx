import { Link } from 'react-router-dom'
import { Calendar, Clock, Tag, ArrowRight } from 'lucide-react'
import SEOHead from '../components/ui/SEOHead'
import FadeIn from '../components/ui/FadeIn'
import { BLOG_POSTS } from '../data/blogPosts'

function PostCard({ post, index }) {
  const date = new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <FadeIn delay={index * 70}>
      <Link
        to={`/blog/${post.slug}`}
        className="group flex flex-col h-full rounded-lg border border-slate-100 bg-white overflow-hidden hover:border-slate-200 hover:shadow-md transition-all duration-200"
      >
        {post.feature_image && (
          <div className="aspect-[16/9] overflow-hidden bg-slate-100">
            <img
              src={`${import.meta.env.BASE_URL}${post.feature_image}`}
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
            <span className="flex items-center gap-1 text-brand font-semibold group-hover:gap-2 transition-all">
              Read <ArrowRight size={12} />
            </span>
          </div>
        </div>
      </Link>
    </FadeIn>
  )
}

export default function BlogListPage() {
  const posts = BLOG_POSTS

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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <PostCard key={post.slug + i} post={post} index={i} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
