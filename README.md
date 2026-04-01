# Fitit — Calorie & Fitness Tracker

A full-stack fitness tracking web app. Log food, water, weight, steps, sleep, and calories burnt. Visualize your progress with charts and set custom goals.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| State / Data Fetching | TanStack Query (React Query v5) |
| Charts | Recharts |
| Routing | React Router v7 |
| HTTP Client | Axios |
| Backend | Python + Flask |
| ORM | SQLAlchemy + Flask-Migrate |
| Auth | Flask-Login (session-based) |
| Database | SQLite |

---

## Features

- **Dashboard** — Daily overview with calorie ring charts, macro breakdown, activity progress, weight trend line chart, and sleep bar chart
- **Log** — 6-tab log for Food, Water, Weight, Steps, Sleep, and Calories Burnt with inline add/delete
- **Goals** — Set targets for calories, macros (protein/carbs/fat), water, steps, sleep, and weight
- **Settings** — Update profile details (height, weight, DOB, gender, activity level) and account credentials

---

## Project Structure

```
Fitit/
├── app.py                        # Flask entry point
├── config.py                     # App config (secret key, DB URI)
├── requirements.txt              # Python dependencies
├── calorie_tracker/
│   ├── __init__.py               # App factory — registers API blueprint, serves React build
│   ├── models.py                 # SQLAlchemy models (User, FoodEntry, WaterEntry, etc.)
│   └── routes/
│       ├── api_routes.py         # All REST API endpoints (/api/*)
│       └── auth_routes.py        # Signup/login/logout
└── frontend/
    ├── package.json
    ├── vite.config.ts            # Vite + Tailwind plugin + /api proxy to Flask
    ├── tsconfig.app.json
    └── src/
        ├── App.tsx               # Router + protected/public route wrappers
        ├── api/client.ts         # Axios instance (withCredentials, 401 interceptor)
        ├── hooks/useAuth.tsx     # Auth context provider
        ├── components/
        │   ├── Layout.tsx        # Header nav
        │   ├── RingChart.tsx     # Donut ring chart (Recharts)
        │   └── WeekSelector.tsx  # Week navigation component
        └── pages/
            ├── LoginPage.tsx
            ├── SignupPage.tsx
            ├── DashboardPage.tsx
            ├── LogPage.tsx
            ├── GoalsPage.tsx
            └── SettingsPage.tsx
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1. Clone the repo

```bash
git clone https://github.com/duvvururakesh/calorie-tracker-project.git
cd calorie-tracker-project
```

### 2. Backend setup

```bash
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

---

## Running the App

```bash
./run.sh
```

Open `http://localhost:5001`. That's it — Flask serves the React app and all API routes from a single server. Frontend changes are watched and rebuilt automatically.

---

## API Overview

All endpoints are prefixed with `/api`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/dashboard?date=YYYY-MM-DD` | Dashboard data for a date |
| GET/POST | `/api/entries/food` | List / add food entries |
| GET/POST | `/api/entries/water` | List / add water entries |
| GET/POST | `/api/entries/weight` | List / add weight entries |
| GET/POST | `/api/entries/steps` | List / add steps entries |
| GET/POST | `/api/entries/sleep` | List / add sleep entries |
| GET/POST | `/api/entries/calories_burnt` | List / add calories burnt entries |
| DELETE | `/api/entries/<type>/<id>` | Delete an entry |
| GET/PUT | `/api/goals` | Get / update goals |
| GET/PUT | `/api/profile` | Get / update profile |
| PUT | `/api/account` | Update username / email / password |
