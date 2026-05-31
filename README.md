# Fitit

Mobile-first food, macro, hydration, weight, sleep, and steps tracker with a React frontend, Flask API backend, PWA support, Capacitor iOS project, and the Nibbly nutrition agent.

## What Runs

- `app.py` starts Flask.
- Flask serves `/api/*` JSON endpoints and the production React build from `frontend/dist`.
- React owns all user-facing routes: `/dashboard`, `/log`, `/coach`, `/friends`, `/goals`, `/settings`.
- Capacitor wraps the built React app for iOS from `frontend/ios`.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Routing | React Router |
| Server state | TanStack Query |
| Styling | Tailwind CSS v4 |
| Charts/icons | Recharts, lucide-react |
| Backend | Flask, Flask-Login, SQLAlchemy |
| Database | SQLite locally |
| AI agent | Server-side Gemini/OpenAI-compatible planner with guarded tools |
| PWA/iOS | Web manifest, service worker, Capacitor iOS |

## Project Structure

```text
Fitit/
├── app.py                         # Flask entry point
├── config.py                      # Environment loading and Flask config
├── requirements.txt               # Backend dependencies
├── calorie_tracker/
│   ├── __init__.py                # Flask app factory, API registration, React static host
│   ├── models.py                  # SQLAlchemy data model
│   ├── routes/
│   │   └── api_routes.py          # JSON API, auth, logs, goals, profile, Nibbly agent
│   └── utils.py                   # Totals, goals, health calculations
├── frontend/
│   ├── capacitor.config.ts        # iOS app config
│   ├── public/                    # PWA manifest, service worker, icons, offline page
│   ├── ios/                       # Generated Capacitor iOS project
│   └── src/
│       ├── api/                   # Axios API client
│       ├── components/            # Shared UI and logging components
│       ├── hooks/                 # Auth and mutation hooks
│       ├── pages/                 # Route-level screens
│       ├── App.tsx                # App routes and route guards
│       ├── main.tsx               # React bootstrap
│       └── pwa.ts                 # Service worker registration
└── docs/
    └── ARCHITECTURE.md            # Deeper system map and conventions
```

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd frontend
npm install
cd ..
```

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Add `GEMINI_API_KEY` or `OPENAI_API_KEY` only on the backend. Do not put AI keys in frontend env files.

## Run Locally

```bash
./run.sh
```

Open `http://127.0.0.1:5001`.

## Validate

```bash
venv/bin/python -m compileall app.py config.py calorie_tracker
cd frontend
npm run lint
npm run build
npx cap sync ios
```

## iOS

```bash
cd frontend
npm run ios:sync
npm run ios:open
```

The iOS app loads the built web app through Capacitor. Browser routing uses `BrowserRouter`; native iOS uses `HashRouter`.

## Data Rules

- Logs are user-scoped.
- Future-dated logs are blocked server-side.
- Entry lists return newest items first.
- Nibbly can only mutate data through explicit backend tools.
- Agent actions are recorded in `AgentActionLog`.

## API Summary

All API routes are under `/api`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/dashboard?date=YYYY-MM-DD` | Daily totals, goals, charts |
| GET | `/api/entries?date=YYYY-MM-DD` | All logs for a date |
| POST | `/api/entries/<type>` | Create log entry |
| PUT | `/api/entries/<type>/<id>` | Update log entry |
| DELETE | `/api/entries/<type>/<id>` | Delete log entry |
| GET/PUT | `/api/goals` | Read/update goals |
| GET/PUT | `/api/profile` | Read/update profile |
| PUT | `/api/account` | Update credentials |
| GET | `/api/coach/history` | Nibbly chat history/context |
| POST | `/api/coach/message` | Nibbly agent message |
