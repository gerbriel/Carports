#!/usr/bin/env bash
# One-time setup for the self-hosted Photon geocoder with the NATIONWIDE-US index.
# Downloads the latest Photon jar (GitHub) + the prebuilt USA search index
# (GraphHopper mirror, ~10 GB compressed — resumable), verifies the md5, and
# extracts it here as ./photon_data. Start the service with ./run-photon.sh.
#
# Version pairing (per download1.graphhopper.com/public): Photon 1.x jars use the
# "photon-db-…-1.0-latest" dumps. If a future Photon 2.x lands, check that page
# for the matching dump label before upgrading the jar.
set -euo pipefail
cd "$(dirname "$0")"

DB_BASE="https://download1.graphhopper.com/public/north-america/usa"
DB_FILE="photon-db-usa-1.0-latest.tar.bz2"

# ── 1. Latest Photon 1.x jar from the GitHub release page ───────────────────────
JAR_URL="$(curl -fsSL https://api.github.com/repos/komoot/photon/releases/latest \
  | grep -oE '"browser_download_url": *"[^"]*photon-[0-9.]+\.jar"' | head -1 | grep -oE 'https[^"]+')"
JAR="$(basename "$JAR_URL")"
case "$JAR" in photon-1.*.jar) ;; *) echo "Latest jar is $JAR (not 1.x) — check the dump pairing note above." >&2; exit 1;; esac
echo "Photon jar:  $JAR"
echo "US index:    $DB_BASE/$DB_FILE (~10 GB)"
[ -f "$JAR" ] || curl -fL -o "$JAR" "$JAR_URL"

# ── 2. Download the index (resumable: safe to re-run after an interruption) ─────
curl -fL -C - -o "$DB_FILE" "$DB_BASE/$DB_FILE" || {
  # curl exits 22/416 when the file is already complete and the server won't resume
  echo "(download already complete or resume refused — verifying md5 next)"; }

# ── 3. Verify md5 (mirror publishes "<md5>  <dated filename>") ──────────────────
WANT="$(curl -fsSL "$DB_BASE/$DB_FILE.md5" | awk '{print $1}')"
GOT="$(md5 -q "$DB_FILE" 2>/dev/null || md5sum "$DB_FILE" | awk '{print $1}')"
if [ -n "$WANT" ] && [ "$WANT" != "$GOT" ]; then
  echo "md5 MISMATCH (want $WANT, got $GOT) — delete $DB_FILE and re-run." >&2
  exit 1
fi
echo "md5 OK."

# ── 4. Extract → ./photon_data (pbzip2 if available: multi-core, much faster) ───
if [ ! -d photon_data ]; then
  echo "Extracting (~10 GB bz2 — this takes a while)…"
  if command -v pbzip2 >/dev/null 2>&1; then
    pbzip2 -cd "$DB_FILE" | tar x
  else
    tar -xjf "$DB_FILE"
  fi
fi
[ -d photon_data ] || { echo "Extraction did not produce photon_data/ — inspect $DB_FILE." >&2; exit 1; }

echo
echo "Done. Start the geocoder with:  ./run-photon.sh"
echo "Then in the app's .env:         GEOCODER=photon"
echo "                                GEOCODER_URL=http://localhost:2322"
