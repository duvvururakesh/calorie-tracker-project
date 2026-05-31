# Fitit Architecture

## System Boundary

Fitit is a single-product app with three runtime surfaces:

1. Flask API and static host.
2. React/PWA frontend.
3. Capacitor iOS wrapper.

The frontend never talks directly to AI providers or the database. All sensitive operations run through Flask.

## Backend

`calorie_tracker/__init__.py` creates the Flask app, registers `api_bp`, initializes SQLAlchemy/Login/Migrate, and serves `frontend/dist`.

`calorie_tracker/routes/api_routes.py` owns current HTTP behavior:

- auth/session endpoints
- dashboard aggregates
- log CRUD
- friends, friend requests, sharing privacy, and shared metric summaries
- goals/profile/account
- Nibbly chat history and agent execution

`calorie_tracker/models.py` owns persistent schema:

- `User`
- food, water, weight, steps, and sleep entries
- `ChatMessage`
- `UserMemory`
- `AgentActionLog`
- `Friendship`
- `FriendPrivacy`

## Friends And Sharing

Friend tracking is privacy-filtered on the backend. The frontend can request friend activity, but it only receives fields enabled by the friend's `FriendPrivacy` record.

Current v1 scope:

- search users
- send, accept, decline, cancel, and remove friend requests
- view accepted friends' daily metrics
- control which metrics are shared

Default shared metrics include food calories, macros, water, steps, and sleep. Weight and food names are off by default.

`calorie_tracker/utils.py` owns pure app calculations such as daily totals, user goals, health metrics, and week dates.

## Nibbly Agent

Nibbly is a backend agent. The model receives app context and returns `tool_calls`. The server executes only named tools from the allowlist.

Allowed tool pattern:

```json
{
  "reply": "Logged 500 ml of water.",
  "tool_calls": [
    { "tool": "log_water", "args": { "amount_ml": 500 } }
  ]
}
```

Safety rules:

- Unknown tools are blocked.
- Invalid tool input is blocked.
- Future-date writes are rejected before planning.
- Food updates/deletes must target the selected day.
- Stable user facts go through `remember_user_fact`.
- Every tool call is written to `AgentActionLog`.

## Frontend

`frontend/src/App.tsx` defines route ownership and auth gates.

Pages are route-level screens:

- `DashboardPage.tsx`
- `LogPage.tsx`
- `NibblyPage.tsx`
- `FriendsPage.tsx`
- `GoalsPage.tsx`
- `SettingsPage.tsx`
- `LoginPage.tsx`
- `SignupPage.tsx`

Shared UI lives in `frontend/src/components`.

Logging-specific UI lives in `frontend/src/components/logging`.

API calls go through `frontend/src/api/client.ts`, which centralizes the base URL, credentials, and auth redirect behavior.

## Assets

PWA and app shell assets live in `frontend/public`:

- `manifest.json`
- `sw.js`
- `offline.html`
- `favicon.svg`
- `icons/`

iOS native assets live under `frontend/ios/App/App/Assets.xcassets`.

Do not keep unused Vite sample assets, duplicate icon sprites, or cross-project symlinks in the repo.

## Data Management

SQLite is the local database. `db.create_all()` currently creates missing tables during app startup. Flask-Migrate is installed for future schema migrations; use migrations before production deployments with existing user data.

Log data is date-scoped and user-scoped. Query responses return newest entries first for log correction workflows.

## Environment

Backend env:

- `SECRET_KEY`
- `DATABASE_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Frontend env:

- `VITE_API_BASE_URL`

AI keys must stay in backend env only.

## Validation Checklist

Run before committing:

```bash
venv/bin/python -m compileall app.py config.py calorie_tracker
cd frontend
npm run lint
npm run build
npx cap sync ios
```
