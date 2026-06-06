# RankPilot

Free, full-stack SEO intelligence platform. Crawl sitemaps, track SERP rankings, audit page speed, and analyze competitors — powered by Groq AI.

## Stack

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Backend | Python + FastAPI | [Render](https://render.com) free tier |
| Frontend | React + Vite + TailwindCSS | [Vercel](https://vercel.com) free tier |
| Database | Supabase (PostgreSQL) | [Supabase](https://supabase.com) free tier |
| AI | Groq API (`llama-3.3-70b-versatile`) | Free tier |
| SERP | ValueSERP API | Free tier (100 searches/month) |
| Page Speed | Google PageSpeed Insights | Free, no key required |
| Scraping | httpx + BeautifulSoup4 | Self-hosted |

## Project Structure

```
rankpilot/
├── backend/          # FastAPI API
├── frontend/         # React SPA
└── README.md
```

## Quick Start (Local)

### 1. Supabase Setup

Create a project at [supabase.com](https://supabase.com), then run the SQL in `backend/db/schema.sql` in the **SQL Editor** (includes `user_id` on projects and Row Level Security policies).

Copy your **Project URL** and keys from Settings → API:
- **anon key** → frontend `VITE_SUPABASE_ANON_KEY`
- **service role key** → backend `SUPABASE_KEY` (recommended so server-side queries work alongside RLS)

#### Supabase Auth (Dashboard)

1. Go to **Authentication → Providers**
2. Enable **Email** provider (on by default)
3. Enable **Google** provider → add Google OAuth client ID + secret  
   (from [Google Cloud Console](https://console.cloud.google.com) → APIs → Credentials → OAuth 2.0)
4. Set **Site URL** to your Vercel domain (e.g. `https://your-app.vercel.app`)
5. Add **Redirect URLs**:
   - `https://your-app.vercel.app/**`
   - `http://localhost:5173/**`

#### Schema (excerpt)

```sql
-- Projects (per-user)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

-- ... see backend/db/schema.sql for full schema + RLS policies
```

### 2. Backend

```bash
cd rankpilot/backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your keys

uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 3. Frontend

```bash
cd rankpilot/frontend
npm install
npm install @supabase/supabase-js react-router-dom
cp .env.example .env
# VITE_API_URL=http://localhost:8000
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

npm run dev
```

App: http://localhost:5173

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase **service role** key (backend); use service role so API queries work with RLS enabled |
| `GROQ_API_KEY` | Groq API key from [console.groq.com](https://console.groq.com) |
| `VALUESERP_API_KEY` | ValueSERP key from [valueserp.com](https://valueserp.com) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `GROQ_MODEL` | Optional, defaults to `llama-3.3-70b-versatile` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (e.g. `https://rankpilot-api.onrender.com`) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key for client auth |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET/POST | `/api/projects` | List / create projects |
| GET/PATCH/DELETE | `/api/projects/{id}` | Project CRUD |
| POST | `/api/sitemap/crawl` | Crawl sitemap or internal links |
| POST | `/api/serp/track` | Track keyword SERP |
| POST | `/api/pagespeed/audit` | Run PageSpeed audit |
| POST | `/api/competitors/scrape` | Scrape competitor page |
| POST | `/api/competitors/compare` | Compare your site vs competitors |

All endpoints return structured JSON:

```json
{
  "success": true,
  "data": { ... },
  "analysis": { ... }
}
```

Errors:

```json
{
  "detail": {
    "error": "Human-readable message",
    "code": "error_code"
  }
}
```

## Deployment

### Backend → Render

1. Push `rankpilot/backend` to GitHub.
2. Create a **Web Service** on Render, connect the repo.
3. Settings:
   - **Root Directory:** `rankpilot/backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables from `.env.example`.
5. Set `CORS_ORIGINS` to your Vercel URL (e.g. `https://rankpilot.vercel.app`).

### Frontend → Vercel

1. Import the repo on Vercel.
2. Settings:
   - **Root Directory:** `rankpilot/frontend`
   - **Framework Preset:** Vite
3. Add environment variable:
   - `VITE_API_URL` = your Render backend URL
4. Deploy.

## Free Tier Limits

| Service | Limit |
|---------|-------|
| Groq | Rate limits apply; check [console.groq.com](https://console.groq.com) |
| ValueSERP | 100 searches/month |
| PageSpeed Insights | ~25,000 queries/day (Google quota) |
| Render | Spins down after 15 min idle (cold starts) |
| Supabase | 500 MB database, 1 GB storage |

## License

MIT
