import { useParams, Link } from 'react-router-dom'
import { Calendar, Clock, Tag, ArrowLeft, ArrowRight } from 'lucide-react'
import SEOHead from '../components/ui/SEOHead'
import FadeIn from '../components/ui/FadeIn'
import { getPostBySlug } from '../data/blogPosts'

export default function BlogPostPage() {
  const { slug } = useParams()
  const post = getPostBySlug(slug)

  if (!post) {
    return (
      <div className="min-h-screen bg-white pt-32">
        <div className="container text-center py-20">
          <h1 className="font-display text-4xl font-bold text-slate-900 mb-4">Article Not Found</h1>
          <p className="text-slate-500 mb-8">This article may have been moved or deleted.</p>
          <Link to="/blog" className="btn-primary">
            <ArrowLeft size={15} /> Back to Blog
          </Link>
        </div>
      </div>
    )
  }

  const date = new Date(post.published_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  // Images are self-hosted under public/blog/; prefix the app base path (and swap
  // the %BASE% token used inside the post HTML).
  const featureUrl = post.feature_image ? `${import.meta.env.BASE_URL}${post.feature_image}` : ''
  const bodyHtml = (post.html || '').replace(/%BASE%/g, import.meta.env.BASE_URL)

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || '',
    image: featureUrl,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: {
      '@type': 'Organization',
      name: 'Quality Metal Carports Inc.',
      url: 'https://qualitymetalcarportsca.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Quality Metal Carports Inc.',
      logo: { '@type': 'ImageObject', url: 'https://qualitymetalcarportsca.com/wp-content/uploads/2024/08/Metal-Carports.png' },
    },
  }

  return (
    <>
      <SEOHead
        title={post.title}
        description={post.excerpt || post.title}
        canonical={`/blog/${slug}`}
        image={featureUrl}
        schemas={[articleSchema]}
        breadcrumbs={[
          { label: 'Blog', path: '/blog' },
          { label: post.title, path: `/blog/${slug}` },
        ]}
      />

      <div className="min-h-screen bg-white pt-24">
        {/* Feature image */}
        {post.feature_image && (
          <div className="h-56 sm:h-72 lg:h-[400px] overflow-hidden bg-slate-100">
            <img
              src={featureUrl}
              alt={post.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )}

        <div className="container py-12 max-w-3xl">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-2 text-xs text-slate-400">
            <Link to="/" className="hover:text-slate-600 transition-colors">Home</Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-slate-600 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-slate-500 truncate max-w-xs">{post.title}</span>
          </nav>

          {/* Tags */}
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {post.tags.map((tag) => (
                <span key={tag.id} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-brand">
                  <Tag size={10} />{tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <FadeIn>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-5">
              {post.title}
            </h1>
          </FadeIn>

          {/* Meta */}
          <FadeIn delay={60}>
            <div className="flex items-center gap-5 text-sm text-slate-400 mb-10 pb-8 border-b border-slate-100">
              <span className="flex items-center gap-1.5"><Calendar size={14} />{date}</span>
              {post.reading_time && (
                <span className="flex items-center gap-1.5"><Clock size={14} />{post.reading_time} min read</span>
              )}
            </div>
          </FadeIn>

          {/* Body — imported HTML from the legacy site (cleaned) */}
          <FadeIn delay={100}>
            <div
              className="prose prose-slate prose-sm sm:prose max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </FadeIn>

          {/* Bottom nav */}
          <div className="mt-16 pt-8 border-t border-slate-100 flex items-center justify-between gap-4">
            <Link to="/blog" className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand transition-colors">
              <ArrowLeft size={15} /> All Articles
            </Link>
            <Link to="/contact" className="btn-primary">
              Get a Free Quote <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
