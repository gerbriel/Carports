# Onboarding & Setup

This product ships as a **white-label marketing site + 3D builder + admin dashboard**.
Everything works out of the box in **demo mode** (no backend, all in the browser).
When you're ready, connect each self-hosted service to take it live — one env key at a time.

Open the admin at **`/admin`** (or the bottom-right **Admin Demo** widget) → **Setup** tab
to see every module, its status (Demo / Live), and these same steps in-app.

---

## 1. Run it locally (demo mode — nothing to configure)

```bash
# Static site + admin (everything in the demo works with just this)
cd client && npm install && npm run dev      # http://localhost:5173

# Optional API server (only needed for the contact-form CRM sync + builder site map)
cd server && npm install && npm run dev      # http://localhost:4000
```

In demo mode: leads, quotes, designs, chat inbox, analytics, documents, social,
blog and reviews are all captured/edited in the browser (localStorage). Editing a
blog post or review in the admin updates the public site instantly.

---

## 2. White-label it

Set these in `client/.env`, then rebuild:

| Var | What |
|---|---|
| `VITE_BRAND_NAME` | Short name shown in the admin header (e.g. `Acme`) |
| `VITE_BRAND_FULL` | Full company name |

Replace `client/public/logo.png`, and the brand color in `client/tailwind.config.js`
(`brand`). The location/blog/review content lives in `client/src/data/`.

---

## 3. Deploy the static site

- **GitHub Pages** — already wired (`.github/workflows/deploy-pages.yml`); pushes to `main` auto-deploy.
- **Vercel** — import the repo (root `vercel.json` builds it). Best for clean URLs/SEO.

Both are static — the dynamic services below run separately (see step 4).

---

## 4. Connect the self-hosted services (go live)

All six are in `docker-compose.yml` (self-host) or available as cloud versions.
Bring up the stack, create the keys, set the env vars, restart/rebuild.

| Module | Service | Keys | Where |
|---|---|---|---|
| **CRM & Leads** | Twenty | `TWENTY_API_URL`, `TWENTY_API_KEY` | `server/.env` |
| **Live Chat** | Chatwoot | `VITE_CHATWOOT_WEBSITE_TOKEN`, `VITE_CHATWOOT_URL` | `client/.env` (rebuild) |
| **Analytics** | Plausible | `VITE_PLAUSIBLE_DOMAIN`, `VITE_PLAUSIBLE_URL` | `client/.env` (rebuild) |
| **Documents / e-Sign** | Documenso | `DOCUMENSO_API_URL`, `DOCUMENSO_API_KEY` | `server/.env` |
| **Social Scheduler** | Postiz | `POSTIZ_API_URL`, `POSTIZ_API_KEY` | `server/.env` |
| **Booking** | Cal.com | `VITE_CAL_URL` | `client/.env` (rebuild) |

Already-on, no service needed:
- **Blog / Reviews / Pages** — built-in; edit in the admin.
- **3D Builder site map** — free OpenStreetMap + Open-Elevation (optional `GOOGLE_PLACES_API_KEY` for Google geocoding).

**Plug-and-play right now (set the key + rebuild, no code):** Chatwoot, Plausible, Cal.com.
**Wire-up at go-live (deploy + connect the API):** Twenty, Documenso, Postiz — the admin
actions point at localStorage today; swap them for the service's API endpoint.

---

## 5. Make admin edits persist everywhere (Supabase)

Today the admin's data (leads, quotes, designs, blog/review edits) lives in the
browser via `client/src/data/adminData.js`. To persist across devices/users, create
the tables in **Supabase** and replace the `read()` / `write()` bodies in that one
file with Supabase calls. The dashboard, capture points, and site overlays don't change.
