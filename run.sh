#!/bin/bash
cd /Users/rakesh/Desktop/Fitit
source venv/bin/activate
FLASK_APP=app.py flask run --port ${PORT:-5001}
