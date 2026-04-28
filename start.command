#!/bin/zsh
set -e

cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install the LTS version from https://nodejs.org/ and run this again."
  read -r "?Press Return to close."
  exit 1
fi

PORT="${PORT:-3050}"
while command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  echo "Port ${PORT} is already in use; trying $((PORT + 1))."
  PORT=$((PORT + 1))
done

echo "Starting Markets & Newsflow Dashboard..."
echo "Open http://127.0.0.1:${PORT} in your browser."
echo "Press Control-C in this window to stop it."
echo

if command -v open >/dev/null 2>&1; then
  (sleep 1 && open "http://127.0.0.1:${PORT}") >/dev/null 2>&1 &
fi

PORT="$PORT" MARKETS_DASHBOARD_HOST="127.0.0.1" node server.js
