#!/bin/bash
# Start both Flask API and React dev server together
# Usage: ./run.sh

cd "$(dirname "$0")"

echo "Starting Fitit (Flask API + React dev server)..."
echo "  API  → http://localhost:5001"
echo "  UI   → http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

source venv/bin/activate

# Start Flask in background
FLASK_APP=app.py flask run --port 5001 &
FLASK_PID=$!

# Start Vite dev server in foreground
cd frontend && npm run dev

# On exit, kill Flask too
kill $FLASK_PID 2>/dev/null
