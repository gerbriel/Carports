import { useState, useEffect } from 'react'

const GHOST_URL = import.meta.env.VITE_GHOST_URL || 'https://blog.qualitymetalcarportsca.com'
const GHOST_KEY = import.meta.env.VITE_GHOST_CONTENT_KEY

function buildUrl(path, params = {}) {
  if (!GHOST_KEY) return null
  const qs = new URLSearchParams({ key: GHOST_KEY, ...params }).toString()
  return `${GHOST_URL}/ghost/api/content/${path}?${qs}`
}

export function useGhostPosts({ limit = 12, tag = null, page = 1 } = {}) {
  const [posts, setPosts] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = {
      limit,
      page,
      include: 'tags,authors',
      fields: 'id,title,slug,excerpt,feature_image,published_at,reading_time',
    }
    if (tag) params.filter = `tag:${tag}`

    const url = buildUrl('posts/', params)
    if (!url) { setLoading(false); return }

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts || [])
        setMeta(data.meta || null)
        setLoading(false)
      })
      .catch((err) => { setError(err); setLoading(false) })
  }, [limit, tag, page])

  return { posts, meta, loading, error }
}

export function useGhostPost(slug) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slug) return
    const url = buildUrl(`posts/slug/${slug}/`, { include: 'tags,authors' })
    if (!url) { setLoading(false); return }

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setPost(data.posts?.[0] || null)
        setLoading(false)
      })
      .catch((err) => { setError(err); setLoading(false) })
  }, [slug])

  return { post, loading, error }
}
