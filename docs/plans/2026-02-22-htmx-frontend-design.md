# HTMX Frontend Design — app.indices.app

## Goal

Build a server-rendered HTMX frontend on Cloudflare Workers that provides dashboard, management, and intelligence interfaces for the indices_app platform. Uses Hono JSX for templating, ts-rest for type-safe API communication, and DDD-organized bounded contexts.

## Architecture

**Thin Proxy pattern:** The Cloudflare Worker at `app.indices.app` receives browser requests, fetches JSON from `pi.indices.app` via a typed ts-rest client, renders Hono JSX to HTML, and returns it. HTMX swaps partial HTML fragments on interactions. SSE is proxied through the Worker to avoid CORS.

```
Browser ──HTMX──► app.indices.app (CF Worker) ──ts-rest──► pi.indices.app (Hono/Bun API)
                  Hono JSX → HTML                          JSON responses
```

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono (JSX templates)
- **Interactivity:** HTMX
- **API Contract:** ts-rest (`@indices/contract` npm package)
- **Styling:** Tailwind CSS
- **DAG Visualization:** D3.js + dagre
- **Charts:** Chart.js
- **Testing:** Vitest (unit), Playwright (E2E)
- **Build:** wrangler (esbuild), Tailwind CLI

---

## Three Projects

### 1. `@indices/contract` (npm package)

Shared ts-rest contract definitions. Single source of truth for API shape — both backend and frontend type-check against it.

```
indices_contract/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── prospects.ts
    ├── campaigns.ts
    ├── segments.ts
    ├── signals.ts
    ├── experiments.ts
    ├── workflows.ts
    ├── evolution.ts
    ├── sentiment.ts
    ├── accounts.ts
    ├── brand-kits.ts
    ├── feeds.ts
    ├── scraper.ts
    ├── zeluto.ts
    ├── analytics.ts
    └── mcp.ts
```

Each file defines a ts-rest contract:

```typescript
import { initContract } from '@ts-rest/core'
import { z } from 'zod'

const c = initContract()

export const prospectsContract = c.router({
  list: {
    method: 'GET',
    path: '/api/v1/prospects',
    query: z.object({ page: z.coerce.number().optional(), limit: z.coerce.number().optional() }),
    responses: { 200: z.object({ data: z.array(prospectSchema), total: z.number() }) },
  },
  // ...
})
```

### 2. `indices_app` (backend — existing)

Refactored to import Zod schemas from `@indices/contract` instead of local `types/api.ts`. Existing Hono route handlers stay the same but reference the shared contract types.

### 3. `indices_frontend` (new repo)

HTMX frontend on Cloudflare Workers.

---

## DDD Project Structure

```
indices_frontend/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx                    # App entry, route registration
│   ├── shared/                      # Shared kernel
│   │   ├── api-client.ts            # ts-rest client (repository layer)
│   │   ├── middleware/
│   │   │   ├── auth.ts              # Cookie forwarding, 401 → /login redirect
│   │   │   └── layout.ts            # Wrap responses in shell layout
│   │   ├── layouts/
│   │   │   ├── shell.tsx            # App shell (sidebar, header, SSE script)
│   │   │   └── auth.tsx             # Login/signup layout
│   │   └── components/              # Shared UI primitives
│   │       ├── table.tsx
│   │       ├── form.tsx
│   │       ├── modal.tsx
│   │       ├── pagination.tsx
│   │       ├── toast.tsx
│   │       └── stat-card.tsx
│   │
│   ├── domains/
│   │   ├── prospects/               # Prospect bounded context
│   │   │   ├── routes.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── partials.tsx
│   │   │   └── service.ts
│   │   │
│   │   ├── campaigns/               # Campaign bounded context
│   │   │   ├── routes.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── partials.tsx
│   │   │   └── service.ts
│   │   │
│   │   ├── workflows/               # Workflow bounded context
│   │   │   ├── routes.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── partials.tsx
│   │   │   ├── service.ts
│   │   │   └── dag-renderer.ts      # D3 DAG rendering logic
│   │   │
│   │   ├── evolution/               # Evolution + HITL bounded context
│   │   │   ├── routes.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── partials.tsx
│   │   │   └── service.ts
│   │   │
│   │   ├── sentiment/               # Sentiment bounded context
│   │   │   ├── routes.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── partials.tsx
│   │   │   └── service.ts
│   │   │
│   │   ├── experiments/             # Experiments bounded context
│   │   │   ├── routes.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── partials.tsx
│   │   │   └── service.ts
│   │   │
│   │   ├── accounts/                # ABM bounded context
│   │   │   ├── routes.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── partials.tsx
│   │   │   └── service.ts
│   │   │
│   │   ├── settings/                # Settings bounded context
│   │   │   ├── routes.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── partials.tsx
│   │   │   └── service.ts
│   │   │
│   │   ├── analytics/               # Analytics bounded context
│   │   │   ├── routes.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── partials.tsx
│   │   │   ├── service.ts
│   │   │   └── charts.ts            # Chart.js config builders
│   │   │
│   │   └── onboarding/              # Onboarding bounded context
│   │       ├── routes.tsx
│   │       ├── pages.tsx
│   │       ├── partials.tsx
│   │       └── service.ts
│   │
│   ├── events/                      # Domain events (SSE)
│   │   ├── sse-proxy.ts             # SSE proxy route
│   │   └── handlers.ts              # Event → HTMX trigger mapping
│   │
│   └── static/
│       ├── js/
│       │   ├── sse.js               # SSE connection + HTMX trigger
│       │   ├── dag.js               # D3 DAG rendering
│       │   └── charts.js            # Chart.js dashboard charts
│       └── css/
│           └── app.css              # Tailwind + custom styles
```

### DDD Principles Applied

- Each domain owns its routes, pages, partials, and service logic
- Service layer contains domain logic — display formatting, validation, state machine transitions
- Shared kernel has only truly cross-cutting concerns (auth, layout, generic UI)
- Domains communicate through the backend API, not directly with each other
- Ubiquitous language — folder/file names match domain terms

---

## HTMX Interaction Pattern

Every page loads as full HTML. Subsequent interactions use HTMX attributes to swap partial fragments:

```jsx
// Full page: GET /prospects
<Layout>
  <div id="prospect-list">
    <ProspectTable prospects={data} />
  </div>
  <button hx-get="/prospects/new" hx-target="#modal" hx-swap="innerHTML">
    Add Prospect
  </button>
  <div id="modal"></div>
</Layout>

// Partial: GET /prospects/new → returns just the form fragment
<form hx-post="/prospects" hx-target="#prospect-list" hx-swap="innerHTML">
  <input name="email" required />
  <input name="company" />
  <button type="submit">Create</button>
</form>
```

---

## SSE Integration

CF Worker proxies SSE from `pi.indices.app/api/v1/sse/stream`. Client-side JS maps events to HTMX triggers:

```javascript
const es = new EventSource('/sse/proxy')
es.addEventListener('campaign:status_changed', () => htmx.trigger('#campaign-list', 'refresh'))
es.addEventListener('hitl:request_created', () => {
  htmx.trigger('#hitl-badge', 'refresh')
  showToast('New approval request')
})
es.addEventListener('sentiment:drift_detected', () => htmx.trigger('#sentiment-chart', 'refresh'))
```

### SSE Event Types

```
heartbeat, campaign:created, campaign:updated, campaign:status_changed,
prospect:imported, prospect:enriched, signal:captured, signal:account_scored,
sentiment:drift_detected, experiment:results, workflow:generated,
workflow:stage_changed, evolution:cycle_started, evolution:cycle_completed,
hitl:request_created, hitl:decision_made, scrape:job_started,
scrape:job_completed, scrape:job_failed, sync:started, sync:completed, sync:failed
```

---

## Feature Designs

### Onboarding Wizard

Multi-step form, each step POSTs to save and returns next step partial:

1. **Company Info** — name, industry, size
2. **Brand Kit** — upload logo, set colors, voice rules
3. **Zeluto Connection** — API key, org ID, test connection
4. **First Audience** — create initial segment
5. **First Campaign** — set a goal, pick channels

Progress bar updates with each step. Back/forward via `hx-get`.

### Workflow Builder (DAG)

Split view:
- **Left panel:** Node palette (drag-to-add) + node config form
- **Right panel:** D3 + dagre rendered DAG canvas

Interactions: click node → config panel (HTMX swap), add/delete node → POST + re-render, draw edge → drag between ports.

### HITL Approval Interface

Queue of pending requests with real-time SSE updates:
- Card list showing type, summary, timestamp, urgency
- Detail modal with full proposed changes (campaign, prompt, DAG preview)
- Actions: Approve / Reject / Modify (inline editor for modifications)
- SSE `hitl:request_created` adds cards without polling
- Sidebar badge count updates in real-time

### Analytics Dashboard

Chart.js widget grid updated via SSE:
- Prospect pipeline (funnel), Campaign performance (line), Sentiment trends (area with drift markers), Hot accounts (bar), Experiment results (grouped bar), Active workflows (status cards)
- Summary stats from `/analytics/dashboard` at top

### Campaign Evolution Timeline

Vertical timeline of evolution cycles:
- Generation number, fitness score delta, prompt changes
- Expandable diff view (before/after)
- Links to associated HITL decisions
- Chart.js sparkline for fitness progression

---

## Error Handling

- **API errors:** `api-client.ts` catches non-2xx, maps to error partials. `hx-target-error` swaps inline.
- **Auth failures:** 401 → redirect to `/login`
- **Network errors:** SSE reconnects automatically. Fetch failures show toast with retry.
- **Validation:** HTML5 client-side for immediate feedback. Zod (via ts-rest contract) as source of truth.

## Testing

- **Vitest** for domain service unit tests (DAG validation, chart data shaping, step validation)
- **Playwright** for E2E on critical flows (onboarding, HITL approval, workflow builder)
- Target: 80%+ unit coverage on service layer, E2E on 5 critical user journeys

## Deployment

```toml
name = "indices-frontend"
main = "src/index.tsx"
compatibility_date = "2026-02-22"

[vars]
API_BASE_URL = "https://pi.indices.app"

[[routes]]
pattern = "app.indices.app/*"
```

- Tailwind CLI for CSS, esbuild (via wrangler) for JS/TS
- D3, Chart.js, HTMX via CDN or static assets
- Auth cookies: `SameSite=Lax` (same parent domain `indices.app`)

---

## Frontend Routes

| Route | Domain | Description |
|-------|--------|-------------|
| `/` | Analytics | Dashboard with Chart.js widgets |
| `/prospects` | Prospects | Table with search, CRUD |
| `/campaigns` | Campaigns | Cards/list with status filters |
| `/experiments` | Experiments | MAB test builder |
| `/workflows` | Workflows | DAG builder with D3 |
| `/evolution` | Evolution | Cycle history + HITL queue |
| `/sentiment` | Sentiment | Brand monitoring dashboards |
| `/accounts` | Accounts | ABM account management |
| `/settings` | Settings | Zeluto config, brand kits, feeds |
| `/onboarding` | Onboarding | Multi-step wizard |

---

## API Endpoints (Backend Reference)

60+ endpoints across 14 domains. Full catalog in the backend at `src/routes/`. Key domains:

- **Prospects:** CRUD (5 endpoints)
- **Campaigns:** CRUD + status (4)
- **Segments:** CRUD (5)
- **Signals:** capture, hot accounts, account signals (3)
- **Experiments:** CRUD + MAB allocation + reward (6)
- **Workflows:** CRUD (3)
- **Evolution:** cycles + HITL approve/reject (4)
- **Sentiment:** signals, drift, competitive (3)
- **Accounts:** CRUD + deals (4)
- **Brand Kits:** CRUD + audit (4)
- **Feeds:** CRUD (4)
- **Scraper:** jobs CRUD + cancel (4)
- **Zeluto:** config + sync (6)
- **Analytics:** dashboard summary (1)
- **MCP:** list + call tools (2)
- **SSE:** stream (1)
