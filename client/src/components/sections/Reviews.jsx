import { Star } from 'lucide-react'
import SectionHeader from '../ui/SectionHeader'
import FadeIn from '../ui/FadeIn'
// All reviews are bundled with the site (self-hosted, no API/fetch) so every one
// always shows. To add/edit reviews, edit this file and rebuild — or use
// `node server/scripts/add-review.mjs`, which writes to it.
import reviewsData from '../../data/reviews.json'

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}
        />
      ))}
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export default function Reviews() {
  const reviews = reviewsData.reviews
  const summary = { rating: reviewsData.rating ?? 5, total: reviewsData.total ?? reviews.length }

  // Build a seamless loop: repeat until one copy comfortably exceeds the viewport,
  // then duplicate it. Each card carries its own right margin so translateX(-50%)
  // lands exactly on the start of the second copy (no seam).
  let copy = reviews
  while (copy.length && copy.length < 12) copy = [...copy, ...reviews]
  const loop = [...copy, ...copy]
  const durationS = Math.max(copy.length * 6, 30)

  return (
    <section className="section bg-white" id="reviews">
      <div className="container">
        <SectionHeader
          label="Customer Reviews"
          title="What Our Clients Say"
          description="Real reviews from real customers across Fresno and Northern California."
        />

        {/* Summary bar */}
        <FadeIn>
          <div className="mb-10 flex flex-col sm:flex-row items-center justify-center gap-6 rounded-lg border border-slate-100 bg-slate-50 px-8 py-5">
            <div className="flex items-center gap-3">
              <GoogleLogo />
              <span className="font-sans font-semibold text-slate-700">Google Reviews</span>
            </div>
            <div className="hidden sm:block h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="font-display text-3xl font-bold text-slate-900">{summary.rating.toFixed(1)}</span>
              <StarRating rating={Math.round(summary.rating)} />
              <span className="text-sm text-slate-500">({summary.total} reviews)</span>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Continuously-rotating carousel (full width, pauses on hover) */}
      <FadeIn>
        <div className="reviews-carousel group relative overflow-hidden py-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent sm:w-24" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent sm:w-24" />
          <div className="reviews-track flex w-max" style={{ animationDuration: `${durationS}s` }}>
            {loop.map((review, i) => (
              <article
                key={i}
                aria-hidden={i >= copy.length}
                className="mr-6 flex h-64 w-[300px] shrink-0 flex-col rounded-lg border border-slate-100 bg-slate-50 p-6 sm:w-[340px]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <StarRating rating={review.rating} />
                  <GoogleLogo />
                </div>
                <p className="reviews-clamp flex-1 overflow-hidden text-sm italic leading-relaxed text-slate-600">
                  &ldquo;{review.text}&rdquo;
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{review.author}</div>
                    {review.location && <div className="text-xs text-slate-400">{review.location}</div>}
                  </div>
                  <div className="text-xs text-slate-400">{review.date}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </FadeIn>

      <style>{`
        .reviews-track {
          animation-name: reviews-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes reviews-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .reviews-carousel:hover .reviews-track { animation-play-state: paused; }
        .reviews-clamp {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 5;
        }
        @media (prefers-reduced-motion: reduce) {
          .reviews-track { animation: none; }
        }
      `}</style>
    </section>
  )
}
