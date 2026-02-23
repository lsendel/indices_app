# Phase 7: Multi-Channel Content Generation + Multi-Provider LLM — Design

## Goal

Add a provider-agnostic LLM abstraction with 6 providers and channel-aware content generation for 12 channels, replacing the single OpenAI adapter with a task-routed multi-provider system.

## Architecture

Strategy pattern with a router. Each LLM provider implements a common `LLMProvider` interface. An `LLMRouter` maps task types (content, research, analysis) to the best provider. Channel generators compose with the router to produce platform-specific content respecting each channel's constraints.

```
ContentBrief
    ↓
Channel Generator (email.ts, tiktok.ts, ...)
    ↓ applies platform constraints to prompt
LLMRouter
    ↓ resolves task → provider
LLMProvider (Claude, OpenAI, Gemini, ...)
    ↓ generates structured output
Channel-specific content (EmailContent, TikTokContent, ...)
```

## Tech Stack

- `openai` — OpenAI, Perplexity (compatible), Grok (compatible)
- `@anthropic-ai/sdk` — Claude
- `@google/generative-ai` — Gemini
- `@huggingface/inference` — HuggingFace Inference API
- `zod` — Structured output validation

---

## LLM Provider Abstraction

### Common Interface

```typescript
interface LLMProvider {
  name: string
  generateText(prompt: string, opts?: GenerateOpts): Promise<string>
  generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T>
  capabilities: Set<'text' | 'json' | 'vision' | 'search' | 'realtime'>
}

interface GenerateOpts {
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  model?: string
}
```

### 6 Providers

| Provider | SDK | Default Model | Capabilities | Best For |
|----------|-----|---------------|--------------|----------|
| OpenAI | `openai` | gpt-4o | text, json, vision | Social posts, sentiment |
| Claude | `@anthropic-ai/sdk` | claude-sonnet-4-20250514 | text, json | Email copy, personas, reasoning |
| Gemini | `@google/generative-ai` | gemini-2.0-flash | text, json, vision | Video scripts, multimodal |
| Perplexity | `openai` (compatible) | sonar-pro | text, json, search | Competitive intel, research |
| Grok | `openai` (compatible) | grok-3 | text, json, realtime | Trending topics, X data |
| HuggingFace | `@huggingface/inference` | varies | text, json | Specialized/open models |

### Task-to-Provider Routing

```typescript
const defaultRouting: Record<string, string> = {
  // Content generation
  'content:email': 'claude',
  'content:sms': 'openai',
  'content:voice': 'claude',
  'content:whatsapp': 'openai',
  'content:linkedin': 'claude',
  'content:facebook': 'openai',
  'content:instagram': 'openai',
  'content:tiktok': 'gemini',
  'content:youtube': 'gemini',
  'content:vimeo': 'gemini',
  'content:video': 'gemini',
  // Research
  'research:competitive': 'perplexity',
  'research:trending': 'grok',
  // Analysis
  'analysis:sentiment': 'openai',
  'analysis:persona': 'claude',
}
```

---

## Channel Content Generation

### 12 Channels

| Channel | Format | Key Constraints |
|---------|--------|-----------------|
| Email | HTML + text | Subject ≤60 chars, preheader ≤100, CTA required |
| SMS | Plain text | 160 chars (or 320 multi-part) |
| Voice | Script text | Duration-based (30s/60s/90s), conversational tone |
| WhatsApp | Rich text + media | 4096 chars, template-based for business API |
| LinkedIn | Text + media | Post ≤3000 chars, article format option |
| Facebook | Text + media | Post ≤63,206 chars, image/video optional |
| Instagram | Caption + media | Caption ≤2200 chars, 30 hashtags max, visual-first |
| TikTok | Video script | ≤60s, hook-body-CTA structure, captions, hashtags ≤5 |
| YouTube | Video script + metadata | Title ≤100, description ≤5000, tags, chapters, thumbnail |
| Vimeo | Video script + metadata | Title ≤128, description, tags, privacy settings |
| Video (generic) | Script + storyboard | Duration-flexible, shot list, thumbnail concept |

### Content Brief (input)

```typescript
interface ContentBrief {
  goal: string
  product: string
  audience: string
  tone: string
  keywords?: string[]
  campaignId?: string
  brandKitId?: string
}
```

### Channel Output Types

```typescript
interface EmailContent {
  subject: string
  preheader: string
  bodyHtml: string
  bodyText: string
  cta: { text: string; url: string }
}

interface SMSContent {
  message: string
  parts: number
}

interface VoiceContent {
  script: string
  duration: number
  tone: string
}

interface WhatsAppContent {
  message: string
  templateName?: string
  mediaUrl?: string
  buttons?: Array<{ text: string; url: string }>
}

interface SocialContent {
  text: string
  hashtags: string[]
  mediaPrompt?: string
  cta?: string
}

interface VideoScriptContent {
  script: string
  duration: number
  shots: Array<{ type: string; seconds: string; visual: string; audio: string }>
  captions: string
  hashtags: string[]
  thumbnailConcept: string
}

interface YouTubeContent extends VideoScriptContent {
  title: string
  description: string
  tags: string[]
  chapters: Array<{ timestamp: string; title: string }>
}

interface VimeoContent extends VideoScriptContent {
  title: string
  description: string
  tags: string[]
}
```

### API Endpoints

```
POST /api/v1/content/generate
Body: { channel: string, brief: ContentBrief, provider?: string }
Response: channel-specific content object

POST /api/v1/content/generate/batch
Body: { channels: string[], brief: ContentBrief }
Response: { results: Record<channel, content> }

GET  /api/v1/content/channels
Response: { channels: ChannelConfig[] }

GET  /api/v1/llm/providers
Response: { providers: Array<{ name, capabilities, status }> }
```

---

## Configuration

### Environment Variables

```
# Existing
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o

# New
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
PERPLEXITY_API_KEY=...
GROK_API_KEY=...
HUGGINGFACE_API_KEY=...
```

Providers with missing API keys are gracefully disabled — the router falls back to the next available provider for that task type.

---

## File Structure

```
src/
├── adapters/
│   ├── openai.ts              # DEPRECATED — replaced by llm/openai.ts
│   ├── llm/
│   │   ├── types.ts           # LLMProvider interface, GenerateOpts
│   │   ├── router.ts          # LLMRouter — task→provider + fallback
│   │   ├── openai.ts          # OpenAI provider
│   │   ├── claude.ts          # Claude provider
│   │   ├── gemini.ts          # Gemini provider
│   │   ├── perplexity.ts      # Perplexity provider
│   │   ├── grok.ts            # Grok/xAI provider
│   │   ├── huggingface.ts     # HuggingFace Inference API provider
│   │   └── index.ts           # createLLMRouter factory
│   └── channels/
│       ├── types.ts           # ContentBrief, channel output types
│       ├── config.ts          # Platform constraints (12 channels)
│       ├── generator.ts       # generateForChannel orchestrator
│       ├── email.ts           # Email prompt builder
│       ├── sms.ts
│       ├── voice.ts
│       ├── whatsapp.ts
│       ├── linkedin.ts
│       ├── facebook.ts
│       ├── instagram.ts
│       ├── tiktok.ts
│       ├── youtube.ts
│       ├── vimeo.ts
│       ├── video.ts           # Generic video script
│       └── index.ts
├── routes/
│   └── content.ts             # /api/v1/content/* endpoints
├── types/
│   └── api.ts                 # content generation Zod schemas
```

---

## Integration with Existing System

- **Campaign channels enum** expands from `['email', 'sms', 'voice', 'linkedin']` to all 12. Requires Drizzle migration.
- **EvoAgentX** can optimize content prompts per channel via the learning loop.
- **Brand kits** feed voice rules into `ContentBrief.tone`.
- **Zeluto sync** gets new channel types for content delivery.
- **Existing `openai.ts` adapter** is replaced — all callers (`analyzeSentiment`, `generateContent`) migrate to the new `LLMRouter`.
- **MCP tools** (`generate_persona`, `audit_brand_content`, etc.) use the router instead of direct OpenAI calls.

---

## Testing Strategy

- Unit tests for each provider adapter (mock HTTP)
- Unit tests for each channel generator (verify constraints applied)
- Unit tests for router (task mapping, fallback)
- Integration test: brief → channel generator → mock provider → validate output shape
- Target: 80%+ coverage on providers and channels
