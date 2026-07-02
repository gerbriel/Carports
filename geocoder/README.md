# Self-hosted geocoder (no third-party address data)

The 3-D builder's **"Place on a real address"** panel needs to turn text into a
lat/lng and to offer **type-ahead suggestions**. By default that data comes from a
third-party (Nominatim / optionally Google). To remove that dependency, run your own
geocoder over data you host and point the app at it — then **every** address lookup
and suggestion is served from your box, nothing leaves your network.

This scales nationwide: you import the whole US once, and it answers every query
locally.

```
browser ──► /api/geocode/suggest ─┐        ┌─► your geocoder (Pelias :4400 / Photon :2322)
browser ──► /api/geocode ─────────┤ server ┤   • suggestions  (type-ahead)
                                  └─────────┘   • final geocode (lat/lng)
```

The app is already wired for this. You only need to (1) stand up a geocoder and
(2) set two env vars. **No client or server code change is required.**

---

## 1. Wire the app to your geocoder

In `.env` (see `.env.example`):

```bash
# Pelias (recommended)
GEOCODER=pelias
GEOCODER_URL=http://localhost:4400     # note: NOT 4000 — that's this app's own server

# …or Photon
# GEOCODER=photon
# GEOCODER_URL=http://localhost:2322
```

Restart the app server. When `GEOCODER_URL` is set it becomes **authoritative** for
both `/geocode` and `/geocode/suggest` — the code no longer calls Google or the
public Nominatim. Unset it and you fall back to the previous behavior.

Verify:

```bash
curl "http://localhost:4000/api/geocode/suggest?q=11902%20N%20McGee%20Rd%20Coolidge"
curl "http://localhost:4000/api/geocode?q=11902%20N%20McGee%20Rd,%20Coolidge,%20AZ"
```

Both should return results sourced from your instance.

---

## 2a. Pelias (recommended)

Best US coverage: it merges **OpenAddresses** (house-number precision) with OSM,
Who's on First, and geonames, and ships a `/v1/autocomplete` endpoint built for
type-ahead. Deploy via the official Dockerized project:

```bash
git clone https://github.com/pelias/docker.git pelias
cd pelias
# put the `pelias` helper on your PATH (see that repo's README):
sudo ln -s "$(pwd)/pelias" /usr/local/bin/pelias

# Use an existing project as the base. `north-america` is the closest to
# "nationwide US"; trim its pelias.json imports to the US to shrink the build.
cd projects/north-america

pelias compose pull
pelias elastic start && pelias elastic wait && pelias elastic create
pelias download all        # OpenAddresses + OSM + WOF (this is the big/slow step)
pelias prepare all
pelias import all
pelias compose up
```

**Expose it on 4400, not 4000** (this app already uses 4000). In the project's
`docker-compose.yml`, map the api service to `4400:4000` (or set the host-port
variable the compose file references) so `GEOCODER_URL=http://localhost:4400` works.

Resources: a US/North-America build wants a real box — plan for **~8 GB+ RAM**
(Elasticsearch) and **tens of GB of disk**. The build runs once; queries afterward
are fast and fully local. Refresh by re-running `download → prepare → import` on a
schedule (e.g. monthly) to pick up new addresses.

Endpoints the app uses: `GET /v1/autocomplete?text=…&boundary.country=USA` (suggestions)
and `GET /v1/search?text=…&boundary.country=USA` (final geocode).

## 2b. Photon (lighter alternative — scripted here)

OSM-only (no OpenAddresses, so slightly thinner US house-number coverage) but a
single small Java service and excellent type-ahead. One `/api` endpoint serves both
suggestions and geocode. No Docker needed — just Java. This directory scripts it:

```bash
brew install openjdk        # once, if java isn't installed
./setup-photon.sh           # downloads the Photon jar + prebuilt NATIONWIDE-US
                            # index (~15–20 GB, resumable; verifies md5; extracts)
./run-photon.sh             # serves on :2322 (pass a heap size to override, e.g. 6g)
```

Then `GEOCODER=photon`, `GEOCODER_URL=http://localhost:2322`. Refresh the index by
deleting `photon_data/` + the tarball and re-running `setup-photon.sh` (GraphHopper
publishes updated US extracts). Build-your-own-index and full docs:
https://github.com/komoot/photon

---

## Notes

- **Response mapping** lives in `server/index.js` (`peliasToSuggestion` /
  `photonToSuggestion`): both are normalized to `{ label, lat, lng, street, city,
  state, zip }`, and results are scoped to the US. Pelias' `region_a` already gives
  the 2-letter state code; Photon returns full state names, mapped via
  `US_STATE_CODES`.
- Suggestions are **US-only** by design (`boundary.country=USA` / Photon country
  filter). Widen it in `selfHostedGeocode` if you ever serve outside the US.
- The browser has a last-resort public-Nominatim fallback (`siteMap.js`) that only
  fires if the app **server** is unreachable. In a normal deploy the server is up,
  so it never runs — but remove it if you want zero third-party code paths at all.
