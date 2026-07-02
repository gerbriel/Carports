#!/usr/bin/env bash
# Launch the self-hosted Photon geocoder (nationwide-US index) on :2322.
# One-time setup is scripted in setup-photon.sh; this just starts the service.
#   Usage: ./run-photon.sh [heap]   e.g. ./run-photon.sh 6g
set -euo pipefail
cd "$(dirname "$0")"

HEAP="${1:-4g}"
JAR="$(ls -1 photon-*.jar 2>/dev/null | sort -V | tail -1 || true)"
[ -z "$JAR" ] && { echo "No photon-*.jar here — run setup-photon.sh first." >&2; exit 1; }
[ -d photon_data ] || { echo "No photon_data/ index here — run setup-photon.sh first." >&2; exit 1; }

# Photon needs Java 21+. Homebrew's OpenJDK isn't linked into /usr/bin by
# default, so prefer it explicitly over the macOS stub.
for j in /opt/homebrew/opt/openjdk/bin/java /usr/local/opt/openjdk/bin/java java; do
  command -v "$j" >/dev/null 2>&1 && JAVA="$j" && break
done

# Photon 1.x: `serve` from the parent directory of photon_data (listens on :2322).
echo "Starting Photon ($JAR, heap $HEAP) on http://localhost:2322 …"
exec "$JAVA" -Xmx"$HEAP" -jar "$JAR" serve
