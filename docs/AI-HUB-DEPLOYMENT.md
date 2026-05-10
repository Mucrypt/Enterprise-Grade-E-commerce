# AI Communication Hub — Deployment Guide

## What was built

A production-grade AI orchestration layer integrated across the full communication stack:

| Layer | File | What it does |
|---|---|---|
| **DB migration** | `tech-tools-api/src/database/migrations/021_ai_orchestrator.sql` | Creates `ai_drafts`, `ai_audit_log`, `communication_timeline` tables with indexes |
| **AI service** | `tech-tools-api/src/services/ai.orchestrator.ts` | GPT-4o powered draft generation, approval, audit trail, Redis rate limiting |
| **API controller** | `tech-tools-api/src/api/v1/ai/ai.controller.ts` | Request validation, error handling, auth enforcement |
| **API routes** | `tech-tools-api/src/api/v1/ai/ai.routes.ts` | `POST /ai/drafts`, `POST /ai/drafts/:id/approve`, etc. |
| **Route registration** | `tech-tools-api/src/api/v1/index.ts` | `/api/v1/ai` wired in |
| **Dashboard service** | `admin-dashboard/services/ai.service.ts` | Type-safe API client |
| **AI Hub page** | `admin-dashboard/app/(dashboard)/ai-hub/page.tsx` | Full UI: compose, queue, preview, approve/reject |
| **Sidebar** | `admin-dashboard/components/layout/Sidebar.tsx` | AI Hub link added under Communication |

---

## Step 1 — Add your OpenAI API key to the server

```bash
ssh -i ~/.ssh/hetzner_nexusai root@46.225.126.93

nano ~/Enterprise-Grade-E-commerce/tech-tools-api/.env
```

Add these lines:

```env
# AI Communication Hub
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
AI_MODEL=gpt-5.5
AI_RATE_LIMIT_PER_MINUTE=20
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## Step 2 — Pull and deploy the code

```bash
cd ~/Enterprise-Grade-E-commerce

# Pull latest code
git pull origin main

# Run the new DB migration
docker exec techtools-api npm run migrate:up

# Rebuild and restart the API container
docker compose -f infrastructure/docker-compose.prod.yml up api -d --build

# Rebuild the admin dashboard
docker compose -f infrastructure/docker-compose.prod.yml up admin -d --build

# Verify both are healthy
docker compose -f infrastructure/docker-compose.prod.yml ps
```

---

## Step 3 — Verify

```bash
# Check API is serving AI routes
curl https://techtoolstore.com/api/v1/ai/status

# Expected response:
# {"configured":true,"model":"gpt-5.5","status":"ready"}
```

Then open the admin dashboard → Communication → **AI Hub**.

---

## API Reference

All AI endpoints require admin/super_admin JWT.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/ai/status` | Service health (public) |
| GET | `/api/v1/ai/stats` | Usage statistics |
| GET | `/api/v1/ai/drafts` | List drafts (`?status=pending&channel=email`) |
| POST | `/api/v1/ai/drafts` | Generate a new AI draft |
| POST | `/api/v1/ai/drafts/:id/approve` | Approve & send a draft |
| POST | `/api/v1/ai/drafts/:id/reject` | Reject with reason |
| GET | `/api/v1/ai/context/:customerId` | Customer intelligence (orders, spend, history) |
| GET | `/api/v1/ai/timeline/:customerId` | Unified communication timeline |

### Generate draft payload

```json
{
  "channel": "email",
  "prompt": "Write a win-back email for Sophie who hasn't ordered in 60 days",
  "recipientEmail": "sophie@example.com",
  "recipientName": "Sophie",
  "customerId": "uuid-optional"
}
```

---

## Production safeguards

| Concern | How it's handled |
|---|---|
| Human-in-the-loop | Every draft is `pending` until an admin approves — nothing is ever auto-sent |
| Prompt injection | Customer data is injected as structured context, never as raw user input |
| Rate limiting | Redis sliding window: 20 AI calls/min per admin + express-rate-limit: 30/5min per IP |
| Audit trail | Every generation, approval, rejection, and send is recorded in `ai_audit_log` |
| Cost protection | Token usage is stored per draft; stats dashboard shows total tokens used |
| Secrets | API key only lives in server `.env`, never logged, never returned to client |
| Graceful degradation | If Redis is unavailable, rate limiting is skipped (logged as warning, not crash) |
| Error isolation | Failed AI calls surface a clean error to the admin; never crash the API process |

---

## Optional: model swap

To switch to Claude Sonnet (Anthropic) in the future, change `AI_MODEL` in `.env` and update `callOpenAI()` in `ai.orchestrator.ts` to hit `api.anthropic.com`. The rest of the system (drafts, approval, audit, frontend) requires no changes.
