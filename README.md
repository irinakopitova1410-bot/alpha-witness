# ALPHA WITNESS

ALPHA WITNESS is an evidence-first Next.js TypeScript MVP. It creates a **public, read-only guest case** from a public URL, pasted text, a name, ticker, or PDF metadata. It is not investment advice and never authorizes a real trade.

## Local setup

Requirements: Node.js 20.9+ and npm 10+.

```bash
cp .env.example .env.local
npm install
npm test
npm run lint
npm run build
npm run dev
```

`STORAGE_BACKEND=local` is the default and writes JSON cases to `data/cases/` for local development only. Vercel's filesystem is ephemeral; do not use local storage for production persistence.

## Public guest-case contract

- A new case receives a 144-bit random, link-addressable ID. Cases are intentionally shareable and read-only by anyone with the link.
- `GET /api/cases` does **not** list cases. There is no public enumeration endpoint.
- Detail API and detail pages return only `shareable=true`, non-archived guest cases. The Yan Novikov record is a separate, clearly labeled archived local sample.
- The public serializer never returns an intake `value`, private notes, or PDF/base64/binary data. Pasted text is preserved in the public evidence ledger for evidence integrity, so users must not submit confidential, personal, or proprietary content.
- Private notes are disabled. `POST /api/cases/:id/notes` returns `401 NOTES_REQUIRE_OWNER_AUTHENTICATION` until real owner authentication is implemented.

## Evidence, acquisition, and analysis

- URL acquisition accepts HTTP(S) only, rejects credentials and reserved/private DNS results, rechecks redirect targets, observes matching `robots.txt` `Disallow` directives, reads at most 2 MB, and has an eight-second timeout that covers both headers and body streaming.
- These checks do **not** claim complete DNS-rebinding protection: a runtime connection can still resolve differently after the application-level DNS check. Deploy behind network egress controls if this threat matters.
- PDFs are limited to 2 MB server-side. Their SHA-256 and metadata are recorded, but bytes are not persisted and extraction is explicitly `NON_AVAILABLE`; no PDF-text claims are generated.
- With no `GEMINI_API_KEY`, analysis is `ANALYSIS_TEMPORARILY_UNAVAILABLE` and no synthetic claims are made. Gemini output requires a non-empty statement, exactly one known `evidenceId`, and non-empty quotations that occur verbatim in that exact evidence item. Accepted quotations remain byte-for-byte as returned.
- Provider transport/timeouts map to `ANALYSIS_TEMPORARILY_UNAVAILABLE`; malformed or partly rejected provider output maps to `PARTIAL_ANALYSIS`; unavailable source text/PDF extraction maps to `NON_AVAILABLE`; acquisition failures map to `SOURCE_ACCESS_FAILED` (or `BLOCKED` for rejected access).
- Minimal case-creation and Gemini rate limits are in-memory per process/IP-when-proxy headers are available (8 and 12 per 10 minutes). This is a free-tier guard only: serverless instances/cold starts do not share state. Use a shared limiter before relying on it for distributed abuse protection.

## Supabase / Vercel production setup

1. Create a Supabase project and run `supabase/migrations/001_alpha_witness.sql` in the SQL Editor.
2. In Vercel Project Settings → Environment Variables, set `STORAGE_BACKEND=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Optionally set `GEMINI_API_KEY` and `GEMINI_MODEL`.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only: never prefix it with `NEXT_PUBLIC_`, place it in browser code, or commit it. The adapter uses direct server-side Supabase REST calls; no Supabase SDK is required.
4. Deploy with `npm run build`. The migration enables RLS and grants the `anon` role read access only to `shareable=true AND archived=false` case rows. It creates no anonymous write policy. Server writes use the service-role key, which bypasses RLS.

The schema does not contain private notes. Implement authenticated ownership and a separate owner-scoped notes table before adding notes back.

## Remaining MVP limitations

No real market-data provider, PDF text extraction, YouTube transcript acquisition, background queue, distributed rate limiter, authentication, or comprehensive DNS-rebinding defense is implemented. Gemini remains optional and provider output may be unavailable or only partially accepted. The archived sample at `/cases/archived-yan-novikov` is not a live-generated case.
