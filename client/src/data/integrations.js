// ─────────────────────────────────────────────────────────────────────────────
// White-label onboarding config.
//
// Each entry is a module shown in the admin "Setup" tab: what it does, whether
// it's running in DEMO mode (works now, local) or is LIVE (connected to a real
// service), the env keys to set, and the plug-and-play steps to take it live.
// Client-side keys (VITE_*) are auto-detected; server-side keys are noted.
// ─────────────────────────────────────────────────────────────────────────────

// White-label: set VITE_BRAND_NAME / VITE_BRAND_FULL to rebrand the admin.
export const BRAND = import.meta.env.VITE_BRAND_NAME || 'QMC'
export const BRAND_FULL = import.meta.env.VITE_BRAND_FULL || 'Quality Metal Carports'

const env = (k) => import.meta.env[k]

export const INTEGRATIONS = [
  {
    id: 'crm', name: 'CRM & Leads', service: 'Twenty', icon: 'Inbox',
    summary: 'Sync contact-form leads, quotes & pipeline into a real CRM.',
    demo: 'Leads & quotes are captured in the admin (stored in this browser).',
    keys: ['TWENTY_API_URL', 'TWENTY_API_KEY'], where: 'server/.env',
    mode: () => 'demo',
    steps: [
      'Deploy Twenty (it’s in docker-compose.yml) or use Twenty Cloud.',
      'In Twenty → Settings → APIs & Webhooks, generate an API key.',
      'Add TWENTY_API_URL and TWENTY_API_KEY to server/.env, then restart the API server.',
      'Done — contact-form submissions now sync to Twenty automatically (POST /api/leads).',
    ],
    link: 'https://twenty.com',
  },
  {
    id: 'chat', name: 'Live Chat', service: 'Chatwoot', icon: 'MessageSquare',
    summary: 'A chat bubble on the site; conversations land in your inbox.',
    demo: 'The admin Inbox is a local preview of agent conversations.',
    keys: ['VITE_CHATWOOT_WEBSITE_TOKEN', 'VITE_CHATWOOT_URL'], where: 'client/.env (rebuild after)',
    mode: () => (env('VITE_CHATWOOT_WEBSITE_TOKEN') ? 'live' : 'demo'),
    steps: [
      'Deploy Chatwoot (in docker-compose.yml) or use Chatwoot Cloud.',
      'Create a “Website” inbox and copy its Website Token.',
      'Set VITE_CHATWOOT_WEBSITE_TOKEN (and VITE_CHATWOOT_URL) in client/.env.',
      'Rebuild the client — the chat widget goes live; agents reply inside Chatwoot.',
    ],
    link: 'https://www.chatwoot.com',
  },
  {
    id: 'analytics', name: 'Analytics', service: 'Plausible', icon: 'BarChart3',
    summary: 'Privacy-friendly, cookieless traffic analytics.',
    demo: 'The Analytics tab already tracks page views (this browser).',
    keys: ['VITE_PLAUSIBLE_DOMAIN', 'VITE_PLAUSIBLE_URL'], where: 'client/.env (rebuild after)',
    mode: () => (env('VITE_PLAUSIBLE_DOMAIN') ? 'live' : 'demo'),
    steps: [
      'Deploy Plausible (in docker-compose.yml) or use Plausible Cloud.',
      'Add your site’s domain in Plausible.',
      'Set VITE_PLAUSIBLE_DOMAIN (and VITE_PLAUSIBLE_URL if self-hosted) in client/.env.',
      'Rebuild — the Plausible script auto-loads and reports real, server-side stats.',
    ],
    link: 'https://plausible.io',
  },
  {
    id: 'docs', name: 'Documents & e-Sign', service: 'Documenso', icon: 'PenSquare',
    summary: 'Send quotes & agreements for legally-binding e-signature.',
    demo: 'The Documents tab is a local create → send → sign workflow.',
    keys: ['DOCUMENSO_API_URL', 'DOCUMENSO_API_KEY'], where: 'server/.env',
    mode: () => 'demo',
    steps: [
      'Deploy Documenso (in docker-compose.yml) or use Documenso Cloud.',
      'Create an API key in Documenso.',
      'Add DOCUMENSO_API_URL and DOCUMENSO_API_KEY to server/.env.',
      'Connect the “New document” action to the Documenso API to send real signature requests.',
    ],
    link: 'https://documenso.com',
  },
  {
    id: 'social', name: 'Social Scheduler', service: 'Postiz', icon: 'Share2',
    summary: 'Schedule posts across Instagram, Facebook, X & LinkedIn.',
    demo: 'The Social tab is a local composer + scheduled queue.',
    keys: ['POSTIZ_API_URL', 'POSTIZ_API_KEY'], where: 'server/.env',
    mode: () => 'demo',
    steps: [
      'Deploy Postiz (in docker-compose.yml) or use Postiz Cloud.',
      'Connect your social accounts inside Postiz.',
      'Add POSTIZ_API_URL and POSTIZ_API_KEY to server/.env.',
      'Point the Social “Schedule” action at Postiz to publish for real.',
    ],
    link: 'https://postiz.com',
  },
  {
    id: 'booking', name: 'Booking', service: 'Cal.com', icon: 'Calendar',
    summary: 'Let customers self-book a consultation or site visit.',
    demo: 'The “Book” link currently routes to the contact form.',
    keys: ['VITE_CAL_URL'], where: 'client/.env (rebuild after)',
    mode: () => (env('VITE_CAL_URL') ? 'live' : 'demo'),
    steps: [
      'Deploy Cal.com (in docker-compose.yml) or use Cal.com Cloud.',
      'Create an event type (e.g. “Free site visit”).',
      'Set VITE_CAL_URL in client/.env and embed it on a /book page.',
      'Rebuild — customers can self-schedule.',
    ],
    link: 'https://cal.com',
  },
  {
    id: 'content', name: 'Blog, Reviews & Pages', service: 'Built-in', icon: 'Newspaper',
    summary: 'Edit content in the admin — it updates the site instantly.',
    demo: 'Already on: edit Blog/Reviews in the admin (saved in this browser).',
    keys: [], where: '—',
    mode: () => 'live',
    steps: [
      'No service to deploy — content is built in (no separate CMS needed).',
      'Edit posts/reviews in the admin; changes appear on the public site instantly.',
      'At go-live, point the content store at your database (Supabase) to persist across devices.',
    ],
    link: '',
  },
  {
    id: 'maps', name: '3D Builder Site Map', service: 'OpenStreetMap', icon: 'Map',
    summary: 'Address → satellite, neighboring buildings & terrain in the builder.',
    demo: 'Uses free, key-free OpenStreetMap + Open-Elevation by default.',
    keys: ['GOOGLE_PLACES_API_KEY (optional)'], where: 'server/.env',
    mode: () => 'live',
    steps: [
      'Run the API server (server/) — geocoding & elevation work with no key.',
      'Optional: add GOOGLE_PLACES_API_KEY for Google-grade geocoding accuracy.',
    ],
    link: '',
  },
]
