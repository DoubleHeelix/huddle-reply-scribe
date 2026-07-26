# Huddle Play

Huddle Play turns a conversation screenshot and a rough draft into a concise, human reply. It combines OCR, the signed-in user's accepted replies, approved document knowledge, and a style profile without exposing provider credentials to the browser.

## Local development

Requirements:

- Node.js 22.13 or newer
- npm
- a Supabase project with the migrations in `supabase/migrations`

```sh
npm ci
cp .env.example .env
npm run dev
```

Run the complete local quality gate with:

```sh
npm run check
```

## Generation architecture

- `enhanced-ai-suggestions` is the single reply-generation endpoint.
- User identity always comes from the bearer token.
- One embedding is reused for Huddle retrieval, document retrieval, and persistence.
- The client receives typed NDJSON metadata, token, and completion events.
- A request ID replays completed work and prevents duplicate paid generations or Huddles when the one bounded retry runs.
- Every generation, source, acceptance action, and provider usage record is durable.
- The default route stays on the proven cost-efficient model. A cheaper candidate is applied only after at least 25 evaluated samples and an explicit database flag.
- Huddle reply requests do not set an output-token ceiling.

## Cost controls

Generation cost is controlled by model routing and duplicate-call prevention, not by truncating replies:

- at most two attempts for retryable failures;
- completed idempotent requests are replayed without another provider call;
- no duplicate document-search embedding;
- no embedding on retry or regeneration when the stored embedding is available;
- a configurable daily generation admission limit;
- token and optional estimated-cost ledger rows;
- no automatic premium/flagship escalation;
- an offline candidate-model evaluation command:

```sh
OPENAI_API_KEY=... CANDIDATE_MODEL=... npm run eval:huddle
```

The command never enables a model automatically. Review at least 25 representative outputs before changing `model_routing_policies`.

## Supabase Edge Function secrets

See `supabase/functions/.env.example`. Store real values as Supabase secrets; never commit them. `OPENAI_PRICING_USD_PER_MILLION` is configuration so pricing can be updated without changing application code.

## Deployment

The included multi-stage Docker image runs tests, lint, TypeScript, and the production build before creating the Nginx image. GitHub Actions runs the same checks on pull requests and `main`.
