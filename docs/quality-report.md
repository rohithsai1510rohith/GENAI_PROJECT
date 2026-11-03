# System Quality & Verification Report

- **Date:** 2026-10-23
- **Auditor:** DeepMind Antigravity Verification Agent
- **Project:** Traffic Rules & Fines Assistant Using Generative AI (GenAI + RAG)
- **Specification Compliance:** PRD Sections 1 to 20

---

## 1. Automated Test Suite Metrics

| Suite | Runner | Target | Actual Tests Passed | Status | Coverage Areas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Python RAG Core** | Pytest 9.1.1 | $\ge 18$ | **27 / 27 (100%)** | **PASSED** | Loaders (PDF/TXT), chunking, embeddings, FAISS dense + BM25 hybrid index, prompt building, context sanitization, atomic index swap, single-writer queue, no-text PDF rejection, query during ingestion, rollback on failed ingestion, parallel queries during swap. |
| **Web Frontend** | Vitest 1.6.1 | $\ge 16$ | **17 / 17 (100%)** | **PASSED** | SSE client stream parsing, 429 backoff handling, Zustand chat session state (up to 20 sessions), message bubbles, source drawer dialog, fine result cards, 404 page, admin login without demo credentials, authenticated admin tabs, admin logout session revocation. |
| **Backend API Gateway** | Jest 29.7.0 | $\ge 44$ | **49 / 49 (100%)** | **PASSED** | Health checks (ok/degraded), request ID propagation, Zod validation bounds, SSE chat proxy, grounded fines search, document sync & filtering, feedback lifecycle, rate limiting (429), Argon2id login, 5-failure lockout, token rotation & reuse revocation, RBAC 401/403, upload rejections (magic bytes, null bytes, .md, oversized 20MB limit, path traversal), duplicate SHA-256 (409), vector ingestion lifecycle, deactivation/reactivation, PII redaction, 90-day retention purge, audit logging. |
| **Total Automated Tests** | — | — | **93 / 93 (100%)** | **PASSED** | Zero skipped (`it.skip`, `test.skip`, `pytest.mark.skip`), zero focused (`it.only`, `fit`). |

---

## 2. Evaluation Benchmark Metrics

> **Statutory Notice:** All evaluations were executed on synthetic sample test documents, not verified law.

### 2.1 Main Benchmark Suite (105 Test Cases)
- **File:** `tests/eval/questions.jsonl`
- **Total Test Cases:** 105
- **Overall Accuracy:** **99.0%** (104 / 105)
- **In-Scope Statutory Hit Rate:** **98.6%** (71 / 72)
- **Out-of-Scope Fallback Rejection Rate:** **100.0%** (21 / 21)
- **Adversarial & Jailbreak Resistance:** **100.0%** (12 / 12)
- **Latency Profile:**
  - Mean: **9.4 ms**
  - Median (p50): **12.3 ms**
  - 95th Percentile (p95): **15.4 ms**
- **Failed Queries (1 total):**
  - `q069`: *"What are the headlight high beam rules within city limits during night driving?"*
  - **Expected Section:** `Rule 105`
  - **Actual Score:** `0.414` (Missed expected section)
  - **Root Cause:** In the sample test documents in `data/raw/`, headlamp text lacks an explicit `Rule 105` section index tag; semantic similarity to general driving rules fell just below the high-confidence threshold.

### 2.2 Hold-Out Benchmark Suite (30 Unseen Test Cases)
- **File:** `tests/eval/holdout_questions.jsonl` (fresh unseen queries; zero tuning performed)
- **Total Test Cases:** 30
- **Overall Accuracy:** **80.0%** (24 / 30)
- **In-Scope Statutory Hit Rate:** **100.0%** (10 / 10)
- **Out-of-Scope Fallback Rejection Rate:** **40.0%** (4 / 10) (6 queries on non-motor trade licensing/rent leases had borderline similarity to general legal text)
- **Adversarial & Jailbreak Resistance:** **100.0%** (10 / 10)
- **Latency Profile:**
  - Mean: **13.1 ms**
  - Median (p50): **16.5 ms**
  - 95th Percentile (p95): **21.9 ms**

---

## 3. Frontend Bundle Size & Performance

Measured from clean production build (`npm run build:web` / Vite 5.4.21):

| Chunk / Asset | Raw Size | Gzipped Size | Target | Compliance |
| :--- | :--- | :--- | :--- | :--- |
| **Initial Public JS (`index` + vendor)** | 229.67 kB | **71.50 kB** | $< 200\text{ kB}$ gzip | **MET** |
| `index-CWm_Da1G.js` (App entry) | 35.22 kB | 10.48 kB | — | — |
| `vendor-react-B-ycnlCu.js` (React, Router) | 162.54 kB | 53.08 kB | — | — |
| `vendor-icons-3qXLryKT.js` (Lucide icons) | 21.54 kB | 4.30 kB | — | — |
| `vendor-motion-D7ULpT5Y.js` (Framer motion) | 1.40 kB | 0.82 kB | — | — |
| `LandingPage-RMWGB-zh.js` | 8.97 kB | 2.82 kB | — | — |
| **Global Stylesheet (`index-BuUd0rYk.css`)** | 51.97 kB | **9.46 kB** | — | **MET** |
| **Admin Login Chunk (Code-split)** | 4.56 kB | **1.66 kB** | Separate | **MET** |
| **Admin Dashboard Chunk (Code-split)**| 31.47 kB | **6.96 kB** | Separate | **MET** |
| **Markdown Vendor Chunk (Code-split)** | 158.23 kB | **48.05 kB** | Separate | **MET** |

---

## 4. Security & Cryptographic Settings

1. **Argon2id Password Hashing:**
   - **Production Config:** `memoryCost: 65536` (64 MB), `timeCost: 3`, `parallelism: 4` (Argon2id OWASP full-strength).
   - **Test Config (isJest):** `memoryCost: 4096` (4 MB), `timeCost: 1`, `parallelism: 1` (isolated for automated test execution).
2. **Account Lockout:**
   - Threshold: 5 failed attempts within 15 minutes.
   - Enforcement: HTTP 429 `ACCOUNT_LOCKED` returned; lockout applies even if subsequent password is correct until window expires.
3. **Session & Token Management:**
   - Access tokens: 15-minute JWT, kept in volatile memory only.
   - Persistent Storage: `localStorage` strictly restricted to `theme` ("light"\|"dark") and `traffic_anon_id` (UUID v4). Zero tokens stored in `localStorage` or `sessionStorage`.
   - Refresh tokens: 48-byte cryptographically secure random string, stored as SHA-256 hash in database; delivered via `httpOnly`, `SameSite=Strict`, `Path=/api/v1/auth` cookie. Token rotation enforced on every refresh; reuse of old token immediately revokes session family.
4. **Credential Audit:**
   - `git grep -i "Admin@123"`: 0 matches found.
   - Auto-fill demo button: eradicated from UI; verified by test in `admin.test.tsx`.
5. **Upload Validation:**
   - Magic bytes validation for PDF (`%PDF-`) and TXT (valid UTF-8, zero null bytes).
   - Markdown (`.md`) strictly rejected.
   - Duplicate rejection: SHA-256 hash collision returns HTTP 409 Conflict.
   - Path traversal: Stored files use random UUID (`<uuid>.<ext>`) in dedicated storage directory; traversal sequences stripped.
   - File size: 20 MB ceiling enforced via Multer streaming checks.
6. **PII Sanitization:**
   - Indian license plates (`[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}`), phone numbers, and emails automatically redacted in `QueryLog` as `[REDACTED_PLATE]`, `[REDACTED_PHONE]`, `[REDACTED_EMAIL]`.

---

## 5. Known Gaps & Host Environment Constraints

| Area | Current State on This Host | Reason / Impact | Remediation Plan for Production |
| :--- | :--- | :--- | :--- |
| **Docker Engine** | `docker` CLI not installed (`CommandNotFoundException`). `docker-compose up` unverified. | Windows development host lacks Docker Desktop/daemon in PATH. | Multi-stage Dockerfiles (`apps/web`, `apps/api`, `apps/ai-service`) and `docker-compose.yml` are written; verify on Linux Docker runner or CI. |
| **PostgreSQL Database** | TCP connection to localhost:5432 failed. | PostgreSQL daemon not running on port 5432 locally. | System operated against verified `memoryStore` resilience layer. Connect managed PostgreSQL and run `npx prisma migrate deploy` in staging. |
| **Groq Cloud API** | `GROQ_API_KEY` is blank in `.env`. | External API key not provided in environment. | System operates on local extractive synthesis fallback. Provide valid Groq API key in `.env` for generative cloud responses. |
| **Browser Headless Runners**| `@playwright/test` and Lighthouse not installed globally. | Headless Chrome binaries omitted from host environment. | Vitest + React Testing Library (17 tests) verifies all DOM, drawer, and auth behaviors. Add Playwright browser installation step in CI pipeline. |
| **Statutory Data** | Operating on sample test documents (`data/raw/`). | Development verification dataset. | Ingest official State and Central Ministry gazettes, mark them verified in the Admin Portal, and re-run evaluation before public release. |
