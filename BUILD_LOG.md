# Toh Chale — Complete Build Log
> Full context, progress from first commit to today. Local server: http://localhost:3000

---

## What Is Toh Chale

A **WhatsApp-native group travel coordination platform** for Indian friend groups planning domestic trips. Not a booking platform — it solves the coordination problem: getting everyone to agree on where to go, who owns what, how much to spend, and locking a real itinerary. All over WhatsApp, no app download, no login.

**Core insight:** The 200-message WhatsApp thread where everyone says "haan chale!" but nobody books anything. Toh Chale replaces that thread with structured decision-making, avatars that distribute ownership, anonymous budget voting, and an AI-generated itinerary that accounts for everyone's preferences.

- **Brand:** Toh Chale
- **Tagline:** "Group trips, without the chaos"
- **Repo:** https://github.com/addydeepak27/Travel-Tech-Repo
- **Local:** `/Users/adityadeepak/tripsquad/`
- **Live at:** http://localhost:3000

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16.2.2 + React 19 + TypeScript | App Router, server components, Edge-ready |
| Database | Supabase (PostgreSQL) | Real-time, RLS, service role for server ops |
| AI | Anthropic Claude Sonnet 4.6 | Destination/hotel/itinerary generation |
| Messaging | Twilio WhatsApp API | Official gateway, pre-approved templates |
| Deployment | Vercel | Serverless + cron jobs |
| Styling | Tailwind CSS 4 | Mobile-first utility CSS |
| Icons | Lucide React | Consistent icon set |
| Images | Sharp | Avatar/map card generation |

---

## Git History — Commit by Commit

```
10457e5  Initial commit                              (Mar 31)
94d1e5e  Add Group Travel MVP Plan — full PRD        (Apr 1)
588131c  Add competitive analysis vs Wanderlog       (Apr 1)
9d81987  Finalise MVP plan — build-ready             (Apr 1)
5a988f6  Initial commit from Create Next App         (Apr 1)
380b80b  feat: complete Toh Chale MVP ← BIG BANG     (Apr 1)
9b3430d  feat: onboarding redesign, engagement       (Apr 2)
fd36d68  session log: 2026-04-02 16:46              (Apr 2)
7ac5355  session log: 2026-04-02 16:47              (Apr 2)
fe0ed1b  session log: 2026-04-02 16:48              (Apr 2)
f75bf3c  session log: 2026-04-02 16:54              (Apr 2)
```

---

## Build Phase 1 — Planning (Mar 31 – Apr 1 morning)

Before a single line of product code, three planning documents were committed:

### `GROUP_TRAVEL_MVP_PLAN.md`
The full product spec. Key decisions locked here:
- **No booking** — coordination only. Avoids payment complexity entirely.
- **WhatsApp-native** — no app, no login. Works on any phone.
- **7 avatar system** — distributes ownership so the organizer doesn't burn out
- **Anonymous budget** — members submit tier (backpacker/comfortable/premium/luxury), weighted median computed server-side, never exposed individually
- **Claude for personality** — all AI output is avatar-weighted (Foodie gets meal callouts, Navigator gets transport tips)
- **4-day sprint** — MVP targeted Apr 4, 2026

### Competitive analysis
Wanderlog teardown. Key differentiation: Toh Chale wins on **group dynamics** (voting, avatar ownership, FOMO mechanics) vs Wanderlog's solo planner UX.

---

## Build Phase 2 — MVP Launch (Apr 1, commit `380b80b`)

Everything built in one large commit. What shipped:

### Pages (7 public routes)

| Route | What it does |
|---|---|
| `/` | Home — multi-step onboarding wizard |
| `/join/[tripId]` | Invite landing — consent + show trip details |
| `/avatar/[tripId]/[memberId]` | Role picker — 7 avatar cards |
| `/hotels/[tripId]` | Hotel shortlist — 3 AI-curated options |
| `/itinerary/[tripId]` | Day-by-day plan with "For You" callouts |
| `/trip/[tripId]` | Member dashboard — Plan/Tasks/Squad/You tabs |
| `/organizer/[tripId]` | Organizer panel — Monitor/Tasks/Plan/Squad |

### API Routes (8 endpoints)

| Route | Method | Purpose |
|---|---|---|
| `/api/trip/create` | POST | Create trip, insert organizer, send Twilio invites to all members |
| `/api/claude/destinations` | POST | Claude: 3 destination suggestions (avatar + budget weighted) |
| `/api/claude/hotels` | POST | Claude: 3 hotel options (budget/mid/premium, honest caveats) |
| `/api/claude/itinerary` | POST | Claude: day-by-day plan + per-member avatar callouts |
| `/api/claude/tips` | POST | Claude: 3 cost-saving tips in INR |
| `/api/maps/hotel-card` | GET | Static map generation + S3/cache |
| `/api/organizer/nudge` | POST | Organizer manually nudges specific members |
| `/api/webhook/twilio` | POST | Inbound WhatsApp handler — 10 event types |

### Database (Supabase — migration 001)

```sql
trips        — id, name, status, organizer_id, destination_options, 
               confirmed_destination, hotel_options, itinerary,
               departure_date, return_date, group_budget_zone,
               gamification_enabled, created_at

members      — id, trip_id, phone, name, avatar, budget_tier, status,
               pace_vote, spend_vote, points, opt_out, joined_at

votes        — trip_id, member_id, vote_type, value
               (composite PK: one vote per member per type)

mission_tasks — avatar-specific pre-trip tasks with deadlines + points

for_you_callouts — cached per-member itinerary callouts (generated at lock)
```

### 7 Avatar System

Each role has: icon, label, description, key tasks with deadlines, pace default, hotel preference

| Avatar | Icon | Owns |
|---|---|---|
| Planner | 📋 | Timeline, itinerary, group coordination |
| Navigator | 🧭 | All transport — pickups, transfers, Day 1 |
| Budgeteer | 💰 | Pre-trip costs, splits, per-person estimates |
| Foodie | 🍜 | Restaurant shortlist, reservations, dietary |
| Adventure Seeker | 🏄 | Activities, permits, group briefings |
| Photographer | 📷 | Photo spots, golden hour windows |
| Spontaneous One | ✨ | Hidden gems, backup plans, surprises |

### WhatsApp Integration
- Twilio client with graceful mock mode (logs "[WhatsApp MOCK]" when creds absent)
- Rate limiting: max 2 messages/user/day via `message_log` table
- STOP = instant opt-out (`opt_out = true` in members)
- Webhook handler: 10 event types (invite accept/decline, avatar pick, budget submit, destination/hotel/itinerary vote, questionnaire answers, task complete)

### 47 Edge Cases Audited
From the commit message:
- Weighted median bug fix
- RPC increment fix  
- Avatar race condition (two members claiming same role simultaneously)
- Dissent A/B/C flow
- Catch-all WhatsApp handler
- Deduplication lock (processed_messages)
- Timezone overdue fix
- Duplicate submit guard

---

## Build Phase 3 — Onboarding Redesign + Engagement (Apr 2, commit `9b3430d`)

### Multi-step home page (`/`)
Replaced single-screen form with a 5-step wizard:

```
Step 1: Identity      → name, WhatsApp number, email
Step 2: Intent        → "Plan new trip" OR "Join with code"
Step 3a: Destination  → searchable dropdown (50+ Indian cities), trending chips,
                        date picker, squad invitation textarea,
                        mode toggle: 🗳 Group votes / 📍 I'll pick
Step 3b: Join code    → 6-letter uppercase input, lookup API
Step 4: Share         → travel code display, WhatsApp share, copy link
```

### Destination picker
- 10 trending chips (Goa, Manali, Kedarkantha, Jaipur, etc.)
- 50+ Indian cities searchable by name or state
- Max 3 for group vote, max 1 for organizer pick
- Selections shown as emoji chips

### Group Vibes dashboard (`/trip/[tripId]/vibes`)
Custom SVG charts (no library):
- Donut chart — pace preference breakdown
- Bar charts — activity preferences
- Leaderboard with point totals

### Brownie points gamification
- N-to-1 scoring: first person to complete an action gets max points, each subsequent person gets fewer
- 6 event types: trip_accepted, avatar_selected, questionnaire_complete, destination_voted, hotel_voted, itinerary_voted
- WhatsApp feedback: "You're 2nd! +7 brownie points 🎉"
- `brownie_events` table deduplicates (one event per member per type)

### Cron nudges (`/api/cron/nudge`)
Hourly Vercel cron (`0 * * * *`). 3-stage nudge logic:
- Stage 1: 1h after vote opens
- Stage 2: 3h after vote opens
- Stage 3: 5h after vote opens
- Auto-close at T+48h (moves trip to next status)

### Database additions (migration 002)
```sql
-- New columns on trips
travel_code, status_updated_at, destination_vote_scheduled_at,
used_fallback, itinerary_cost_alert

-- New columns on members
email, activity_pref, trip_priority, special_requests,
brownie_points, budget_assumed, avatar_auto_assigned

-- New tables
brownie_events   — event log for gamification
nudges           — tracks which nudge stages have been sent
processed_messages — webhook deduplication (message_sid PK)
message_log      — rate limiting (max 2/user/day)

-- destination_options: TEXT[] → JSONB (stores { name, emoji } objects)
```

### Trip lookup API
6-letter travel code → tripId lookup. Used on the join step of the home wizard.

### Member preferences web fallback
`/preferences/[tripId]/[memberId]` — 4-step form for members who can't use WhatsApp quick-reply:
- Travel pace (easy chill / balanced / packed)
- Activity preferences (adventure, food, culture, etc.)
- Trip priorities
- Special requests

---

## Build Phase 4 — This Session (Apr 2, current)

All changes are **live on local server** but **uncommitted** (visible in `git status`).

### 🐛 Bug Fix: Invite Link Broken

**Symptom:** `/join/[tripId]` showed infinite "Loading trip details..." spinner, then after fix attempt showed "Trip not found".

**Root cause:** The join page called `supabase.from('trips').select(...)` directly using the **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Supabase RLS (Row Level Security) blocks anonymous reads — query returned `null` silently. The code then hit `if (!data) return` without ever calling `setLoading(false)`.

**Fix — 3 parts:**

1. **New API route** `src/app/api/trip/[tripId]/join-info/route.ts`
   - Uses `createServiceClient()` (service role key — bypasses RLS)
   - Two separate queries: `trips` then `members` (avoids PostgREST FK ambiguity with the deferred `organizer_id` circular FK)
   - Returns 404 with logged error if trip not found

2. **Join page updated** `src/app/join/[tripId]/page.tsx`
   - Calls `/api/trip/${tripId}/join-info` instead of Supabase directly
   - Auto-retries up to 3x with 800ms delay (handles dev server hot-reload hiccups)
   - Proper "Trip not found" error state with "Try again" button (re-triggers useEffect via `retryCount` state)
   - Fixed destination rendering: `destination_options` is JSONB `{ name, emoji }[]` not strings

3. **Same fix for avatar page** `src/app/avatar/[tripId]/[memberId]/page.tsx`
   - New `src/app/api/trip/[tripId]/avatar-info/route.ts`
   - Same service-role pattern

### 🎭 Avatar Page Overhaul

**Problems before:** same RLS bug; small groups (≤3 members) only saw 3 role options; dry flat UI; no confirmation step before claiming a role.

**What's live now:**

```
Before:                          After:
─────────────────────────────────────────────────────
Only 3 roles shown for           Always all 6 roles shown
small groups                     

"Navigator — You own all         "Getting everyone from A to B
transport..."                    without losing anyone. No pressure 🗺️"
(dry description)                (fun tagline first)

Tap = instant claim              Tap 1 = expand card (shows description
(accidental selections)          + missions + confirm button)
                                 Tap 2 = claim role

No availability signal           "4 roles still up for grabs" in header

2-column grid                    Full-width cards with expand/collapse
```

**Fun taglines (live):**
- Planner: *"Someone has to be the adult. Congrats, it's you. 😅"*
- Navigator: *"Getting everyone from A to B without losing anyone. No pressure. 🗺️"*
- Budgeteer: *"You'll be everyone's favourite person… until the bill arrives. 💸"*
- Foodie: *"The most important job on any trip. Don't let the group eat badly. 🙏"*
- Adventure Seeker: *"Your job is to make sure everyone has a story to tell. 🤙"*
- Photographer: *"You'll miss the moment, but the group will have the perfect photo of it. 📸"*
- Spontaneous One: *"Plan? What plan? You ARE the plan. ✨"*

### ✍️ Copy & Messaging Overhaul

**Trip name generation** (`src/app/api/trip/create/route.ts`):
```
Before: Always "{first destination} or Bust"
        → "Goa or Bust" even when 3 destinations are up for vote

After:  group_vote  → "Goa, Manali or Coorg"  (lists all options)
        organizer_pick → "Goa or Bust"         (commitment idiom, accurate)
```

**Share screen** (`src/app/page.tsx` — step 4):
```
Before: "{tripName} is live!"
        "Invites sent via WhatsApp. Share the code below."
        (same regardless of mode)

After:  group_vote:
          "{tripName} — squad, it's time to vote!"
          "Once everyone joins, the squad votes on the final destination."
        organizer_pick:
          "{tripName} is live!"
          "Invites sent via WhatsApp. Share the code below to add more people."
```

**WhatsApp share message** (client-side `shareOnWhatsApp`):
```
Before: "Hey! I'm planning *Goa or Bust* on TripSquad 🌊
         Join here → ..."

After (group_vote):
         "*Aditya* is cooking up *Goa, Manali or Coorg* on Toh Chale 🌊
          Don't be the one friend who finds out about this trip from their Instagram stories 😬
          Join to vote on the final destination 🗳️
          Join here → ..."

After (organizer_pick):
         "*Aditya* is planning *Goa or Bust* on Toh Chale 🌊
          Don't be the one friend who finds out about this trip from their Instagram stories 😬
          Join here → ..."
```

**Twilio invite to members** (server-side `route.ts`):
```
Before: "*The Planner* is organising *Goa or Bust* 🌊
         🎭 Roles needed: Navigator, Budgeteer, Foodie..."

After:  "*Aditya* is organising *Goa, Manali or Coorg* 🌊
         Don't be the one friend who finds out about this trip from their Instagram stories 😬
         🎭 Roles needed: Navigator, Budgeteer, Foodie..."
```

### 🏷️ Brand Rename: TripSquad → Toh Chale

All occurrences in source replaced. The `layout.tsx` title was already "Toh Chale" — `page.tsx` had 3 remaining references:
- Home page heading (`<h1>TripSquad</h1>` → `<h1>Toh Chale</h1>`)
- WhatsApp share message (group vote)
- WhatsApp share message (organizer pick)

### 🔧 Session Tooling

**Stop hook** added to `~/.claude/settings.json`:
- Fires when Claude session ends
- Appends timestamped entry to `CLAUDE.md` with changed files + recent commits
- Auto-commits `CLAUDE.md` to git
- Only runs if there are actual code changes (idempotent)

---

## What's Live Right Now on localhost:3000

### Server
- Next.js 16 dev server running at `http://localhost:3000`
- Hot module reload active
- All env vars loaded from `.env.local`

### Live pages

| URL | Status | Notes |
|---|---|---|
| `http://localhost:3000` | ✅ Live | Onboarding wizard, 5 steps |
| `http://localhost:3000/join/[tripId]` | ✅ Fixed | Service-role fetch, retry logic, JSONB destinations |
| `http://localhost:3000/avatar/[tripId]/[memberId]` | ✅ Overhauled | All 6 roles, 2-tap confirm, fun taglines |
| `http://localhost:3000/trip/[tripId]` | ✅ Live | Member dashboard |
| `http://localhost:3000/organizer/[tripId]` | ✅ Live | Organizer panel |
| `http://localhost:3000/hotels/[tripId]` | ✅ Live | Hotel shortlist |
| `http://localhost:3000/itinerary/[tripId]` | ✅ Live | Day-by-day itinerary |
| `http://localhost:3000/preferences/[tripId]/[memberId]` | ✅ Live | Preference form |
| `http://localhost:3000/trip/[tripId]/vibes` | ✅ Live | Group vibes SVG dashboard |

### Live API endpoints

| Endpoint | Status |
|---|---|
| `POST /api/trip/create` | ✅ Live |
| `GET /api/trip/[tripId]/join-info` | ✅ Live (new, service-role) |
| `GET /api/trip/[tripId]/avatar-info` | ✅ Live (new, service-role) |
| `GET /api/trip/lookup` | ✅ Live |
| `POST /api/claude/destinations` | ✅ Live (needs ANTHROPIC_API_KEY) |
| `POST /api/claude/hotels` | ✅ Live (needs ANTHROPIC_API_KEY) |
| `POST /api/claude/itinerary` | ✅ Live (needs ANTHROPIC_API_KEY) |
| `POST /api/claude/tips` | ✅ Live (needs ANTHROPIC_API_KEY) |
| `POST /api/webhook/twilio` | ✅ Live (needs Twilio tunnel) |
| `POST /api/cron/nudge` | ✅ Live (hourly on Vercel) |
| `POST /api/organizer/nudge` | ✅ Live |

### Live Supabase data (as of Apr 2, 2026)

**5 trips created during testing:**

| Trip name | Code | Status | When |
|---|---|---|---|
| Manali, Goa or Jaipur | XB54S2 | inviting | Apr 2 — latest, new naming format ✅ |
| Pondicherry, Manali or Goa | M5E3JM | inviting | Apr 2 |
| Pondicherry, Manali or Kedarkantha | WXC2L3 | inviting | Apr 2 |
| Goa or Bust | ZQ2TGH | inviting | Apr 2 — old naming format |
| Kedarkantha or Bust | (no code) | inviting | Apr 1 — pre-travel-code feature |

**Organizer accounts:** "Aditya Deepak" (phone: +91...) — avatar: planner on all Apr 2 trips

### Uncommitted changes (pending commit)

```
M  src/app/api/trip/create/route.ts       ← FOMO messaging, new trip name logic
M  src/app/avatar/[tripId]/[memberId]/    ← Full overhaul
M  src/app/join/[tripId]/page.tsx         ← RLS fix, retry logic
M  src/app/page.tsx                       ← Toh Chale rename, mode-aware copy
?? src/app/api/trip/[tripId]/             ← New: join-info + avatar-info routes
?? TOH_CHALE_PROGRESS.md                  ← Context doc
?? BUILD_LOG.md                           ← This file
```

---

## Critical Rules (Don't Forget These)

### Supabase / RLS
```
❌ NEVER: supabase.from('trips').select(...) in a client component
           → anon key → RLS blocks → silent null → page hangs

✅ ALWAYS: fetch('/api/trip/[tripId]/some-route')
           → server route uses createServiceClient() → service role → works
```

### destination_options
```
❌ WRONG: destinations.map(d => <span>{d}</span>)
           → d is { name: "Goa", emoji: "🏖" } → renders [object Object]

✅ RIGHT:  destinations.map(d => <span>{d.emoji} {d.name}</span>)
```

### Trip name generation
```
group_vote + ["Goa", "Manali", "Coorg"] → "Goa, Manali or Coorg"
organizer_pick + ["Goa"]                → "Goa or Bust"
```

### WhatsApp rate limit
```
Max 2 messages per user per day — enforced via message_log table
Check before every outbound send via src/lib/whatsapp.ts
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://nnyftwprfjreisxqivkg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # anon key — client-side reads only
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # service role — server-side only, bypasses RLS

# AI
ANTHROPIC_API_KEY=                             # Claude Sonnet 4.6

# WhatsApp
TWILIO_ACCOUNT_SID=                           # empty = mock mode (logs to console)
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Maps (optional)
GOOGLE_MAPS_API_KEY=
```

**Mock mode:** When `TWILIO_ACCOUNT_SID` is empty, all WhatsApp sends log to console as `[WhatsApp MOCK]` — safe for local development.

---

## What's Not Built Yet (Ideas from Planning)

### High priority
**FOMO mechanics — 22-step trigger framework**
WhatsApp message sequence using:
- Social proof ("3 of your friends already picked avatars")
- Loss aversion ("Only 2 roles left — Navigator and Foodie are still up for grabs")
- Scarcity ("Voting closes in 6 hours")
- Identity pressure ("The Budgeteer role hasn't been claimed. The trip needs you.")
- Future self ("Imagine telling this story: you were the one who found that hidden beach")

**Dissent / fallback voting**
When members vote "disagree" on the itinerary, instead of a full re-vote, trigger a targeted vote on the specific days they objected to. The webhook handler has a `dissent` path but full UI isn't built.

**Organizer abandonment escalation**
If organizer (Planner) is inactive for 5+ days:
1. Warn the group via WhatsApp
2. Auto-transfer trip ownership to highest brownie-point member
3. Send them a "you're the new Planner" message

### Medium priority
- Post-trip expense settlement
- Photo album + group memory board
- Real-time collaborative itinerary editing
- Native iOS/Android (currently PWA)
- Drag-and-drop itinerary reordering

---

## How to Continue Building

```bash
# Start local server
cd /Users/adityadeepak/tripsquad
npm run dev
# → http://localhost:3000

# Test a live trip
open http://localhost:3000/join/432f5799-587d-49d0-b175-1a78a89a7b82

# Commit current session's work
git add -A && git commit -m "feat: ..."

# Push to GitHub
git push origin main
```
