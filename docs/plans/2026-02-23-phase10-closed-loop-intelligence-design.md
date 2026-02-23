# Phase 10: Closed-Loop Intelligence — Design Document

> **Tagline:** Loop continues... system gets smarter every cycle.

## Overview

Phase 10 connects every existing building block — content generation, engagement tracking, EvoAgentX optimization, sentiment analysis, experiments, signal scoring — into autonomous, event-driven feedback loops. The system observes outcomes, learns, and improves without manual intervention.

**Architecture:** Event-driven pipeline system with a typed in-process event bus, AI-configurable pipelines, a rule engine for customer control, and channel grouping for smart targeting. Full prompt lineage tracking enables the system to know exactly which prompt produced which content, how it performed, and what evolved from it.

**Key decisions:**
- Event-driven (not cron) — reactive, lower latency, events cascade naturally
- AI-configurable — pipelines, rules, and channel groups are readable/writable by LLM through MCP tools
- Full lineage tracking — prompt version → content → engagement → next prompt version
- HITL policy configurable per-tenant — auto-deploy, require approval, or threshold-gated
- Rule engine — customers define "if X then Y" rules; AI suggests and explains them
- Channel groups — static, behavioral (auto-refreshing), and audience-matched

---

## 1. Event Bus

A typed `EventBus` class wrapping Node's `EventEmitter` with tenant isolation, async handler chains, and automatic audit logging.

### API

```
EventBus
  emit(tenantId, eventType, payload)   — validate, log, fan out to handlers
  on(eventType, handler)               — register pipeline handler with priority
  onAny(handler)                       — wildcard for cross-cutting concerns
  history(tenantId, eventType, hours)  — query loop_events for recent events
```

### Handler Chain Execution

When an event fires, the bus runs this sequence per matched pipeline:

1. **MATCH** — Does this pipeline's event_type match? Is it active?
2. **RULES** — Load tenant's rules scoped to this pipeline
3. **EVALUATE** — Run conditions against event payload + tenant context
4. **GATE** — If any gate rule matched, log "gated" and stop
5. **MERGE** — Collect modify rules, merge into pipeline config
6. **EXECUTE** — Run pipeline's action function with merged config
7. **SIDE FX** — Fire notify/route/generate actions from rules
8. **AUDIT** — Log outcome to loop_events with rule_ids and duration

If a handler throws, the bus catches it, logs an `error` outcome, and continues. One broken pipeline doesn't kill the others.

### Rate Limiting

**Pipeline cadence**: Each pipeline has `cadence_min`. If `last_run_at` is within the cadence window, the event is logged as `skipped`.

**Rule cooldown**: Each rule has `cooldown_minutes`. If `last_fired_at` is within cooldown, the rule is skipped.

**Global circuit breaker**: If any pipeline fires more than 50 times in an hour for a tenant, the bus pauses that tenant's pipelines and emits a `system.circuit_breaker` event.

### Tenant Context

The bus builds a `TenantContext` on each event, cached in memory per tenant and refreshed every 5 minutes:

```
TenantContext
  tenant_id          uuid
  baselines          { [channel]: { engagement_avg, trend, percentile } }
  active_groups      { [group_name]: channel[] }
  active_experiments { [experiment_id]: { status, arms_count } }
  pipeline_stats     { [pipeline_name]: { run_count_24h, last_score } }
  hitl_policy        'auto_deploy' | 'require_approval' | 'threshold_gated'
  quality_threshold  number
```

Rules can reference any field: `{ "field": "baselines.email.trend", "op": "eq", "value": "falling" }`.

---

## 2. Event Types

Seven domain events flow through the bus. Each carries tenant ID, timestamp, and typed payload.

### Emitted by existing systems (add `emit()` calls)

| Event | Emitter | Payload |
|-------|---------|---------|
| `engagement.collected` | Engagement poller + webhooks | `{ publishedContentId, channel, metrics, score }` |
| `engagement.threshold_reached` | Optimizer trigger | `{ channel, currentScore, baseline, delta }` |
| `sentiment.drift_detected` | Drift detector | `{ brand, direction, zScore, themes[] }` |
| `experiment.reward_received` | Experiment routes | `{ experimentId, armId, success }` |
| `delivery.completed` | Zeluto webhook + publish routes | `{ campaignId, channel, metrics }` |

### Emitted by Phase 10 systems (new)

| Event | Emitter | Payload |
|-------|---------|---------|
| `optimization.completed` | EvoAgentX learning loop | `{ pipelineId, promptVersionId, score, strategy }` |
| `campaign.auto_generated` | Strategic reactor pipeline | `{ campaignId, trigger, channels[] }` |

---

## 3. Five Default Pipelines

Each tenant gets these five pipelines auto-created. The AI can modify, disable, or add more.

### Pipeline 1: Content Flywheel

```
trigger:   engagement.threshold_reached
evaluate:  Is the engagement delta significant? (configurable z-score)
act:       Run EvoAgentX optimization for the triggering channel
           → Store evolved prompt version with lineage
           → If hitl_policy=auto_deploy AND score > quality_threshold: activate
           → Else: create HITL request
learn:     Update channel baseline metrics
           Adjust threshold if consistently over/under-triggering
```

Customer value: "Your email subject lines have evolved through 7 generations. Open rates improved from 18% to 31%."

### Pipeline 2: Strategic Reactor

```
trigger:   sentiment.drift_detected
evaluate:  Is drift magnitude above reaction threshold?
           Is the brand one the customer cares about? (configurable)
act:       Generate a responsive campaign brief using drift context
           → Route through Phase 7 multi-channel content generation
           → Include sentiment themes in the prompt context
           → Queue for publish or HITL review
learn:     Track whether reactive campaigns improved sentiment
           Feed back into drift threshold calibration
```

Customer value: "Detected negative sentiment shift for your brand on social media. Auto-generated a response campaign across LinkedIn and Instagram. Awaiting your approval."

### Pipeline 3: Experiment Auto-Closer

```
trigger:   engagement.collected (for content linked to experiment arms)
evaluate:  Map engagement to the correct experiment arm
           Check if experiment has statistical significance
act:       Auto-reward the arm (success if score > median)
           If experiment converged: declare winner, pause losing arms
           Update Thompson sampling parameters
learn:     Store winning variant patterns for future experiment seeding
```

Customer value: "Your A/B test on TikTok hooks resolved after 2,400 impressions. Variant B ('question opener') won with 34% higher engagement. Applied to future TikTok content."

### Pipeline 4: Signal Feedback

```
trigger:   delivery.completed
evaluate:  Did the target account engage? (cross-reference signals)
act:       If engaged: boost account signal score
           If ignored: decay score slightly
           If bounced/unsubscribed: major score reduction
learn:     Recalculate hot account rankings
           Emit updated scores for dashboard SSE
```

Customer value: "3 accounts moved from warm to hot this week based on campaign engagement. 1 dropped from hot to warm after ignoring 2 campaigns."

### Pipeline 5: Channel Optimizer

```
trigger:   optimization.completed
evaluate:  Compare evolved prompt performance across channels
           Identify best-performing channel for this audience segment
act:       Update LLM router channel preferences
           Suggest channel mix adjustments to customer
learn:     Build per-channel performance history
           Feed into future campaign channel selection
```

Customer value: "Your audience responds best to LinkedIn (32% engagement) and email (28%). TikTok underperforms at 11%. Recommend shifting budget."

---

## 4. Rule Engine

Rules sit between the trigger and evaluate steps of every pipeline. When an event fires, the pipeline's rules are evaluated in priority order. Rules can gate (block), modify (change config), route (trigger another pipeline), notify (SSE alert), or generate (auto-create campaign).

### Rule Structure

```json
{
  "name": "Aggressive LinkedIn optimization",
  "conditions": [
    { "field": "channel", "op": "eq", "value": "linkedin" },
    { "field": "delta", "op": "gt", "value": 0.15 }
  ],
  "actions": [
    { "type": "modify", "set": { "strategy": "textgrad", "threshold": 0.6 } }
  ],
  "scope": { "pipeline": "content-flywheel" },
  "priority": 10,
  "cooldown_minutes": 30
}
```

### Condition Operators

| Operator | Meaning |
|----------|---------|
| `eq`, `neq` | Equality |
| `gt`, `gte`, `lt`, `lte` | Comparison |
| `in`, `not_in` | Set membership |
| `contains` | String/array contains |
| `between` | Range (for dates, numbers) |
| `in_group` | Channel is member of named group |
| `not_in_group` | Channel is NOT in group |
| `group_avg_gt` | Group's average metric exceeds value |
| `group_trend` | Group's trend is `rising` / `falling` / `stable` |
| `group_rank` | Channel's rank within its group |
| `and`, `or`, `not` | Logical combinators for nested groups |

### Action Types

| Action | Effect |
|--------|--------|
| `gate` | Stop pipeline execution for this event |
| `modify` | Override pipeline config for this cycle |
| `route` | Trigger a different pipeline |
| `notify` | Push SSE alert to dashboard |
| `generate` | Auto-create a campaign with specified params |

### Evaluation Flow

```
Event fires
  → Match to pipeline(s) by scope
  → For each pipeline:
      1. Load rules sorted by priority
      2. Evaluate conditions against event payload + tenant context
      3. If any GATE rule matches → skip pipeline, log reason
      4. Collect all MODIFY rules → merge config overrides
      5. Collect all ROUTE rules → queue additional pipelines
      6. Collect all NOTIFY rules → push SSE events
      7. Collect all GENERATE rules → queue campaign briefs
      8. Run pipeline evaluate → act → learn with merged config
  → Log rule evaluations to loop_events for lineage
```

### Example Rules

**Never auto-deploy to email without approval:**
```json
{
  "conditions": [{ "field": "channel", "op": "eq", "value": "email" }],
  "actions": [{ "type": "modify", "set": { "hitl_policy": "require_approval" } }],
  "scope": { "pipeline": "content-flywheel" }
}
```

**Severe sentiment drop — alert and auto-generate response:**
```json
{
  "conditions": [
    { "field": "direction", "op": "eq", "value": "negative" },
    { "field": "zScore", "op": "gt", "value": 2.5 }
  ],
  "actions": [
    { "type": "notify", "message": "Critical sentiment drop detected for {{brand}}" },
    { "type": "generate", "channels": ["linkedin", "instagram"], "tone": "empathetic", "goal": "Address negative sentiment about {{brand}}: {{themes}}" }
  ],
  "scope": { "event": "sentiment.drift_detected" }
}
```

**Pause all optimization during product launch week:**
```json
{
  "conditions": [{ "field": "now", "op": "between", "value": ["2026-03-01", "2026-03-07"] }],
  "actions": [{ "type": "gate" }],
  "scope": { "pipeline": "*" }
}
```

**Promote underperformers, maintain high-performers:**
```json
[
  {
    "conditions": [{ "field": "channel", "op": "in_group", "value": "underperformers" }],
    "actions": [{ "type": "modify", "set": { "strategy": "textgrad", "threshold": 0.3 } }],
    "scope": { "pipeline": "content-flywheel" }
  },
  {
    "conditions": [{ "field": "channel", "op": "in_group", "value": "high-performers" }],
    "actions": [{ "type": "modify", "set": { "strategy": "ga", "cadence_min": 360 } }],
    "scope": { "pipeline": "content-flywheel" }
  }
]
```

---

## 5. Channel Groups

Three types of groups enable rules to target collections of channels instead of individual ones.

### Static Groups

Customer-defined, explicit membership:
- `social-organic`: linkedin, facebook, instagram, tiktok
- `video`: tiktok, youtube, vimeo, video
- `direct-messaging`: email, sms, whatsapp, voice

### Behavioral Groups

System-generated from engagement patterns, auto-refreshing:
- `high-performers`: top 25% engagement this month
- `underperformers`: bottom 25% engagement
- `growing`: positive trend over 4 weeks
- `stable`: flat, consistent performance

Recalculated on every `optimization.completed` event. Channels move between groups as performance shifts.

### Audience-Matched Groups

Channels grouped by which audience segments engage with them:
- `enterprise-preferred`: linkedin, email, voice (enterprise accounts engage here)
- `smb-preferred`: instagram, tiktok, sms (SMBs engage here)

Determined by crossing channel engagement data with signal/account data.

### Default Groups Per Tenant

Every new tenant gets seeded with:
- `all-channels` (static): all 11 channels
- `social` (static): linkedin, facebook, instagram, tiktok
- `video` (static): tiktok, youtube, vimeo, video
- `direct-messaging` (static): email, sms, whatsapp, voice
- `high-performers` (behavioral, auto-refresh)
- `underperformers` (behavioral, auto-refresh)
- `growing` (behavioral, auto-refresh)

### AI Integration

Three MCP tools for group management:
- **`suggest_channel_groups()`** — AI clusters channels by engagement similarity
- **`explain_group_performance(group_name)`** — AI describes group health and contributors
- **`optimize_group_rules()`** — AI reviews rule firing + group membership, suggests adjustments

---

## 6. Data Model

### prompt_versions

```sql
CREATE TABLE prompt_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,
  channel_group   TEXT,
  system_prompt   TEXT NOT NULL,
  instruction     TEXT NOT NULL,
  version         INTEGER NOT NULL,
  parent_id       UUID REFERENCES prompt_versions(id),
  strategy        TEXT,
  quality_score   NUMERIC,
  engagement_score NUMERIC,
  status          TEXT NOT NULL DEFAULT 'candidate'
                  CHECK (status IN ('candidate', 'active', 'retired', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at    TIMESTAMPTZ
);
```

Status flow: `candidate` → HITL approve → `active` (or `rejected`). When a better prompt activates, the old one moves to `retired`. One `active` per tenant+channel.

### content_lineage

```sql
CREATE TABLE content_lineage (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prompt_version_id     UUID NOT NULL REFERENCES prompt_versions(id),
  published_content_id  UUID REFERENCES published_content(id),
  campaign_id           UUID REFERENCES campaigns(id),
  experiment_arm_id     UUID REFERENCES experiment_arms(id),
  channel               TEXT NOT NULL,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  engagement_score      NUMERIC,
  engagement_updated_at TIMESTAMPTZ
);
```

### loop_events

```sql
CREATE TABLE loop_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  pipeline_id  UUID REFERENCES loop_pipelines(id),
  rule_ids     UUID[],
  outcome      TEXT NOT NULL CHECK (outcome IN ('processed', 'gated', 'error', 'skipped')),
  outcome_data JSONB,
  duration_ms  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### loop_pipelines

```sql
CREATE TABLE loop_pipelines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  event_type  TEXT NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  run_count   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### loop_rules

```sql
CREATE TABLE loop_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  conditions       JSONB NOT NULL,
  actions          JSONB NOT NULL,
  scope            JSONB NOT NULL DEFAULT '{}',
  priority         INTEGER NOT NULL DEFAULT 50,
  cooldown_minutes INTEGER NOT NULL DEFAULT 0,
  last_fired_at    TIMESTAMPTZ,
  fire_count       INTEGER NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### loop_channel_groups

```sql
CREATE TABLE loop_channel_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('static', 'behavioral', 'audience')),
  channels     TEXT[] NOT NULL,
  criteria     JSONB,
  auto_refresh BOOLEAN NOT NULL DEFAULT false,
  refreshed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes

```sql
-- Active prompt for channel
CREATE INDEX idx_prompt_versions_active ON prompt_versions(tenant_id, channel, status) WHERE status = 'active';

-- Lineage by content
CREATE INDEX idx_content_lineage_content ON content_lineage(published_content_id);

-- Lineage by prompt
CREATE INDEX idx_content_lineage_prompt ON content_lineage(prompt_version_id);

-- Recent events
CREATE INDEX idx_loop_events_tenant_time ON loop_events(tenant_id, created_at DESC);

-- Active rules
CREATE INDEX idx_loop_rules_active ON loop_rules(tenant_id, active) WHERE active = true;

-- Auto-refresh groups
CREATE INDEX idx_channel_groups_refresh ON loop_channel_groups(tenant_id, type, auto_refresh) WHERE auto_refresh = true;
```

### Lineage Power Query

```sql
-- Show full prompt evolution chain for a channel
WITH RECURSIVE lineage AS (
  SELECT id, parent_id, version, quality_score, engagement_score, strategy, created_at
  FROM prompt_versions
  WHERE tenant_id = $1 AND channel = $2 AND status = 'active'

  UNION ALL

  SELECT p.id, p.parent_id, p.version, p.quality_score, p.engagement_score, p.strategy, p.created_at
  FROM prompt_versions p
  JOIN lineage l ON p.id = l.parent_id
)
SELECT * FROM lineage ORDER BY version ASC;
```

---

## 7. MCP Tools for AI Access

Eight new MCP tools give the AI full read/write access to the loop system:

| Tool | Purpose | Customer Value |
|------|---------|----------------|
| `get_loop_status` | Pipeline run counts, last run times, active rules | "How are my loops performing?" |
| `get_prompt_lineage(channel)` | Full evolution chain with scores | "Show me how my email got better" |
| `suggest_rule(context)` | AI proposes rules from engagement patterns | "What rules should I add?" |
| `explain_rules(pipeline)` | Plain English rule descriptions | "What rules are active?" |
| `evaluate_rule_impact(rule_id)` | Fire count, outcome analysis | "Is this rule working?" |
| `suggest_channel_groups()` | Behavioral clustering proposal | "How should I group channels?" |
| `get_loop_insights(days)` | Cross-pipeline performance summary | "What did the system learn this week?" |
| `configure_pipeline(name, config)` | Modify pipeline thresholds/strategy | "Make optimization more aggressive" |

The `get_loop_insights` tool produces summaries like:

> "This week: 14 optimization cycles ran. Email prompts evolved 2 generations (engagement +8%). Sentiment drift detected Tuesday — auto-generated Instagram response campaign got 2.3x normal engagement. 2 experiment arms resolved, TikTok 'question hook' variant won. 5 accounts moved from warm to hot."

---

## 8. Wiring Existing Services — Integration Points

Nine places where existing code gets an `emit()` call to connect to the event bus.

### Wire 1: Engagement Collection → Event Bus

**Files:** `src/services/engagement/collector.ts`, `src/routes/webhooks/meta.ts`

After collecting engagement metrics or receiving webhook, emit `engagement.collected`.

### Wire 2: Threshold Check → Event Bus

**File:** `src/services/engagement/optimizer-trigger.ts`

Register `shouldTriggerOptimization()` as handler for `engagement.collected`. Currently exists but is never called. When threshold exceeded, emit `engagement.threshold_reached`.

### Wire 3: Threshold → EvoAgentX Optimization

Content flywheel pipeline handles `engagement.threshold_reached`:
1. Look up active `prompt_version` for this channel
2. Gather recent `content_lineage` entries with engagement scores
3. Call `runLearningIteration()` — currently only used in tests
4. Store result as new `prompt_version` (status: candidate, parent: current)
5. Apply HITL policy
6. Emit `optimization.completed`

### Wire 4: Sentiment Drift → Campaign Generation

**File:** `src/services/sentiment/analyzer.ts`

After `detectDrift()` finds significant drift, emit `sentiment.drift_detected`. Strategic reactor pipeline builds `ContentBrief` from drift context and routes through Phase 7 content generation.

### Wire 5: Delivery → Experiment Auto-Reward

**Files:** `src/routes/zeluto-webhook.ts`, platform publish routes

After delivery completion, emit `delivery.completed`. Experiment auto-closer maps engagement to experiment arms, calls `updateArm()`, checks convergence.

### Wire 6: Delivery → Signal Score Updates

Same `delivery.completed` event. Signal feedback pipeline updates account scores based on engagement/bounce/unsubscribe behavior.

### Wire 7: Content Generation → Lineage Tracking

**File:** `src/adapters/channels/generator.ts`

After `generateForChannel()`, insert `content_lineage` record linking prompt version to generated content.

### Wire 8: Optimization → Channel Group Refresh

`optimization.completed` triggers behavioral group recalculation. Channels may move between groups based on updated engagement data.

### Wire 9: Startup Registration

On server boot: create EventBus instance, register all pipeline handlers, start engagement polling interval (default 4h), start behavioral group refresh interval (default 6h).

---

## 9. Customer Dashboard Value

What the customer sees in the frontend:

- **Loop Status Panel**: Each pipeline shown with status indicator, last run time, cycle count, trend arrow
- **Evolution Timeline**: Visual chain of prompt generations per channel with quality/engagement scores at each node
- **Rules Panel**: Active rules with AI-generated plain English descriptions, firing history, one-click templates
- **Channel Groups Map**: Visual cluster of channels by behavioral similarity, with group health indicators
- **Insights Feed**: AI-generated weekly summary of what the system learned and how it improved
- **Real-time SSE notifications**: Instant alerts when loops fire, experiments resolve, drift detected, accounts move tiers
