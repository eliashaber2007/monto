
# Monto – Pot Manager: Full Implementation Plan

## Overview
A clean fintech-style "group savings pot" app. Users create shared pots, invite members, and contribute via Stripe Checkout. Balances update automatically via Stripe webhooks.

---

## Phase 1 — Design System & Brand
- Apply the exact color palette to `index.css` CSS variables: primary blue `#2563EB`, dark text `#0F172A`, muted `#64748B`, border `#E2E8F0`, background `#FFFFFF`, surface `#F8FAFC`, success/warning/error
- Set up Inter-style typography, rounded corners, soft shadow card style
- Configure Tailwind to use these exact values via extended theme

---

## Phase 2 — Supabase Schema (SQL Migration)
Create 4 tables from scratch:

**`public.profiles`** — `id` (PK = auth.uid), `first_name`, `created_at`  
**`public.pots`** — `id`, `name`, `created_by` (FK → profiles), `balance` (numeric, default 0), `currency` (default 'EUR'), `created_at`  
**`public.pot_members`** — `id`, `pot_id` (FK → pots), `user_id` (FK → profiles), `role` (text: 'creator' | 'member'), `created_at`  
**`public.transactions`** — `id`, `pot_id`, `user_id`, `amount` (numeric), `stripe_session_id` (unique), `status` (text: 'pending' | 'completed'), `created_at`

Indexes on: `pot_members(pot_id)`, `pot_members(user_id)`, `transactions(pot_id)`, `transactions(stripe_session_id)`

---

## Phase 3 — RLS Policies
Enable RLS on all 4 tables. Policies:

- **profiles**: SELECT/UPDATE/INSERT only own row (`id = auth.uid()`)
- **pots**: SELECT if `auth.uid()` exists in `pot_members` for that pot; INSERT only if `created_by = auth.uid()`
- **pot_members**: SELECT if user is a member of the same pot; INSERT allowed (creator inserts self and invited members)
- **transactions**: SELECT if user is in same pot; INSERT via service role only (webhook)

---

## Phase 4 — Authentication Screens
- **Login page** (`/login`) — email + password form, link to signup
- **Signup page** (`/signup`) — email, password, first name; on success auto-inserts into `profiles`
- Auth state managed via Supabase `onAuthStateChange` listener
- Protected routes: redirect unauthenticated users to `/login`

---

## Phase 5 — My Pots Screen (Home `/`)
- Header: "My Pots" title + "Welcome back, {first_name}" subtitle
- Floating `+` button bottom-right to trigger "Create Pot" modal
- Pot cards (ordered newest first):
  - Left: circular avatar placeholder
  - Center: pot name (bold) + "1 member" + balance in blue (e.g. `€50.00`) + "0% left"
  - Right: "Creator" pill badge + chevron arrow
  - Entire card is clickable → navigates to `/pots/:id`
- "Create Pot" modal: name input → inserts into `pots` then `pot_members` as creator

---

## Phase 6 — Pot Detail Screen (`/pots/:id`)
- Top bar: back arrow, pot name, "Creator" badge, "Invite Members" button (top-right, placeholder)
- Center: large circular ring progress indicator (SVG) with big balance `€0.00` in center
- Under ring: "0% of €0.00" + "Tap to switch view" hint text
- Action row:
  - Primary full-width button: **"Request Withdrawal"** (placeholder, disabled for now)
  - Secondary button: **"+ Add Funds"** → opens Add Funds modal
- **Tabs**: Activity (default) | Leaderboard (placeholder) | Members (placeholder)
- **Activity tab**: shows "Created pot '{name}'" event with timestamp from `transactions` + pot creation event

---

## Phase 7 — Add Funds Flow (Stripe Checkout)
- "+ Add Funds" opens a modal with a simple amount input (e.g. €10, €25, €50 quick-select chips + custom input)
- On confirm → calls Edge Function `create-checkout-session` with `{ pot_id, amount }`
- Edge Function creates a Stripe Checkout Session (TEST MODE) and returns `sessionUrl`
- User is redirected to Stripe Checkout → on success redirected back to `/pots/:id?success=true`
- Success banner shown on return

---

## Phase 8 — Edge Functions

**`create-checkout-session`**:
- Validates user JWT, reads `pot_id` + `amount`
- Creates Stripe Checkout Session with `success_url`, `cancel_url`, metadata `{ pot_id, user_id }`
- Returns `{ url }` to frontend

**`stripe-webhook`**:
- Verifies Stripe signature with `STRIPE_WEBHOOK_SECRET`
- Handles `checkout.session.completed` event
- Reads `pot_id` + `user_id` from metadata
- Inserts a `transactions` row with status `'completed'`
- Updates `pots.balance += amount` using service role client
- Returns 200

---

## Phase 9 — Supabase Client & Data Layer
- Single `src/integrations/supabase/client.ts` using `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
- React Query hooks:
  - `usePots()` — fetches pots the user belongs to via pot_members join, ordered by `created_at desc`
  - `usePotDetail(id)` — fetches single pot + member count + recent transactions
  - `useProfile()` — fetches current user's profile (first_name)
- Realtime subscription on `pots` table in pot detail screen to live-update balance after webhook fires

---

## Phase 10 — Setup Checklist (Deliverable)
A clean in-app or README checklist covering:
1. Create Supabase project + run the SQL migration
2. Add Supabase env vars in Lovable (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
3. Add edge function secrets: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
4. Deploy both edge functions
5. Register Stripe webhook endpoint pointing to `stripe-webhook` function URL, subscribe to `checkout.session.completed`
6. End-to-end test: sign up → create pot → add funds → verify balance updates

---

## Screen Flow Summary
```
/login  →  /signup
              ↓
           / (My Pots list)
              ↓ click card
           /pots/:id (Detail)
              ↓ + Add Funds
           Stripe Checkout (external)
              ↓ success redirect
           /pots/:id?success=true
```

## What's NOT included (intentionally)
- No legacy columns (`test_balance`, `initial_balance`)
- No duplicate env vars
- No old endpoints or _V2 anything
- Leaderboard + Invite Members are UI placeholders (no backend logic yet, to keep scope clean)
- Withdrawal is UI placeholder (no backend)
