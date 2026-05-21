# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:8080
npm run build        # Production build
npm run lint         # ESLint check
npm run test         # Run Vitest tests once
npm run test:watch   # Run Vitest in watch mode
```

To run a single test file:
```bash
npx vitest run src/path/to/file.test.ts
```

## Architecture

**Monto** is a group savings pot app — users create shared "pots", contribute via Stripe, and can request withdrawals paid out via Stripe Connect.

### Stack
- **Frontend**: React 18 + TypeScript + Vite, React Router v6, TanStack Query, shadcn/ui + Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + Realtime + Edge Functions in Deno)
- **Payments**: Stripe Checkout (contributions) + Stripe Connect (payouts)
- **i18n**: i18next — EN, FR, DE, ES (default: FR, fallback: EN)

### Key data model
- `pots` — group savings pots (balance, currency, withdrawal rules, emoji)
- `pot_members` — membership with roles: `member`, `leader`, `creator`
- `transactions` — deposits/withdrawals linked to Stripe sessions
- `withdrawals` — withdrawal requests with status flow: `pending → approved/rejected`
- `expenses` — receipt uploads attached to withdrawals
- `profiles` — user profile + Stripe Connect account info

### Frontend structure
```
src/
  pages/          # Route-level components (MyPots, PotDetail, Profile, …)
  components/     # Reusable components (modals, forms, UI widgets)
  components/ui/  # shadcn/ui primitives (don't edit these)
  contexts/       # AuthContext (session + user), DarkModeContext
  hooks/          # usePots, useLoadingTimeout, use-toast, use-mobile
  lib/            # authRecovery, inviteJoin, generatePotReport, utils, constants
  i18n/locales/   # Translation JSON files per language
  integrations/supabase/  # client.ts + auto-generated types.ts
```

`AuthContext` provides `session`, `user`, `loading`, `signOut()`. All protected routes are wrapped in `<ProtectedRoute>` in `App.tsx`.

React Query is configured with `staleTime: 1min`, `gcTime: 10min`, `retry: 1`.

### Edge functions (`supabase/functions/`)
All browser-facing functions import CORS headers from `_shared/cors.ts` (allowed: `montofinance.app`, `localhost:8080`, `localhost:5173`). When adding a new function, always import from there.

| Function | Purpose |
|---|---|
| `create-checkout-session` | Creates Stripe Checkout session for pot contributions |
| `stripe-webhook` | Handles `checkout.session.completed` → updates balance |
| `create-connect-account` | Sets up Stripe Connect account for a user |
| `stripe-connect-webhook` | Handles Stripe Connect account events |
| `create-withdrawal` | Inserts a withdrawal request record |
| `create-payout` | Approves withdrawal: executes Stripe transfer + deducts balance |
| `join-pot` | Joins a user to a pot via invite link (handles profile upsert) |
| `set-withdrawal-password` | Bcrypt-hashes and stores withdrawal PIN for a pot |
| `verify-withdrawal-password` | Verifies bcrypt withdrawal PIN server-side |
| `send-email-notification` | Sends transactional emails via Resend |
| `send-push-notification` | Sends Web Push notifications via VAPID |

Functions that need to read/write other users' data use `SUPABASE_SERVICE_ROLE_KEY`. The anon client + RLS is used when the user's own data is sufficient.

### Environment variables
Frontend (`import.meta.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

Edge functions (`Deno.env.get`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

### Error handling
A top-level `<ErrorBoundary>` in `src/main.tsx` catches render errors and shows a reload button. `window.addEventListener("unhandledrejection")` logs unhandled promise rejections. React Query handles query-level errors.

## Graphify knowledge graph

A knowledge graph of this codebase is available in `graphify-out/`:
- `graphify-out/graph.html` — interactive visualization (open in browser)
- `graphify-out/GRAPH_REPORT.md` — audit report with god nodes and surprising connections
- `graphify-out/graph.json` — queryable graph data

**God nodes** (most connected abstractions): `potDetail` (101 edges), `cn()` (71 edges), `auth` (58 edges), `createPot` (48 edges).

To query the graph or update it after code changes:
```bash
/graphify query "how does authentication work"   # query existing graph
/graphify --update                                # incremental re-extraction after changes
/graphify .                                       # full rebuild
```

The graphify skill is installed at `~/.claude/skills/graphify/SKILL.md` and uses Claude Code itself as the LLM — no API key needed.
