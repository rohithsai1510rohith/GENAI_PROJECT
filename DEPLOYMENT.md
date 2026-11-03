# Deployment Guide: Traffic Rules & Fines Assistant

This guide covers deploying the full-stack Indian Statutory Traffic Rules Assistant across **Vercel** and **Render** with zero errors.

---

## Architecture Overview

- **Frontend (`apps/web`)**: React 18 + Vite SPA, optimized for **Vercel** or **Render Static Sites**.
- **API Gateway (`apps/api`)**: Node.js Express + Prisma ORM, deployed as a **Render Web Service**.
- **AI Microservice (`apps/ai-service`)**: Python 3.11 FastAPI + FAISS Vector Store, deployed as a **Render Web Service**.
- **Database**: PostgreSQL (Render Managed PostgreSQL, Supabase, Neon, or Railway).

---

## Option 1: One-Click Full Stack on Render (Recommended)

Render can provision the entire stack (Database, AI Service, API Gateway, and Web UI) automatically using the included `render.yaml` blueprint.

### Steps:
1. Push this repository to GitHub: `https://github.com/rohithsai1510rohith/GENAI_PROJECT`.
2. Go to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Connect your GitHub repository `GENAI_PROJECT`.
5. Render will automatically detect `render.yaml` and configure:
   - `traffic-assistant-db` (PostgreSQL)
   - `traffic-assistant-ai` (Python FastAPI + FAISS)
   - `traffic-assistant-api` (Node.js API Gateway)
   - `traffic-assistant-web` (React Static Site)
6. Add your secret environment variable:
   - `GROQ_API_KEY`: Your Groq Cloud API key (get one free at [console.groq.com](https://console.groq.com)).
7. Click **Apply**.
8. Once built:
   - In `traffic-assistant-api`, run the seed script to initialize the 20 official statutory documents:
     ```bash
     npm run seed:official  # or npx tsx src/scripts/seedOfficialDocs.ts
     ```
   - Open your `traffic-assistant-web` URL.

---

## Option 2: Frontend on Vercel + Backend on Render

Deploy the user-facing web app on Vercel's global CDN and host the backend microservices on Render.

### Step 1: Deploy Database & Microservices on Render
1. Follow **Option 1** above to deploy `traffic-assistant-db`, `traffic-assistant-ai`, and `traffic-assistant-api`.
2. Note your deployed API Gateway URL, e.g.:
   `https://traffic-assistant-api.onrender.com`

### Step 2: Deploy Frontend on Vercel
1. Go to [Vercel Dashboard](https://vercel.com) and click **Add New...** -> **Project**.
2. Select your repository `GENAI_PROJECT`.
3. In **Project Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/web` (or leave as root; `vercel.json` is configured for both).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In **Environment Variables**:
   - Add: `VITE_API_BASE_URL` = `https://traffic-assistant-api.onrender.com`
5. Click **Deploy**.
6. Vercel will build and publish your web client with SPA routing (`/chat`, `/fines`, `/documents`, `/about`, `/admin`) pre-configured.

---

## Environment Variables Reference

### Backend API (`apps/api`)
| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Web service port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `AI_SERVICE_URL` | Internal/External AI Service URL | `http://traffic-assistant-ai:8000` |
| `AI_SERVICE_SHARED_SECRET` | Shared secret between API and AI service | Random 32+ character string |
| `JWT_SECRET` | Secret for admin authentication tokens | Random 32+ character string |
| `CLIENT_URL` | Permitted frontend URL (CORS) | `https://your-frontend.vercel.app` |
| `TRUST_PROXY` | Enable if behind reverse proxy/Cloudflare | `true` |

### AI Microservice (`apps/ai-service`)
| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `AI_PORT` | Service port | `8000` |
| `GROQ_API_KEY` | Groq Cloud LLM API Key | `gsk_...` |
| `GROQ_MODEL` | LLM model identifier | `llama-3.3-70b-versatile` |
| `AI_SERVICE_SHARED_SECRET` | Secret matching API Gateway | Random 32+ character string |
| `INDEX_DIR` | FAISS index directory | `data/index` |
| `RAW_DATA_DIR` | Raw statutory files directory | `data/raw` |

### Web Frontend (`apps/web`)
| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | URL of the deployed API Gateway | `https://traffic-assistant-api.onrender.com` |

---

## Pre-Indexed Statutory Data Included

The repository comes pre-loaded with:
- **`data/raw/`**: 20 authentic statutory legal enactments (Central Acts, Delhi, Maharashtra, Karnataka, Tamil Nadu).
- **`data/index/`**: Pre-computed FAISS vector embeddings (`index.faiss`) and BM25 metadata (`metadata.json`).
- Zero sample test data in production index (`isTestData: false`, `verified: true`).

