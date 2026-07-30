# Maintenance Request Tracker

I built this over an evening to show Discovery Capital something concrete for
the Web Development Intern posting, instead of just sending a resume. It's a
work-order app for a residential property manager — tenants log maintenance
issues, and there's an admin view to track and update them.

It's an MVP, not a finished product. Auth isn't built yet (see "Known
limitations" below), but the core flow works end to end and I tested every
endpoint by hand before calling it done.

## Stack
- React (Vite) — no CDN shortcuts, real build tooling
- FastAPI
- PostgreSQL in production, SQLite locally (same code, switches automatically
  based on whether `DATABASE_URL` is set — I didn't want to force Postgres
  setup just to run this on my own machine)
- Deployed on Vercel (frontend) + Render (backend + Postgres)

## Why I built it this way

The job posting mentions leasing, tourism, and events, plus "internal tools."
A maintenance tracker felt like the most realistic internal tool a property
company would actually use, so I went with that instead of something flashier.

The "Suggest category" button is honestly the part I went back and forth on
the most. My first instinct was to wire it straight to the Claude API, but
that meant the demo would silently break if I hit a rate limit or typo'd the
key right before sending this. So it defaults to simple keyword matching
(checks for words like "leak," "outlet," "heat," etc.) and only calls the
real API if `ANTHROPIC_API_KEY` is set — and even then, if that call fails
for any reason, it quietly falls back to the keywords instead of erroring out.
Felt like the more honest tradeoff for something I wanted working reliably
tonight.

## Project structure
```
maintenance-tracker/
  frontend/           React (Vite)
    src/App.jsx         tenant form + admin dashboard, both in one file for now
  backend/
    main.py             FastAPI routes (CRUD + the category suggestion endpoint)
    database.py         SQLAlchemy models, Postgres/SQLite switch
  render.yaml           Render picks this up automatically for deployment
  frontend/vercel.json  Vercel build config
```

## Running it locally

**Backend**
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
(Mac/Linux: `python3 -m venv venv` and `source venv/bin/activate`.)

No database setup needed — without `DATABASE_URL` set it just uses a local
SQLite file. Swagger docs are at http://localhost:8000/docs if you want to
poke at the API directly.

**Frontend** — separate terminal
```powershell
cd frontend
npm install
npm run dev
```
http://localhost:5173

**If you want the real AI suggestion instead of keyword matching:**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-..."
```
set before starting uvicorn. Totally optional — the app works fine without it.

## Deployment

Backend + Postgres go on Render (it reads `render.yaml` automatically and
provisions the database for you — New → Blueprint → pick this repo).
Frontend goes on Vercel — set Root Directory to `frontend`, add a
`VITE_API_BASE` env var pointing at the Render URL.

## Live links
- App: (add once deployed)
- API docs: (add `/docs` to the Render URL once deployed)

## Known limitations
- No login/auth — anyone can currently see the admin dashboard
- No email notifications when a status changes
- Category suggestion is keyword-based unless an API key is configured
- Haven't load-tested this or handled concurrent edits to the same request

These felt like reasonable things to skip for a first pass built in one
evening — happy to build any of them out further if it'd be useful.
