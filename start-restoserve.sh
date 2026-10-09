#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js LTS and npm are required. Install them, then run this script again."
  exit 1
fi

if [ ! -f node_modules/wrangler/bin/wrangler.js ]; then
  echo "First-time setup: installing RestoServe's local runtime. Internet is needed once."
  npm ci
fi

export CI=1
echo "Preparing this computer's local database. It does not connect to the hosted site."
npm run db:local
echo "RestoServe is starting. When Wrangler prints its local URL, open http://localhost:8787 in your browser."
echo "Keep this terminal open while using RestoServe. Press Ctrl+C to stop it."
npm run dev
