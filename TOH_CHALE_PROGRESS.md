# Toh Chale — Full Context, Build & Progress

> Last updated: 2026-04-02

---

## What Is This

**Toh Chale** is a WhatsApp-native group travel coordination platform for Indian millennials planning domestic trips together. It is NOT a booking platform — it solves the coordination problem: getting a group of friends to agree on a destination, split roles, vote on hotels, and lock an itinerary, all over WhatsApp with zero app downloads or logins required.

- **Repo:** https://github.com/addydeepak27/Travel-Tech-Repo
- **Local:** `/Users/adityadeepak/tripsquad/`
- **Brand:** Toh Chale (was TripSquad — fully renamed everywhere in source)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.2 + React 19 + TypeScript |
| Database | Supabase (PostgreSQL) |
| AI | Anthropic Claude Sonnet 4.6 |
| Messaging | Twilio WhatsApp API |
| Deployment | Vercel (cron: hourly nudges) |
| Styling | Tailwind CSS 4 |

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                        ← Onboarding wizard (5 steps)
│   ├── join/[tripId]/page.tsx          ← Invite landing page
│   ├── avatar/[tripId]/[memberId]/     ← Role picker
│   ├── trip/[tripId]/                  ← Member dashboard (4 tabs)
│   ├── organizer/[tripId]/             ← Organizer control panel
│   ├── preferences/[tripId]/[memberId] ← Travel preferences form
│   ├── hotels/[tripId]/                ← Hotel shortlist
│   ├── itinerary/[tripId]/             ← Day-by-day itinerary
│   └── api/
│       ├── trip/create/route.ts        ← Create trip + send Twilio invites
│       ├── trip/lookup/route.ts        ← 6-letter code lookup
│       ├── trip/[tripId]/
│       │   ├── join-info/route.ts      ← Service-role fetch for join page
│       │   └── avatar-info/route.ts   ← Service-role fetch for avatar page
│       ├── claude/destinations/        ← AI destination suggestions
│       ├── claude/hotels/              ← AI hotel shortlist
│       ├── claude/itinerary/           ← AI day-by-day itinerary
│       ├── claude/tips/                ← AI cost-saving tips
│       ├── webhook/twilio/route.ts     ← Inbound WhatsApp handler (10 event types)
│       ├── cron/nudge/route.ts         ← Automated 3-stage reminders
│       └── organizer/nudge/route.ts    ← Manual organizer nudges
├── lib/
│   ├── claude.ts       ← Claude AI integration (4 functions)
│   ├── twilio.ts       ← Twilio client + phone formatting
│   ├── whatsapp.ts     ← Rate-limited send (max 2/user/day)
│   ├── supabase.ts     ← anon client + createServiceClient()
│   ├── brownie.ts      ← Gamification points logic
│   ├── trip-checks.ts  ← Trip status validation + budget zone
│   ├── vote-context.ts ← Vote management
│   ├── constants.ts    ← Avatar/budget/pace/activity maps
│   └── phone.ts        ← Phone formatting utilities
└── types/index.ts      ← All types + AVATAR_META + BUDGET_TIER_META
```

---

## Database Schema (Supabase)

**Core tables:** `trips`, `members`, `votes`, `mission_tasks`, `for_you_callouts`

**Tracking tables:** `brownie_events`, `nudges`, `processed_messages` (webhook dedup), `message_log` (rate limiting)

**Key detail:** `destination_options` column is JSONB storing `{ name, emoji }` objects (migrated from `TEXT[]` in migration 002).

**Trip status flow:**
```
inviting → avatar_collection → budget_collection → destination_vote
→ hotel_vote → itinerary_preferences → itinerary_vote → locked
```

**Member status flow:**
```
invited → consented → avatar_selected → budget_submitted → active
(decline / drop paths also exist)
```

---

## 7 Avatar Roles

| Avatar | Icon | What they own |
|---|---|---|
| Planner | 📋 | Trip skeleton, itinerary, group coordination (organizer default) |
| Navigator | 🧭 | All transport — pickups, transfers, Day 1 plan |
| Budgeteer | 💰 | Pre-trip costs, splits, per-person estimates |
| Foodie | 🍜 | Restaurant shortlist, reservations, dietary needs |
| Adventure Seeker | 🏄 | Activities, permits, group briefings |
| Photographer | 📷 | Photo spots, golden hour windows |
| Spontaneous One | ✨ | Hidden gems, backup plans, surprises |

---

## Critical Architecture Rules

1. **Never use anon Supabase client in client components** — RLS blocks reads silently (data returns null, page hangs). Always use service-role API routes.
2. **Service client:** `createServiceClient()` from `@/lib/supabase` — server-side only
3. **Data fetching routes:** `/api/trip/[tripId]/join-info`, `/api/trip/[tripId]/avatar-info`
4. **`NEXT_PUBLIC_APP_URL=http://localhost:3000`** in `.env.local`
5. **WhatsApp rate limit:** max 2 messages/user/day via `message_log` table
6. **`destination_options`** is JSONB `{ name, emoji }[]`, never plain strings

---

## Full Feature List (MVP — Built)

### User flows
- **Onboarding wizard** (5 steps): identity → intent (create/join) → destination picker (50+ Indian cities) → trip creation → share screen
- **Group vote mode:** organizer picks 2–3 destinations, squad votes to finalize
- **Organizer pick mode:** organizer decides destination directly
- **Join flow:** invite link → consent → avatar selection → preferences → voting
- **Avatar selection:** 7 roles, 2-tap confirm UX, fun taglines, live availability counter
- **Trip dashboard:** Plan / Tasks / Squad / You tabs
- **Organizer dashboard:** Monitor / Tasks / Plan / Squad tabs + AI cost tips

### AI (Claude Sonnet 4.6)
- 3 destination suggestions (avatar-weighted, budget-aware)
- 3 hotel options (budget/mid/premium, honest caveats, booking links)
- Day-by-day itinerary + per-member "For You" callouts
- Cost-saving tips (INR-denominated, India-specific)
- Fallback responses if Claude API fails (no blank states)

### WhatsApp / Twilio
- Invite messages with host name + FOMO hook
- Quick-reply voting (destination, hotel, itinerary)
- 3-stage cron nudges (hourly Vercel cron)
- Rate limiting: 2 messages/user/day
- STOP = instant opt-out
- Webhook dedup via `processed_messages` table

### Gamification
- Brownie points (rank-based: first claimer gets max)
- 6 event types: trip acceptance, avatar selection, questionnaire, destination vote, hotel vote, itinerary vote
- WhatsApp feedback with ordinal placement ("You're 2nd! +7 brownie points")
- Leaderboard with medal rankings (🥇🥈🥉)

---

## Session Log — Apr 2, 2026

### Bugs Fixed

**1. Invite link broken (infinite loading spinner)**
- Root cause: join page + avatar page called `supabase.from('trips')` directly with anon key. Supabase RLS blocks reads → `data` returns null → `if (!data) return` never called `setLoading(false)`.
- Fix: Created `/api/trip/[tripId]/join-info` and `/api/trip/[tripId]/avatar-info` — both use `createServiceClient()` (service role key bypasses RLS).
- Split embedded relational query `members(...)` into two separate queries to avoid PostgREST FK ambiguity with the deferred `organizer_id` FK.
- Added 3x auto-retry (800ms delay) + "Try again" button so transient dev-server reloads don't strand users.

**2. Destination chips showing `[object Object]`**
- Root cause: `destination_options` is JSONB `{ name, emoji }` objects, but join page rendered `{d}` directly.
- Fix: map array to `{ name: string, emoji?: string }` before setting state; render `{d.emoji} {d.name}`.

### Copy & Messaging Changes

| What | Before | After |
|---|---|---|
| Share screen heading (group vote) | "Goa or Bust is live!" | "Goa, Manali or Coorg — squad, it's time to vote!" |
| Share screen heading (organizer pick) | "Goa or Bust is live!" | "Goa or Bust is live!" *(unchanged)* |
| Share screen subtitle (group vote) | "Invites sent. Share code." | "Once everyone joins, the squad votes on the final destination." |
| Trip name (group vote, 3 dests) | "Goa or Bust" | "Goa, Manali or Coorg" |
| Trip name (organizer pick) | "Goa or Bust" | "Goa or Bust" *(unchanged)* |
| WhatsApp share message | "Hey! I'm planning *X* on Toh Chale..." | "*Aditya* is cooking up *X* on Toh Chale 🌊\n\nDon't be the one friend who finds out from their Instagram stories 😬" |
| Twilio invite to members | "The Planner is organising *X*..." | "*Aditya* is organising *X*... + same FOMO line" |
| Brand name everywhere | TripSquad | **Toh Chale** |

### Avatar Page Overhaul

- Fixed same RLS bug (uses `avatar-info` API route now)
- Non-organizers in small groups (<3) only saw 3 avatar options → now always shows all 6
- **Two-tap confirm UX:** first tap expands card (shows description + missions + confirm button), second tap claims role — prevents accidental selections
- **Fun taglines per avatar:**
  - Planner: *"Someone has to be the adult. Congrats, it's you. 😅"*
  - Navigator: *"Getting everyone from A to B without losing anyone. No pressure. 🗺️"*
  - Budgeteer: *"You'll be everyone's favourite person… until the bill arrives. 💸"*
  - Foodie: *"The most important job on any trip. Don't let the group eat badly. 🙏"*
  - Adventure Seeker: *"Your job is to make sure everyone has a story to tell. 🤙"*
  - Photographer: *"You'll miss the moment, but the group will have the perfect photo of it. 📸"*
  - Spontaneous One: *"Plan? What plan? You ARE the plan. ✨"*
- Live availability signal: *"4 roles still up for grabs"* in header
- Missions section in expanded card shows tasks + deadline badges

### Tooling
- Stop hook added to `~/.claude/settings.json` — auto-appends session entry to `CLAUDE.md` and commits to git on every session end

---

## Ideas & Next Features (Not Yet Built)

### High priority
- **FOMO mechanics (22-step framework)**
  WhatsApp trigger sequence using social proof, loss aversion, scarcity, and identity pressure to drive member action (avatar claiming, voting, preference submission)

- **Dissent / fallback voting**
  When members vote "disagree" on itinerary, trigger a targeted re-vote on specific days or activities rather than the full itinerary

- **Organizer abandonment escalation**
  If organizer is inactive for 5+ days, auto-transfer trip ownership to the most-engaged squad member (highest brownie points / most actions taken)

### Medium priority
- Post-trip photo album integration
- Expense settlement post-trip
- Native iOS/Android app (currently PWA only)
- Real-time collaborative itinerary editing
- Drag-and-drop itinerary reordering

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_MAPS_API_KEY=          # optional
```
