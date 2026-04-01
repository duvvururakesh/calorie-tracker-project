#!/bin/bash
# One command, one server: http://localhost:5001
cd "$(dirname "$0")"

source venv/bin/activate

# Build once first so Flask has something to serve
echo "Building frontend..."
cd frontend && npm run build -- --logLevel silent
cd ..

echo ""
echo "Starting Fitit → http://localhost:5001"
echo "Press Ctrl+C to stop."
echo ""

# Watch for frontend changes and auto-rebuild in background
(cd frontend && npx vite build --watch --logLevel silent) &
VITE_PID=$!

# Flask serves everything
FLASK_APP=app.py flask run --port 5001

kill $VITE_PID 2>/dev/null
