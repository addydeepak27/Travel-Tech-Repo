# Group Travel Platform — Final MVP Plan
**Deadline: April 4, 2026 · 11:59PM**

---

## Product Positioning

**One-liner:** "From 'let's go somewhere' to a voted, finalized trip plan — without the 200-message WhatsApp thread — by gamifying every decision so everyone participates."

**Not a booking app. A group coordination layer.**

**Core insight:** Group travel is not a booking problem. It is a coordination problem. No existing tool owns the full journey from "let's go somewhere" to a locked itinerary with distributed ownership.

---

## Competitive Analysis — Wanderlog vs TripSquad MVP

### What Wanderlog is
Wanderlog is an all-in-one travel planning app (web + iOS + Android) with real-time collaborative itinerary editing (Google Docs-style), ChatGPT-powered itinerary generation, multi-site hotel price comparison (Airbnb/Expedia/Booking.com), route optimisation on a map, and expense splitting. 1M+ users. Generous free tier.

---

### Where TripSquad is categorically different (not just better — different problem)

| Dimension | Wanderlog | TripSquad MVP |
|---|---|---|
| **Core problem solved** | Trip documentation and itinerary building | Group coordination — getting everyone to a decision |
| **Where it lives** | App download or web login required | WhatsApp-native — no download, no login |
| **Group decision-making** | None. No voting, no consent, no structured input. Groups must use WhatsApp/email alongside it. | The entire product. Voted decisions at every step — destination, hotel, itinerary. |
| **Who builds the plan** | Organiser does everything. Collaboration = others can edit what the organiser created. | Distributed ownership. Every member picks a role and owns a slice. Organiser monitors. |
| **Budget alignment** | Collected after destination chosen (if at all) | Collected anonymously before destination is even discussed. Anchors all downstream recommendations. |
| **Task accountability** | None. No individual task assignment, no deadlines, no completion tracking. | Avatar Mission Packs. Named tasks per person with T-relative deadlines and point consequences. |
| **Passive participant problem** | No mechanism. Non-responders create silent blockers. | FOMO framework — 5 levers, per-step escalation, auto-assign threat, points decay. |
| **Organiser load** | Higher than WhatsApp. Organiser now also manages a planning tool on top of the group. | Lower than WhatsApp. Platform absorbs coordination; organiser monitors a board. |
| **Hotel recommendations** | Broad search across 6 booking sites. Organiser picks and adds to plan. | 3 curated options tied to the group's actual budget zone and avatar mix. Group votes. |
| **AI itinerary** | Generic ChatGPT output. One plan, anyone can edit freely. | Persona-weighted by avatar distribution + individual pace/spend inputs. Vote-to-lock, not edit-freely. |
| **Target market** | Global, English-first, app-savvy travellers | Indian millennials, WhatsApp-first, organising group trips in domestic market |

**The fundamental gap Wanderlog leaves open:** It assumes the group already agrees on the destination, has aligned on budget, and has a willing organiser who will do all the work. TripSquad solves the step before all of that.

---

### Where Wanderlog is stronger — and why it doesn't apply to our PRD

| Wanderlog strength | Why it's out of scope for TripSquad V1 |
|---|---|
| Map-based visualisation of itinerary stops | Adds significant build complexity. Our PRD problem is decision-making, not navigation. V2 candidate. |
| Expense splitting + settlement | Explicitly excluded from V1. Post-trip, not coordination. |
| Multi-site hotel price search (live inventory) | Requires hotel API integrations. V1 uses Claude-curated shortlist. External booking links handle the transaction. |
| Native iOS/Android apps | PWA covers MVP use case. App store is a distribution problem, not a coordination problem. |
| Real-time collaborative itinerary editing | Edit-freely creates conflict. Vote-to-lock is the design choice. Collaborative editing is V2. |
| Gmail booking import | Irrelevant — TripSquad doesn't handle bookings. |

---

### One genuine improvement Wanderlog reveals — aligned with our PRD

**Map context on the hotel shortlist and itinerary page.**

Wanderlog's strongest UX moment is showing accommodation and activities on a map — members immediately see *where* the hotel is relative to what they're doing. Our hotel cards currently show neighbourhood name and distance callouts in text ("30 min from Baga nightlife"). A simple embedded static map snippet per hotel card (showing hotel pin + 2–3 key activity locations from the voted itinerary) would:
- Directly address PRD problem #2 (expectations vs reality on hotel listings — visual location context beats text)
- Require no new integrations — Google Maps Static API or Mapbox Static Images, one API call per hotel card, cached
- Add no new tap or decision step for the member — it's part of the hotel card they're already viewing

**Verdict: Add static map snippet to hotel card (web page only). V1-viable, low build cost, addresses a real PRD gap.**

---

### What NOT to adopt from Wanderlog (misaligned with our problem statement)

- **Collaborative editing** — our design is vote-to-lock, not edit-freely. Introducing free editing reintroduces the 200-message conflict the product is designed to eliminate.
- **Expense tracking** — explicitly out of scope. Adding it would dilute the coordination focus and require payment infrastructure.
- **App download requirement** — WhatsApp-native is a deliberate choice for the Indian millennial market. An app creates a friction wall at exactly the moment we need zero friction (the invite step).
- **Broad hotel search** — more options create more paralysis. 3 curated, budget-anchored options with a vote is a better coordination design than a search engine.

---

## PRD Problems → How MVP Solves Them

| PRD Gap | MVP Solution |
|---|---|
| Decision bottleneck | One decision per step. Consent → avatar → budget → destination → itinerary. Can't skip. |
| Organizer tax | Avatar selection is mandatory immediately after consent — every member who says yes picks a role and owns that role's tasks. Mission Packs are generated per-avatar. Organizer sees the full board and monitors; all pre-trip tasks are distributed, none default to organizer unless an avatar is unclaimed. |
| Budget misalignment | Anonymous budget tier collected before any destination is discussed. Group zone revealed, no names. |
| Passive participation | WhatsApp-native one-tap responses. Auto-assign threat after 24h. Max 2 nudges/day, escalating by lever. |
| No single source of truth | Trip dashboard: one URL, no login, destination + itinerary + tasks + budget in one place. |
| Momentum death zone | FOMO mapped to every silent step. Web carries ambient pressure. WhatsApp carries high-stakes moments only. |

---

## What's In MVP

- Trip creation: destination chips + mandatory organizer avatar, one screen
- WhatsApp 1:1 invite + one-tap consent collection
- Avatar selection: mandatory immediately after consent, blocking (budget step does not unlock until avatar is selected), role cards show tasks before selection so member knows what they're committing to, auto-assign after 24h with 12h change window
- Budget tier collection: 4 options, WhatsApp quick-reply, anonymous; individual inputs feed weighted median + spread signal to Claude
- **Organizer cost optimization tips: 3 India-specific tips surfaced to organizer once all budget inputs are in**
- AI destination suggestion: 3 options from Claude based on avatar mix + budget zone
- Deadline-enforced destination voting: WhatsApp quick-reply buttons
- **Hotel shortlist: 3 AI-curated options anchored to group budget zone, shareable, group-votable**
- **Hotel group voting: WhatsApp quick-reply, majority wins, organizer confirms**
- **Honest hotel notes: each recommendation includes 1 honest caveat (e.g. "30 min from beach")**
- **Itinerary preference signal: 2-tap WhatsApp quick-reply (trip pace + daily spend), budget-anchored, fires after hotel confirmed**
- AI itinerary generation: persona-weighted by group avatar mix + M4d responses + weighted median budget, smart default + 3-option fallback
- **Itinerary dissent path: keyword-triggered fallback to 3-option vote**
- Avatar Mission Packs: auto-assigned tasks with calendar deadlines
- **Task delivery loop: optional free-text reply after marking Done**
- Trip dashboard: shareable URL, no login, real-time
- Organizer nudge panel: one-tap WhatsApp nudge per non-responder
- Points leaderboard + Trip MVP badge (symbolic, no cash)
- Squad card: auto-generated image on destination lock, shared via organizer
- Day-by-day countdown: WhatsApp message per day, T-14 to T-1
- FOMO mechanics: mapped per step, split across WhatsApp and web
- 20 pre-approved WhatsApp templates
- Unanimous fast-track: auto-lock when all members vote early
- **Short planning window fast-track: vote windows compress to 6h if departure < 5 days**
- **Vote tiebreaker: organizer override notification on tied votes**
- **Non-consenting member visibility: organizer sees count + nudge action**
- **Avatar overflow: shared archetypes for groups > 7**
- **Claude API failure fallback: manual template shown, never blank state**
- **Gamification opt-out: organizer can disable points for a trip**

## What's Cut

| Feature | Reason |
|---|---|
| Instagram API | Meta approval takes weeks. Replaced by avatar + budget preference collection. |
| Cash/voucher redemption | Needs payment infra + legal. Symbolic rewards only in MVP. |
| Drag-and-drop itinerary | MVP uses voting on AI-generated options. Customisation is MVP+1. |
| Dark mode | Zero impact on core problem. |
| Historical traveler data | No network on Day 1. AI-generated content instead. |
| Hotel/flight booking transactions | No bookings. Shortlisting and group agreement only. External booking via MakeMyTrip/Booking.com. |
| Expense tracking + settlement | Out of scope. Focus is pre-trip coordination only. |
| On-trip or during-trip activities | Out of scope. Platform solves pre-trip coordination only. All task tracking ends at T-0. |
| Post-trip settlement and photo albums | Out of scope. Post-trip experience is V2. |
| Live GPS/location sharing | Scope creep. |
| WhatsApp group creation | Not supported by official API. Individual 1:1 broadcasts + organizer's existing group. |

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Frontend | Next.js (PWA) | Mobile-first, App Router, Vercel deploy |
| Database + Auth | Supabase | Real-time subscriptions, row-level security, free tier |
| AI | Claude API (claude-sonnet-4-6) | Destination suggestions, itinerary generation |
| WhatsApp | Twilio WhatsApp API | Sandbox for dev, production for launch, built-in compliance |
| Image generation | Sharp (server-side) | Squad cards, crew moodboards |
| Static maps | Google Maps Static API | Hotel location context on hotel cards — 1 cached image per hotel, no interactive map |
| Deployment | Vercel | One-click deploy, edge functions, free tier |
| Webhooks | Next.js API routes | Receive Twilio reply webhooks, update DB |

---

## WhatsApp Compliance — Non-Negotiables

### Why numbers get banned
1. Users tapping "Block" or "Report Spam"
2. Sending free-form messages outside a 24h session window without approved templates
3. Too many messages to the same user in a short window
4. Using unofficial libraries (Baileys, whatsapp-web.js) — immediate ban risk
5. Messaging users who never opted in

### The 7 rules

**Rule 1: Explicit opt-in before first message**
Join flow includes: *"By joining, you agree to receive trip planning updates from TripSquad on WhatsApp. Reply STOP anytime."* Required checkbox. No opt-in = no messages.

**Rule 2: Max 2 WhatsApp messages per user per day**
If multiple FOMO triggers fire on the same day, platform sends the highest-priority one and defers the rest. No exceptions.

**Rule 3: Max 1 FOMO nudge per decision per user**
One nudge per vote window per person. Not one per trigger interval.

**Rule 4: All proactive outbound messages use pre-approved templates**
Any message sent outside an active 24h session must use a Meta-approved template. All 18 templates submitted before launch.

**Rule 5: STOP = instant and permanent removal**
If a user replies STOP, removed from all queues immediately. No re-invite unless they rejoin themselves.

**Rule 6: Official API only**
All WhatsApp communication through Twilio exclusively. No Baileys, no grey-market gateways.

**Rule 7: Web carries the heavy FOMO load**
Ambient mechanics (ghost avatar, hype score, blurred destination, leaderboard) live on the web dashboard. WhatsApp carries only high-stakes moments. This keeps per-user message volume safe.

### Two-channel model

**Channel 1 — Platform → member (1:1 via Twilio)**
All action-required messages: votes, task reminders, nudges, anonymous data collection. Personal, private, individual.

**Channel 2 — Organizer's existing WhatsApp group**
Celebrations only: squad cards, milestone announcements. Platform sends organizer a "Share to your group" prompt at each milestone — organizer taps once, WhatsApp opens with content pre-filled. Platform never creates or joins the group.

### Message volume per user (worst case, compliant)

| Phase | Messages | Type |
|---|---|---|
| Invite | 1 | Template |
| Confirmation + avatar prompt | 1 | Session |
| Budget collection | 1 | Session |
| Destination vote | 1 | Template |
| Max 1 FOMO nudge | 1 | Template |
| Final call | 1 | Template |
| Squad card | 1 | Template (image) |
| Itinerary prompt | 1 | Template |
| Trip locked | 1 | Template |
| Task reminders (1 per task, T-48h) | ~4–6 | Template |
| Day-by-day countdown (T-14 to T-1) | 14 | Template |
| **Total across full lifecycle** | **~28 max** | Utility |

Spread over 3–6 weeks. Well within safe limits for an opted-in utility service.

### Pre-approved template library (submit before launch)

| Template | Content |
|---|---|
| `trip_invite` | "{{organizer_avatar}} is planning {{trip_name}} 🌊 Destinations: {{destinations}} · Roles open: {{roles}} · Join → {{link}}" |
| `avatar_prompt` | "You're in 🙌 Pick your travel personality — roles filling fast → {{link}} (24h before auto-assign)" |
| `budget_prompt` | "One quick thing: your budget for {{trip_name}}? Private until everyone submits." + 4 quick-reply buttons |
| `destination_vote` | "Vote for {{trip_name}} destination. Closes in {{hours}}h:" + 3 quick-reply buttons |
| `fomo_social_proof` | "{{count}}/{{total}} people confirmed for {{trip_name}}. {{remaining}} spots left." |
| `fomo_last_one` | "Everyone's confirmed for {{trip_name}}. One spot still empty." |
| `fomo_blocking` | "The group can't finalise Day 1 until {{task_name}} is done. That's your task." |
| `fomo_price_ticker` | "Hotels in {{destination}} fill up fast for {{dates}}. The group hasn't picked one yet — options are live now." |
| `fomo_tied_vote` | "Your vote decides {{trip_name}}. {{option_a}} and {{option_b}} are tied {{n}}–{{n}}." |
| `fomo_last_call` | "Last call for {{trip_name}}. Group moves in 1h. [I'm In] [I'm Out]" |
| `fomo_anti_vote` | "The destination you probably don't want is currently winning {{trip_name}}. Vote to change it." |
| `fomo_points_decay` | "You had {{original}} pts for this vote. Now {{remaining}}. Respond in {{hours}}h to claim the rest." |
| `destination_locked` | "🎉 {{destination}} confirmed for {{trip_name}}! {{dates}} → {{dashboard_link}}" |
| `itinerary_prompt` | "Your {{trip_name}} plan is ready 👇 {{link}} — [Looks good ✅] [See other options]" |
| `trip_locked` | "{{trip_name}} is locked ✅ Here's everything → {{dashboard_link}}" |
| `task_reminder` | "{{task_name}} due in {{hours}}h. [Done ✅] [Need more time ⏳] [Reassign 🔄]" |
| `daily_countdown` | "In {{days}} days: {{scene_description}}" |
| `no_user_reinvite` | "{{destination}} confirmed for {{dates}}. Dates work now? One spot open → {{link}}" |

**18 templates. All Utility category. Submit all at once via Twilio. 24–48h Meta approval.**

---

## The 7 Avatars + Mission Packs

### Avatar → task ownership

Each avatar directly removes tasks from the organizer's plate. Without avatar selection, all coordination defaults back to the organizer — the core problem the platform solves.

| Avatar | Owns | Tasks removed from organizer | Personality |
|---|---|---|---|
| The Planner | Trip timeline, itinerary finalisation, group coordination | Itinerary lock, member confirmations, trip summary | Organised, detail-oriented |
| The Navigator | All transport — pickups, transfers, meetup logistics | Airport pickup, inter-city transport, Day 1 movement | Logistics-minded, reliable |
| The Budgeteer | Pre-trip cost coordination — contributions, splits, per-person estimates | Kitty reminders, cost breakdown, per-person total | Numbers-focused, fair |
| The Foodie | All meals — restaurant shortlist, reservations, dietary needs | 3 restaurant options/day, reservation confirmation, dietary collection | Taste-driven, explorer |
| The Adventure Seeker | All activities — research, permits, group briefing | Activity research, confirmation, safety notes | Thrill-seeking, outdoorsy |
| The Photographer | Photo spots, golden hour scheduling | Photo spot research, golden hour placement in itinerary | Creative, moment-capturing |
| The Spontaneous One | Hidden gems, backup plans, open slots | Daily backup plans, 2 hidden gem finds | Flexible, spontaneous |

### Mission Pack tasks (relative to departure date T)

All tasks are **pre-trip coordination only**. No in-trip or post-trip tasks in V1. Each task is a coordination reminder — the actual action (booking a cab, confirming a restaurant) happens externally by the member. The platform tracks that it happened, not how.

| Avatar | Task | Deadline | Points |
|---|---|---|---|
| Planner | Finalise itinerary after group vote | T-10 | 15 |
| Planner | Confirm all members have accommodation sorted | T-5 | 10 |
| Planner | Share final trip summary link to group | T-2 | 10 |
| Planner | Collect dietary and medical needs from group | T-7 | 8 |
| Navigator | Coordinate airport/station pickup for all members | T-7 | 15 |
| Navigator | Share departure point + group meetup time | T-2 | 10 |
| Navigator | Confirm inter-city transport arrangements | T-5 | 12 |
| Navigator | Confirm Day 1 local transport plan | T-1 | 10 |
| Budgeteer | Remind all members to contribute to trip kitty | T-14 | 15 |
| Budgeteer | Share accommodation cost breakdown with group | T-7 | 10 |
| Budgeteer | Share estimated per-person trip total with group | T-5 | 8 |
| Foodie | Shortlist 3 restaurant options per day | T-7 | 12 |
| Foodie | Confirm dinner reservations for Day 1 + 2 | T-5 | 15 |
| Foodie | Collect dietary restrictions from group | T-10 | 8 |
| Adventure Seeker | Research and share ticketed activity options | T-10 | 10 |
| Adventure Seeker | Confirm activity plans and share details with group | T-7 | 15 |
| Adventure Seeker | Share permit requirements and safety notes with group | T-2 | 8 |
| Photographer | Research and share best photo spots at destination | T-7 | 10 |
| Photographer | Add golden hour windows to day-by-day itinerary | T-5 | 8 |
| Spontaneous One | Find and share 2 hidden gems at destination | T-5 | 12 |
| Spontaneous One | Prepare and share 1 backup plan per day | T-3 | 10 |

**Points:** Full before deadline · 75% on deadline day · 25% late · 0 + reassign if not done.

**V1 scope boundary:** Tasks end at departure (T-0). No during-trip reminders, no post-trip settlement tasks. Day-by-day countdown (T-14 to T-1) is the only communication that runs up to departure day — it is informational, not task-assigning.

---

## Avatar → Recommendation Logic

This section defines exactly how each member's chosen avatar — combined with their budget input and M4d pace/spend response — shapes the three AI-generated outputs: hotel shortlist, itinerary, and personalised must-visit spots.

Avatars serve two purposes in V1: task ownership (who does what) and recommendation personalisation (what the platform suggests for the group). This section covers the second purpose.

---

### How it works

Claude receives:
1. The full group avatar distribution (e.g. 1 Planner · 1 Navigator · 2 Foodies · 1 Adventure Seeker · 1 Photographer · 1 Spontaneous One)
2. Each member's budget tier
3. The weighted median budget tier for the group
4. Each member's M4d pace vote and daily spend response
5. The confirmed destination

From these inputs, Claude generates recommendations that serve the actual group composition — not a generic tourist suggestion list.

**Resolution rules:**
- The majority avatar type drives the primary recommendation spine
- Every avatar present in the group gets at least one element across the full trip that directly serves their preference — no avatar is completely unrepresented
- Budget (weighted median) is a hard constraint on all three outputs — avatar preferences never override budget
- Single-avatar groups (e.g. all Adventure Seekers) receive a pure, undiluted plan with no compromise activities

---

### Avatar → Hotel selection signal

Claude uses the avatar distribution to filter hotel neighbourhood and property type, within the budget constraint.

| Avatar | Hotel preference signal |
|---|---|
| Planner | Centrally located property with easy access to multiple areas of the destination; reliable check-in process |
| Navigator | Near main transport hub (airport, station, bus stand) or key transit corridor; easy cab and auto access |
| Budgeteer | Best value-for-money within the group's median budget zone; per-person cost clearly visible on card |
| Foodie | Walking distance (≤15 min) from a restaurant cluster, local market, or food street |
| Adventure Seeker | Proximity to activity hubs — beaches, trek entry points, park gates, water sports operators |
| Photographer | Scenic setting or rooftop/terrace access; proximity to known sunrise/sunset vantage points |
| Spontaneous One | Characterful neighbourhood; local charm preferred over chain hotels; boutique and hidden-gem properties included |

**Hotel shortlist composition rule:** All 3 shortlisted hotels must together satisfy the top 3 avatar preferences from the group's distribution. E.g. if the group has 2 Foodies, 1 Adventure Seeker, 1 Photographer — one hotel near food streets, one near beach activities, one with a scenic setting — all within budget tier range.

---

### Avatar → Itinerary activity weighting

Each avatar type drives a specific weight in Claude's itinerary prompt. The dominant avatar(s) shape the day structure; every other avatar present gets at least one named activity or slot across the trip.

| Avatar | Drives in the itinerary | Omitted if avatar is absent |
|---|---|---|
| Planner | Structured flow with clear timings; buffer time between activities; no ambiguous "wander" slots | Itinerary may have loose open-ended slots |
| Navigator | Inter-location travel time noted per transition; transport mode suggested per leg | Transfer logistics not shown |
| Budgeteer | Free and low-cost activities featured prominently; estimated per-activity cost shown inline | No price anchors |
| Foodie | Meal slots are named venues, not placeholders; breakfast, lunch, dinner all populated with specific recommendations | Generic "grab food nearby" placeholders |
| Adventure Seeker | At least 1 high-energy outdoor activity per day; physical or outdoor activities prioritised in morning slots | Only leisure, cultural, or food suggestions |
| Photographer | Golden hour windows explicitly placed in itinerary (sunrise/sunset slot per day); scenic routes preferred over fastest routes | No golden hour callouts; fastest route taken |
| Spontaneous One | 1 open "surprise slot" per day reserved (Spontaneous One fills it via their task); backup plan per day included | Rigid hour-by-hour plan only |

**Itinerary construction rule:** Claude is explicitly prompted to: (a) identify the top 2 avatars by count in the group, (b) use them as the day structure spine, (c) insert at least 1 activity per trip for every other avatar present, (d) ensure no activity in the plan exceeds the weighted median daily spend.

---

### Avatar → Personalised must-visit spots ("For You" callout)

The group itinerary is shared and identical for all members on the trip dashboard. However, each member sees a single "For You" row beneath each day — a 1-line callout generated specifically for their avatar that points out what matters most to them in that day's plan.

This is generated by Claude at itinerary generation time, once per member per day, and cached. No live generation on dashboard load.

**Examples for a Goa trip:**

| Avatar | Day 1 "For You" callout |
|---|---|
| Planner | "Day 1 has a 45-min gap before dinner — good buffer if the cab from the airport runs late." |
| Navigator | "Uber from Vila Goesa to Vagator is ~22 min. Leave by 5:30pm to hit sunset." |
| Budgeteer | "Day 1 total: ~₹820/person. Swap Thalassa for Baba Au Rhum to bring it under ₹600." |
| Foodie | "Fisherman's Wharf on Day 1 fills up by 8pm. Call ahead or arrive before 7:30." |
| Adventure Seeker | "Dudhsagar trek (Day 3) needs permits — ₹750/person. Book before arrival." |
| Photographer | "Vagator cliffs: golden hour at 6:15pm. Arrive by 5:45 for the best light angle." |
| Spontaneous One | "Day 2 surprise slot is yours. The group doesn't know what's coming — keep it that way." |

**What "For You" is not:** It is not a separate itinerary. It does not override the group plan. It surfaces the group plan through the lens of each person's avatar — highlighting the part of the shared plan most relevant to them.

---

**Edge cases:**
- Two same avatars: tasks split evenly between them (Navigator A / Navigator B)
- Critical avatar unclaimed (e.g. no Navigator after auto-assign): organizer alerted immediately — "Nobody owns transport. It stays with you until someone claims it." Organizer can reassign via one-tap from dashboard.
- Returning user: previous avatar pre-selected with one-tap confirm or change — returning to a familiar role reduces friction and maintains itinerary continuity
- All 7 avatars claimed but more members join: overflow members shown 3 remaining high-need roles (Planner, Navigator, Budgeteer); shared avatars assigned with A/B suffix

**What avatar selection unblocks:**
Avatar selection is the gate to all downstream personalisation. Nothing is generated until the platform has enough avatar data to be useful:
- Budget step: unlocked immediately after avatar (avatar needed to frame budget context)
- Destination vote: triggers when majority of members have both avatar + budget submitted
- Itinerary generation: uses full group avatar distribution — if ≥50% of avatars are unset, itinerary is generic and misrepresents the group
- Mission Packs: generated per-avatar; no avatar = no tasks assigned = organizer absorbs everything

---

## Definitive User Journey

### ORGANIZER — 6 taps total. 0 typing. Automated after invite.

---

**O1+O2 — Create trip + share (6 taps, 0 typing)**

Single screen, no forms:
- **Destinations:** 10 trending chips (Goa, Manali, Pondicherry, Jaipur, Coorg, Kedarkantha, Udaipur, Spiti, Kerala, Kasol). Tap 1–3. "Add custom" for anything else.
- **Avatar:** 7 cards inline. Platform shows which roles a trip of this size needs most. Mandatory — cannot proceed without selecting.
- When ≥1 destination + avatar selected: "Share to WhatsApp" button activates.
- Tap "Share to WhatsApp" = trip created + invite sent in one action. WhatsApp opens with pre-filled message. Organizer taps Send.
- Trip auto-named after destination. Dates = TBD until group aligns. Group size = derived from acceptances.

Mission Pack generated for organizer instantly. They see their tasks before anyone is invited.

---

**O3 — Monitor (passive, 0 taps unless nudging)**

Platform pushes WhatsApp updates to organizer at key moments. No dashboard-checking required:
- "3/7 said yes. Roles claimed: Planner, Navigator. 4 roles still open."
- "5/7 confirmed. 3 roles still unclaimed — platform will auto-assign in 18h if no response. [Nudge them]"
- "All avatars locked. Budget zone forming: ₹8k–₹12k. Destination vote sending once budgets are in."
- "All budgets in. Destination vote sending in 2h. [Preview it]"
- "Vote closes in 6h. 2 people haven't voted. [Nudge them]" → 1 tap per nudge

Avatar status is surfaced prominently because unclaimed roles mean the organizer absorbs those tasks by default. The platform flags this before it becomes a problem.

---

**O4 — Votes (fully automatic, 0 taps unless override)**

**Destination vote:** Auto-triggers when majority submit avatar + budget. Organizer gets 2h heads-up with override option. Auto-sends if no change. Closes on majority or 48h. Unanimous = locks immediately.

**Itinerary:** Same flow. AI generates one recommended plan first ([Looks good ✅] / [See other options]). If majority approve = locked immediately, no vote needed. If options requested = 3-option quick-reply vote.

Organizer gets 2h override window for both. Default = automated.

---

**O5 — Trip live (automatic, 0 taps)**

Mission Packs activate with real calendar deadlines. Dashboard goes live. WhatsApp broadcast auto-sent. Organizer's remaining role until departure: check dashboard for overdue pre-trip tasks, tap nudge per person when needed. Platform's job ends at T-0. No in-trip or post-trip orchestration in V1.

---

### MEMBER — 6 required taps. Invite to trip locked. 1 tap per task after.

---

**M1 — Consent (1 tap)**

WhatsApp message (personal, not group):
> "[The Planner] is organising Goa or Bust 2026 🌊
> March 14–17 · 6 people invited
> Roles still needed: Navigator, Foodie, Budgeteer (each role owns part of the planning)
> [I'm In 🙌] [Can't Make It]"

One tap. No app, no login, no loading.

The invite explicitly names which roles are still needed — not just "roles open." This primes the member before they tap: they already have a sense of what they might own, which makes the avatar selection step feel like a natural next action, not an unexpected ask.

**FOMO sequence if silent:**
| Delay | Message | Lever |
|---|---|---|
| +4h | "4/7 people said yes. Trip is happening." | Social proof |
| +24h | Crew moodboard at destination — their slot is empty with "?" | Identity |
| +36h | "Destination vote opens in 12h. Non-responders miss it entirely." | Loss aversion |
| +47h | "Last call. [I'm In] [I'm Out] — group moves in 1h." | Loss aversion |
| Post-deadline | "Group went ahead. Dates changed? One spot still open." | Loss aversion |

---

**M2 — Avatar (2 taps: link + card. Mandatory. Blocks budget + itinerary.)**

Avatar is not a personality label. It is the member's job in the trip. Picking an avatar is what converts "I said yes" into "I own something" — it is the mechanism by which the organizer's planning load is distributed across the group. No avatar = no personalised itinerary input, no Mission Pack, no task ownership. The platform does not advance that member to the budget step until avatar is selected.

Immediately on [I'm In]:
> "You're in 🙌 One thing before we can build the plan — pick your role for [trip name].
> Every role owns a slice of the planning. The organizer can't carry it all.
> Taken so far: The Planner · [Pick your role →]"

**Avatar web page (what the member sees):**
The page shows role cards — not personality archetypes. Each card displays:
- Role name + icon
- 1-line role description ("You own all transport — every leg, every pickup.")
- 2 key tasks the role carries, with deadline tags ("Coordinate airport pickup · T-7" and "Confirm departure meetup · T-2")
- Status: OPEN (tappable) or TAKEN (greyed out, name not shown — only "Taken")

Tap one card → role locked → page auto-closes → WhatsApp reopens. No submit button. 1 tap = done. Member cannot go back and change unless organizer unlocks or the 12h change window is still open after auto-assign.

**Why tasks are visible before selection:** Members should know exactly what they're committing to before they tap. Showing 2 key tasks on the card removes ambiguity — the role is a real responsibility, not a label.

Mission Pack confirmation arrives immediately after selection:
> "You're The Navigator ⚓
> Your job: make sure this group moves smoothly — every pickup, every transfer.
> This takes 4 tasks off [Organizer avatar]'s plate.
> First up: coordinate airport pickup for [N] people by [date]. +15 pts 🎯
> See all your tasks → [dashboard link]"

The "this takes X tasks off [Organizer]'s plate" line is intentional — it frames the avatar as contribution, not burden.

**FOMO sequence if silent (avatar not selected):**
| Delay | Message | Lever |
|---|---|---|
| +6h | "The Foodie and Navigator are taken. 3 roles left — including the ones with the best tasks." | Loss aversion |
| +12h | "2 roles left. The group can't finalise the itinerary until everyone has a role." | Loss aversion |
| +24h | Auto-assign fires: "We've given you The Spontaneous One for [trip name]. You can swap it in the next 12h → [link]" | Loss aversion |
| +36h | Role locked. Budget and itinerary proceed with auto-assigned avatar. No further swap possible. | — |
| Web | Member's slot on dashboard shows "?" — visible to organizer and the rest of the group | Identity |

**Why auto-assign at 24h (not never):** The itinerary cannot be personalised and the Mission Pack cannot be generated without an avatar. Blocking the entire trip on one non-responder is worse than auto-assigning and giving them a change window. The 12h change window after auto-assign preserves choice without stalling the group.

---

**M3 — Budget (1 tap. Stays in WhatsApp.)**

Immediately after avatar:
> "One more thing — your budget per person?
> (Private until everyone submits 🔒)
> [Backpacker <₹5k] [Comfortable ₹5–10k] [Premium ₹10–20k] [Luxury ₹20k+]"

One tap. Never leaves WhatsApp. Platform records anonymously. Group budget zone revealed when 80%+ submit.

**How individual inputs feed downstream:**
Every tier submission is stored per-member (not just the aggregate). Once 80%+ have submitted, the platform computes:
- **Weighted median** — the tier that most people can actually afford (not the average pulled up by one luxury vote)
- **Budget tension signal (organizer-only, private)** — if the spread is extreme (bottom tier and top tier both present, gap ≥ 2 tiers), organizer receives a private WhatsApp note: "Heads up: your group has a wide budget gap. Itinerary is built for the majority. 2 members may find it a stretch — consider a quick check-in." Members never see this. The itinerary itself remains a single cohesive plan built on the weighted median; no dual-option clutter surfaces to the group.
- **Per-member budget estimate** — used internally to price hotel options and itinerary activities accurately. Claude anchors suggestions to the weighted median; alternate plans are only generated if the group median is significantly misaligned with the recommended itinerary cost (>30% over median).

This means hotel options and itinerary suggestions are not generic range estimates — they are anchored to what the majority of real people in this group said they can spend. Budget misalignment insights are private to the organizer only.

**Organizer cost optimization tips (triggered once all budgets are in):**

WhatsApp message to organizer:
> "All budgets are in. Group zone: ₹8k–₹12k/person. 3 ways to stretch it further → [link]"

Tips shown on the linked web page (3 lines each, India-specific):

1. **Book a villa over hotel rooms.** For groups of 6+, a private villa in Goa typically costs ₹3,000–₹5,000/night total — that's ₹500–₹800/person vs ₹1,800+ per hotel room. Same or better amenities; group stays together. Ask The Navigator to check Villa Finder or StayVista.

2. **Travel mid-week, not the weekend.** Friday–Sunday flights and hotels to Goa run 20–35% higher than Tuesday–Thursday on the same properties. If your group has flexibility on dates, a 2-day shift can save ₹1,500–₹2,500/person.

3. **One shared airport cab beats individual Ubers.** A Tempo Traveller from Goa airport fits 12 people at ₹2,500 flat. Splitting 4 Ubers at ₹600 each costs 96% more. The Navigator's Mission Pack already includes this task — flag it early.

These tips are static and Claude-generated at the time of budget zone computation. They surface once and are not re-sent.

**FOMO sequence if silent:**
| Delay | Message | Lever |
|---|---|---|
| +6h | "Budget zone forming: ₹7k–₹14k so far (5/7 submitted). Your input could shift it." | Social proof |
| +18h | "We've assumed ₹10k/person for you. Wrong? Fix it before destination vote opens." | Loss aversion |
| +36h | "Budget locks in 2h with your assumed figure. Destinations filtered by it." | Loss aversion |

---

**M4 — Destination vote (1 tap. WhatsApp quick-reply.)**

> "Vote for your destination — closes in 48h (earlier if everyone votes):
> [Goa 🏖 ~₹8.5k] [Manali 🏔 ~₹11k] [Pondicherry 🌿 ~₹7.2k]"

One tap on inline button. No open-list step. Unanimous = locks immediately.

**FOMO sequence if silent:**
| Delay | Message | Lever |
|---|---|---|
| +6h | "Based on The Navigator, Pondicherry matches 87% of your vibe. Curious which is winning?" (vote to reveal) | Identity |
| +18h | "The destination you probably don't want is currently winning. Vote to change it." | Loss aversion |
| +30h | "3 friends voted for the same place. Which one?" (revealed after voting) | Social proof |
| Tied | "You're the deciding vote. Goa and Manali are tied 3–3." | Loss aversion |
| +42h | "You had 10 pts for this vote. Now 4. Respond in 6h." (points decay) | Loss aversion |
| +47h | "Last call. Group decides in 1h with or without you." | Loss aversion |
| Web | Destination is blurred on dashboard until they vote | Pull |

**On destination lock:**
- Squad card auto-generated (aesthetic 9:16 image, all avatars, destination photo, dates)
- Sent to organizer with "Share to your group? [Open WhatsApp]" — one tap to share to group chat
- Story chapter message sent to all: "Chapter 2 complete: Destination ✅ Goa. Next: Where you're staying."

---

**M4c — Hotel shortlist (2 taps: view + vote)**
*Taps: 1 (link to view) + 1 (vote) = 2 taps*

Triggered immediately after destination locks. Claude generates 3 hotel options using two hard inputs:
1. **Weighted median budget tier** — options span: one below median, one at median, one just above. Per-person total computed from actual group size and trip duration.
2. **Group avatar distribution** — neighbourhood and property type filtered per the Avatar → Hotel selection signal table. All 3 options together must cover the top 3 avatar preferences in the group. A Foodie-heavy group never gets 3 remote beach resorts. An Adventure Seeker group never gets 3 city-centre business hotels.

Budget is the hard constraint. Avatar preference drives the shortlist composition within that constraint.

WhatsApp message to all members:
> "3 hotels shortlisted for Goa within your group's budget (₹8k–₹12k/person total stay).
> See them here → [link]
> Vote for your pick:
> [Vila Goesa 🌟] [Zostel Goa 🏄] [Palolem Beach Resort 🌴]"

**Each hotel card on the web page shows:**
- Name, star rating, neighbourhood
- Price per room per night + estimated total per person for trip duration
- 2 highlights: "Rooftop pool · 5 min walk to beach"
- 1 honest caveat: "30 min from Baga nightlife" / "No AC in standard rooms" / "Shared dorms only below ₹1,500"
- **Static map snippet** — hotel pin + 2–3 key activity locations from the voted itinerary (Google Maps Static API or Mapbox Static Images, one server-side call per hotel, cached). Gives immediate visual context of where the hotel sits relative to what the group is doing. No interactive map — static image only.
- External booking link (MakeMyTrip / Booking.com / hotel website) — no transaction on platform

**Voting:**
- Member views web page (1 tap) then votes via WhatsApp quick-reply button (1 tap)
- Majority wins → hotel confirmed on trip dashboard
- Tied after 24h → organizer tiebreaker notification: "Hotels tied. You pick." (1 tap)
- Organizer override window: 2h after majority reached

**On hotel confirmed:**
- Hotel name + details added to trip dashboard
- Dashboard shows hotel name, neighbourhood, and a single "Book on MakeMyTrip / Booking.com" external link — no transaction on platform
- Navigator's Mission Pack task updates to: "Confirm the group has accommodation sorted for [dates] → [external link]"
- Story chapter: "Chapter 3 complete: Where you're staying ✅ [Hotel Name]. Next: What you're doing."

**FOMO if no hotel vote:**
| Delay | Message | Lever |
|---|---|---|
| +6h | "Hotels in Goa book out fast for weekends. Group hasn't picked one yet." | Loss aversion |
| +18h | "2 people voted for the same hotel. Which one is yours?" (vote to reveal) | Social proof |
| +24h | "Popular option filling up for your dates. Vote now." | Scarcity |

---

**M4d — Itinerary preference signal (2 taps. Stays in WhatsApp. Fires immediately after hotel confirmed.)**
*Purpose: collect the 2 inputs Claude needs to personalise the itinerary beyond avatar — trip pace + daily spend comfort.*

Sent to all members immediately after hotel vote resolves:

**Question 1 — Trip pace:**
> "One quick thing before we build your Goa plan. What's your vibe for the days?
> [Easy & Chill 🌴] [Balanced Mix 🎯] [Packed Schedule 🔥]"

**Question 2 — Daily spend comfort (budget-anchored to their own tier):**
> "How much are you comfortable spending per day on food + activities?
> [Keep it under ₹500] [₹500–₹1,200] [₹1,200–₹2,500]"

*(Ranges shown are auto-calibrated to the group's weighted median budget tier. A Backpacker group sees ₹200/₹200–₹600/₹600–₹1,000. A Premium group sees ₹600/₹1,200–₹2,500/₹2,500+.)*

Both questions sent as separate messages, 5 minutes apart. 1 tap each. No web redirect. No submit. Platform records individual responses. Claude uses the distribution of answers — not just the median — to resolve conflicts: if 5 people say "Balanced" and 2 say "Packed", the itinerary is Balanced with one "Full Send" day flagged as optional.

**If no response by itinerary generation (auto-triggers 2h after Q2):**
Platform uses their avatar as the default signal (Adventure Seeker → Packed; Photographer → Balanced; etc.).

---

**M5 — Itinerary (1 tap. Persona-weighted. Dissent path included.)**
*Taps: 1 default. 2 if dissent path triggered.*

AI generates TWO outputs simultaneously:
1. **The group itinerary** — one shared day-by-day plan for all members
2. **"For You" callouts** — one personalised 1-line highlight per member per day, based on their individual avatar (see Avatar → Recommendation Logic section)

Claude inputs for the group itinerary:
- Destination + confirmed hotel location (activities clustered to minimise travel)
- **Group avatar distribution** — weights applied per the Avatar → Itinerary activity weighting table; top 2 avatars shape the day structure; every other avatar present gets at least 1 named activity across the trip
- **Individual pace votes** from M4d (distribution across Easy/Balanced/Packed drives how many activities per day)
- **Individual daily spend responses** from M4d (sets the ceiling for per-activity cost)
- **Weighted median budget tier** — hard constraint; no activity in the default plan exceeds median daily spend; one cohesive plan, no dual options shown to members
- **Budget misalignment check (organizer-only)** — if estimated itinerary cost exceeds group median by >30%, organizer gets a private dashboard alert: "Itinerary runs ₹1,400/person over group median. Want a revised plan?" One tap to regenerate. Members see nothing until organizer confirms.
- Trip duration

Claude inputs for "For You" callouts:
- Member's individual avatar
- Member's own budget tier and M4d daily spend response
- The locked group itinerary (callouts reference actual activities, timings, venues in the plan)

Sent to members:
> "Here's your Goa plan 👇 [link]
> [Looks good ✅] [Something's off 🤔]"

**Path A — Majority taps [Looks good]:** Locked immediately. No 48h wait.

**Path B — Anyone taps [Something's off]:**
> "What's the issue?
> [Too expensive 💸] [Wrong vibe 🎭] [Bad timing ⏰]"

Platform routes:
- Too expensive → Claude regenerates with budget-constrained activities only
- Wrong vibe → 3-option quick-reply vote opens: [Chill & Eat] [Mix it up] [Full Send]
- Bad timing → Organizer prompted to adjust specific day in dashboard

Either path resolves in 1–2 taps. No silent rejection.

**FOMO if no response:**
| Delay | Message | Lever |
|---|---|---|
| +6h | "The winning plan has a 6am trek on Day 1. You might want to weigh in." | Loss aversion |
| +12h | Avatar-specific: "The Navigator hasn't responded — winning plan has no transport on Day 2." | Identity |
| +24h | AI-generated postcard of winning itinerary: "This is your trip if you don't respond." | Future self |
| Web | Itinerary details blurred until they respond | Pull |

**On itinerary lock:**
- All Mission Packs activate with real calendar deadlines
- Trip dashboard goes live with: destination + hotel + day-by-day plan + tasks
- WhatsApp broadcast: "Goa or Bust 2026 is locked ✅ Here's everything → [link]"
- Story chapter: "Chapter 4 complete: Itinerary ✅. Next: The trip itself."

---

**M6 — Trip dashboard (1 optional tap. Reference, not action.)**

No login. Member sees:
- Destination confirmed
- Hotel confirmed (name, neighbourhood, external booking link — members book directly via MakeMyTrip/Booking.com)
- Day-by-day plan (recommendations only — restaurants, activities, spots; no in-app booking)
- **"For You" callout per day** — a single avatar-personalised highlight beneath each day (e.g. Photographer sees golden hour timing; Budgeteer sees cheapest swap; Navigator sees cab time). Same itinerary, different lens per person.
- Their assigned pre-trip tasks with deadlines
- Group budget zone + estimated per-person total
- Points leaderboard
- Other avatars' task completion status (no names)

**Pull mechanics (no WhatsApp push):**
- Locked content unlocks progressively as planning advances
- Mystery: "The Spontaneous One just added something to Day 2. Tap to see."
- Leaderboard updates in real time
- Group hype score: "83% 🔥"
- Ghost avatar: inactive members shown as Zzz — visible to all

---

**M7 — Tasks (1 tap per task)**

At T-48h and T-24h before each deadline:
> "Coordinate airport pickup for 7 people — due in 2 days.
> [Done ✅] [Need more time ⏳] [Reassign 🔄]"

After tapping [Done ✅], optional follow-up:
> "Add a note for the group? (e.g. pickup confirmed for 9am, meetup point — optional)"
Member can type a reply or ignore. Captures confirmation details the group can see on the dashboard. No form, no structured data collection — free text only.

**FOMO if task overdue:**
| Delay | Message | Lever |
|---|---|---|
| T-24h | "Your task is the only thing blocking Day 1 finalization." | Identity |
| T+0 overdue | "Reassigning in 24h. Your points transfer to whoever picks this up." | Loss aversion |
| T+24h | Task reassigned. Points lost. Organizer notified. | Social proof |

---

**M8 — Day-by-day countdown (0 taps. Pure delight.)**

One WhatsApp message per day, T-14 to T-1. Personalised to the confirmed itinerary and hotel. No task assignments sent during countdown — this is pure anticipation, not coordination.

> "In 8 days: You're staying at Vila Goesa in Goa. Rooftop pool, 5 min from the beach 🌴"
> "In 3 days: Day 1 plan — Thalassa for dinner, sunset at Vagator. The Foodie sorted the reservation."
> "In 1 day: You're going to Goa tomorrow. Everything is planned. Just pack."

If a pre-trip task is still incomplete when T-3 arrives, the countdown for that day includes one gentle flag to the organizer only (not broadcast to the group):
> [Organizer-only] "3 days out: Airport pickup is unconfirmed. Tap to nudge The Navigator."

Last countdown message (T-1) is celebratory only — no task reminders. Platform's job ends here.

---

### Journey summary

| Step | Who | Taps | FOMO if silent |
|---|---|---|---|
| Create + share | Organizer | 6 | — |
| Monitor + nudge | Organizer | 0 default, 1/nudge | — |
| Consent | Member | 1 | 5-message escalation over 47h |
| Avatar | Member | 2 | Scarcity → auto-assign threat |
| Budget | Member | 1 | Assumed default → blocking |
| Destination vote | Member | 1 | 6-message escalation + web blur |
| Hotel shortlist | Member | 2 (view + vote) | Scarcity → social proof → tiebreaker |
| Itinerary preferences | Member | 2 (pace + daily spend) | Avatar used as fallback if no response |
| Itinerary | Member | 1 (or 2 if dissent) | 3-message escalation + web blur |
| Dashboard | Member | 1 optional | Pull mechanics only |
| Tasks | Member | 1 per task | Blocking → reassignment |
| Countdown | Member | 0 | Delight, no FOMO needed |
| **Total** | **Member** | **10 required** | |

---

## FOMO Delivery: Web vs. WhatsApp

| Mechanic | Where | Why |
|---|---|---|
| Blurred destination until vote | Web | No message needed — rewards checking in |
| Ghost avatar (Zzz overlay) | Web | Ambient pressure, organizer-visible |
| Group hype score | Web | Passive, always visible |
| Leaderboard drop alert | Web | Pull — members check when position changes |
| Mystery content unlock | Web | Curiosity gap drives return visits |
| Photo reveal progression | Web | Progressive unlock as planning advances |
| Points decay live counter | Web | Real-time — no polling needed |
| Activity feed (others' actions) | WhatsApp | High-value push, max 1/day |
| Tied vote drama | WhatsApp | Pre-approved template |
| Last one standing | WhatsApp | Pre-approved template |
| Role blocking message | WhatsApp | Pre-approved template |
| Price ticker | WhatsApp | Pre-approved template |
| Points decay notification | WhatsApp | Pre-approved template |
| Final call | WhatsApp | Pre-approved template |
| Squad card | WhatsApp (via organizer) | Organizer shares to group |
| Story chapter updates | WhatsApp | Pre-approved template |
| Day-by-day countdown | WhatsApp | Pre-approved template |

**Rule: Reaction needed → WhatsApp. Rewards checking in → Web.**

---

## PRD Coverage Scorecard

### Does the MVP solve what the PRD prioritised?

| # | PRD Friction Area | Users | Priority | MVP Status | Verdict |
|---|---|---|---|---|---|
| 1 | Scattered hotel search — no shortlisting or sharing | Kanchan, Aditya, Shreya | HIGH | ADDRESSED ✅ | Hotel shortlist (3 AI-curated options) generated after destination locks, within group budget zone, shareable, group-votable. |
| 2 | Expectations vs. reality on hotel listings | Shreya | HIGH | ADDRESSED ✅ | Each hotel card shows honest caveat (e.g. "No AC in standard rooms", "30 min from beach"). Manages expectations before any booking. |
| 3 | Impromptu hotel search returning no results | Shreya | PARTIALLY | Platform curates 3 options proactively — no search needed. Availability is not verified in real time; external booking link (MakeMyTrip/Booking.com) confirms availability. V1 scope boundary: recommendation only, no booking. |
| 4 | Shared payment / expense tracking | Shreya | MEDIUM | OUT OF SCOPE | Intentionally excluded. Platform is pre-trip coordination only. Post-trip settlement is V2. |
| 5 | Car booking logistics and cancellations | Shreya | MEDIUM | PARTIALLY | Navigator Mission Pack owns all transport coordination tasks pre-departure. Platform reminds and tracks task completion; actual booking is external. Cancellations and during-trip transport changes are out of V1 scope. |
| 6 | Confirming destination and dates across group | All | HIGH | FULLY ADDRESSED ✅ | Destination voting + budget zone + unanimous fast-track. |
| 7 | Finalising within budget with group alignment | Kanchan, survey | HIGH | FULLY ADDRESSED ✅ | Budget zone computed anonymously. Hotel shortlist anchored to zone. Per-person cost shown on every option. |
| 8 | Curated food and sightseeing recommendations | Kanchan, Shreya | MEDIUM | ADDRESSED ✅ | Persona-weighted AI itinerary: Foodie-heavy group gets restaurant-dense plan; Adventure-heavy gets outdoor focus. |
| 9 | Keeping all group members engaged and responsive | Survey | HIGH | FULLY ADDRESSED ✅ | WhatsApp-native 1-tap responses, 22 FOMO mechanics mapped per step, story chapters, countdown. |

**Updated Score: 6 Fully Addressed · 2 Partially Addressed · 1 Out of Scope (intentional)**

All HIGH-priority PRD items are now addressed. Items 3 and 5 remain partially addressed — real-time availability checking and actual booking are intentionally excluded. The platform solves coordination and agreement; external booking platforms (MakeMyTrip, Booking.com) handle the transaction.

---

## Critical Gaps (what the MVP implies but does not deliver)

**Gap 1: Budget zone without a budget outcome**
The MVP surfaces a group budget zone (e.g. ₹8k–₹12k/person). But the organizer exits this step with a number and no next action. There is no mechanism showing what that budget zone gets the group in the chosen destination — no hotel anchor, no per-head cost estimate. Budget visibility ≠ budget resolution.
**Fix:** After budget zone computes, show 3 hotel-tier examples for the destination within the zone. Even Claude-generated estimates with disclaimers. Connects budget alignment to a real outcome.

**Gap 2: Itinerary is a 1-tap accept with no dissent mechanism**
A member who hates the AI-generated itinerary has no recourse inside the platform. The only option is to complain on WhatsApp — the exact problem this product claims to solve. There is no flag, no objection, no alternative vote trigger built in.
**Fix:** Add a keyword-triggered dissent path. If a member replies "I have a problem" or taps [Raise issue], it triggers the 3-option vote rather than locking the default.

**Gap 3: Mission Pack tasks have no delivery loop**
The Avatar Mission Pack assigns "Coordinate airport pickup" to The Navigator. But there is no way to confirm that the coordination actually happened. The task completion loop ends at a checkbox. The platform gamifies assignment but not delivery.
**Fix:** Task completion quick-reply sends an optional follow-up: "Add a note for the group? (e.g. pickup confirmed for 9am, WhatsApp your driver — optional)" — one free-text reply. Captures confirmation evidence without requiring it. Not booking-facilitation — just a notes field the group can see on the dashboard.

**Gap 4: Splitwise delegation with no visible handoff**
The MVP cuts expense tracking and says Splitwise handles it. But the platform never mentions Splitwise, never surfaces a link, never prompts users. From the member's perspective, expenses are simply unaddressed. This is worse than doing nothing — the expectation is set, then silently unmet.
**Fix:** Single "Track group expenses" button in the trip dashboard → opens Splitwise or prompts the Budgeteer to create a group there. One link, one tap. No in-product expense logic needed.

**Gap 5: Avatar web redirect is not "2 taps" for all users**
The journey states avatar selection takes 2 taps on web. For users on 2G, older Android devices, or phones where WhatsApp links do not open browsers cleanly, this step is a friction wall. The WhatsApp-native promise breaks at exactly the most important personalisation step.
**Fix:** Build avatar selection as a WhatsApp Flow (natively rendered inside WhatsApp). Flag this as a post-MVP improvement if not buildable in 3 days, but acknowledge it in the PRD.

---

## Edge Cases — User Journey

### Organizer

| Scenario | Risk | Resolution |
|---|---|---|
| Organizer creates trip but never shares invite | Trip exists in zombie state | Auto-delete draft trips after 48h with a reminder: "You created a trip. Share it or it expires." |
| Organizer abandons after invite sent | Trip stalls, members have no visibility | Auto-notify members: "The trip hasn't progressed in 5 days. Ask [Organizer avatar] what's happening." |
| Organizer wants to change destinations after invites sent | Members received wrong info, no edit flow | Allow destination edit within 2h of creation. After that, organiser must cancel and recreate. |
| Destination vote results in a tie | No winner, trip stalls | Organiser gets override notification: "Tied vote. You decide." One-tap pick from tied options. |
| 0 members respond to invite | Trip collapses silently | Organiser nudge at 48h: "Nobody has responded yet. Resend or cancel the trip." |
| No critical avatar claimed (e.g. no Navigator) | Tasks default to organizer — defeats the core purpose | Platform alerts organizer at 24h if Navigator is unclaimed: "Nobody owns transport yet. Auto-assigning in 24h to the most responsive member who hasn't picked a role." Organizer can manually nudge or reassign. Tasks never silently orphan. |
| Organiser wants to cancel a live trip | No cancel flow described | Cancel option in dashboard. Members notified. All data archived for 30 days. |

### Member journey

| Scenario | Risk | Resolution |
|---|---|---|
| Member doesn't have WhatsApp | Invite never arrives | Organiser prompted: "2 numbers didn't receive the invite. Share the trip link directly." |
| Member consents but drops out before avatar | Half-in state, avatar unclaimed | Treat as non-responder after 48h. Auto-assign avatar. If they rejoin later, avatar is changeable. |
| Member opens avatar URL but does not select | Selection lost, member unassigned | URL is stateful — if they return within 24h, page resumes at avatar step. |
| Two members pick same avatar simultaneously | Conflict, unclear who owns it | First tap wins. Second member sees that avatar greyed out instantly and picks again. |
| Group larger than 7 (more members than avatars) | Avatar overflow | Allow shared avatars above 7. Two Navigators split transport tasks. Platform shows "Navigator A" and "Navigator B". |
| Group of 2-3 people | Avatar system feels absurd at this scale | Show only 3 avatar cards for small groups (Planner, Navigator, Budgeteer). Others hidden. |
| Budget outlier in a small group | Anonymity is effectively broken at 4 people | Show budget zone only when 5+ people have submitted. Below that, show "more responses needed" to protect anonymity. |
| Member consents late — after voting has closed | Missed all decisions | Late joiners see trip as read-only until next open decision. Cannot retroactively vote but see results. |
| Departure date changes after Mission Packs activate | All task deadlines are wrong | Date change by organiser triggers full deadline recalculation with member notification. |
| Member drops out before departure | Orphaned pre-trip tasks | Organiser can mark member as "dropped out". Their pending pre-trip tasks reassigned via nudge to remaining members. Platform has no visibility into during/post-trip. |
| Trip gets cancelled | No archive or recovery flow | Cancel + archive option. 30-day read-only access to dashboard. No settlement summary — expense tracking is out of V1 scope. |

### Vote and decision edge cases

| Scenario | Risk | Resolution |
|---|---|---|
| All 3 destinations outside group budget | Vote is meaningless | Budget zone computed before AI generates destinations. Claude prompted to stay within zone. |
| Itinerary AI generates poor quality output | Group rejects default | If majority taps [See other options], 3-option vote opens. If all 3 are rejected, organiser can free-text a custom option. |
| Claude API fails during itinerary generation | Trip stalls at key moment | Retry once automatically. If failed: show organiser a manual itinerary template to fill in. Never show blank state. |
| Vote deadline passes with no majority | No winner, trip stalls | Plurality wins (most votes even if under 50%). Organiser notified and can override within 2h. |

---

## Edge Cases — Technical

| Scenario | Risk | Resolution |
|---|---|---|
| Twilio outage during voting window | Messages not sent/received, trip stalls | Show trip status on web dashboard as fallback. Members can vote via web if WhatsApp fails. |
| WhatsApp template rejected by Meta | Entire message step cannot execute | Submit all 18 templates 48h before launch. Have plain-link fallback for any rejected template. |
| 24h session window expires for passive member | Can only use templates, no dynamic nudge | All nudges are pre-approved templates. Session window expiry is already handled. |
| Member blocks Twilio number | Future messages silently fail | Check delivery receipts. If 2 consecutive failures, flag member as unreachable on organiser dashboard. |
| Claude API latency (5–15s) for generation | Mobile user navigates away, loses output | Show loading state with progress indicator. Generation runs server-side; result is saved to DB regardless of whether user waits. |
| Prompt injection via trip name or custom destination | Security risk in Claude prompts | Sanitise all user inputs before inserting into Claude prompts. Strip special characters and limit field lengths. |
| Real-time dashboard not actually real-time | "Single source of truth" claim degraded | Supabase real-time subscriptions handle this. Fallback: auto-refresh every 30s if subscription drops. |

---

## Edge Cases — Adoption

| Scenario | Risk | Mitigation |
|---|---|---|
| "Why can't we just use WhatsApp?" | Most common objection, invisible differentiation | Value prop must be stated explicitly in the invite message: "No more buried polls, no more forgotten plans — one link, everyone's in." |
| Non-tech-savvy member (older user, Tier II device) | Avatar web step fails, user drops off | Show avatar image carousel in WhatsApp message before redirect. If web fails, WhatsApp list message fallback. |
| Member refuses to consent | Binary exclusion creates social friction | Add a "Just want to see the plan" option → read-only view. No tasks, no voting, but they can see the trip. |
| Organiser abandons after invite | Zombie trip, member confusion | Auto-escalation after 5 days: "Trip hasn't progressed. Do you want to take over?" — sent to most engaged member. |
| Group finds gamification childish | Points/badges feel patronising for adults | Gamification opt-out per trip. Organiser can create a "no points" mode. Avatar archetypes remain; points hidden. |
| Multiple trips simultaneously for same user | Notification overload, confusion between trips | Dashboard shows all trips. Each WhatsApp message prefixed with trip name. Rate limit across ALL trips combined. |
| First-trip activation (no discovery layer) | Product has no organic entry point | Out of scope for MVP. Accept that entry point is organiser recommendation. |
| Short planning window (trip in 3 days) | 48h vote cycles don't fit | Fast-track mode: if departure < 5 days, all vote windows compress to 6h. Unanimous still locks immediately. |

---

## What Must Be Fixed Before Ship

### Must fix (blocks core value proposition)
1. **Tiebreaker for destination votes** — organiser override notification when vote ties. One-tap pick.
2. **Non-consenting member visibility** — organiser sees count of non-consenters and has a nudge action for them specifically.
3. **Avatar overflow** — define behaviour when group exceeds 7 members. Shared avatars with A/B suffixes.
4. **Splitwise visible handoff** — one "Track group expenses" button in dashboard. No in-product logic needed.
5. **Itinerary dissent path** — keyword-triggered fallback to 3-option vote if majority rejects the default.
6. **Claude API failure state** — never show blank itinerary. Manual template fallback on API failure.
7. **Short planning window fast-track** — compress vote windows to 6h if departure < 5 days.

### Should address for PRD credibility
8. **Hotel shortlist output tied to budget zone** — 3 hotel-tier recommendations (Claude-generated) after budget zone is computed. Addresses PRD problems 1 and 7 at low build cost.
9. **Task delivery loop** — optional free-text reply after [Done ✅] to capture task completion details or a group-facing note.
10. **Persona-weighted itinerary** — weight Claude itinerary prompt by group's avatar mix. Foodie-heavy group gets more restaurant stops. Adventure-heavy gets more outdoor activities.

### Post-MVP
- Hotel search and booking integration
- Real-time collaborative itinerary editing
- Co-organiser role
- In-product expense tracking
- Date conflict resolution across member availability
- WhatsApp Flows for avatar selection (removes web redirect)
- GDPR/privacy policy and data deletion flow

---

## Sprint Plan (4 days)

### Day 1 — Foundation
- [ ] Next.js + Supabase project setup
- [ ] Twilio WhatsApp sandbox connected + webhook handler
- [ ] Trip creation screen: destination chips (10 trending) + avatar picker + "Share to WhatsApp" single action
- [ ] Invite link generation with pre-filled WhatsApp message
- [ ] Consent collection: quick-reply [I'm In] / [Can't Make It] → webhook → DB
- [ ] Non-consenting member count visible to organizer + nudge action
- [ ] Avatar web page: role cards showing name + 1-line description + 2 key tasks with deadline tags; taken roles greyed; 1 tap locks role, page auto-closes, no submit button
- [ ] Avatar is a hard gate: budget step does not render until avatar is selected; WhatsApp message for budget only fires after avatar webhook received
- [ ] Mission Pack confirmation message: includes "this takes [N] tasks off [organizer avatar]'s plate" with task count computed dynamically
- [ ] Avatar overflow logic: groups >7 get shared archetypes (Navigator A / Navigator B)
- [ ] Auto-assign avatar after 24h + notification with 12h change window
- [ ] Organizer status push includes avatar claim count ("3/7 roles claimed")

### Day 2 — Core flow
- [ ] Budget quick-reply: 4 tier cards, anonymous, per-member tier stored in DB
- [ ] Budget anonymity guard: zone revealed only when 80%+ submitted; small groups (<5) show "more needed"
- [ ] Weighted median budget computation + budget tension signal (spread detection across 3+ tiers)
- [ ] Organizer cost optimization tips: Claude-generated 3-liner tips → triggered after all budgets in, sent via WhatsApp + web link
- [ ] Claude API: destination suggestion — 3 cards from weighted median budget + avatar mix
- [ ] Destination vote: quick-reply buttons → webhook → live tally
- [ ] Unanimous fast-track + short planning window fast-track (6h window if departure <5 days)
- [ ] Vote tiebreaker: organizer override notification on tied votes
- [ ] Claude API: hotel shortlist — 3 options tiered around weighted median (below / at / just above)
- [ ] Hotel cards: highlights + honest caveat + per-person cost + static map snippet (hotel pin + 2–3 itinerary activity locations, Google Maps Static API, cached) + external booking link
- [ ] Hotel vote: quick-reply buttons → majority wins → confirmed to dashboard
- [ ] Hotel tiebreaker: organizer one-tap pick

### Day 3 — Itinerary + tasks + dashboard
- [ ] Itinerary preference signal (M4d): 2 WhatsApp quick-reply questions (pace + daily spend), budget-anchored ranges auto-calibrated to group's median tier
- [ ] Individual preference response storage + distribution computation (avatars used as fallback if no response)
- [ ] Claude API: avatar-weighted hotel shortlist — 3 options covering top 3 avatar preferences, all within budget tiers
- [ ] Claude API: avatar-weighted itinerary — avatar distribution + M4d responses + weighted median budget + hotel location; top 2 avatars drive day structure; every present avatar gets ≥1 named activity
- [ ] Claude API: "For You" callouts — per-member, per-day, avatar-personalised 1-line highlights; generated once at itinerary lock, cached in DB
- [ ] Dashboard: "For You" row renders per-member (different for each avatar; same underlying itinerary)
- [ ] Budget misalignment check: if itinerary cost >30% over weighted median, organizer gets private dashboard alert + one-tap regenerate (members never see this)
- [ ] Itinerary smart default: [Looks good ✅] / [Something's off 🤔]
- [ ] Itinerary dissent path: [Too expensive] / [Wrong vibe] / [Bad timing] → routes to fix
- [ ] Claude API failure fallback: manual itinerary template, never blank state
- [ ] Avatar Mission Pack generation with real calendar deadlines
- [ ] Task delivery loop: optional free-text reply after [Done ✅]
- [ ] Points system: task completion → points → leaderboard
- [ ] Trip dashboard: destination + hotel + itinerary + tasks + budget zone + leaderboard
- [ ] Organizer view: full task board, nudge button, non-responder count
- [ ] Squad card image generation (Sharp) + forwarded to organizer
- [ ] Gamification opt-out toggle for organizer

### Day 4 — FOMO + compliance + deploy
- [ ] All 20 templates submitted to Meta via Twilio
- [ ] Rate limiter: max 2 messages/user/day across all triggers
- [ ] STOP handling: instant removal from all message queues
- [ ] FOMO automation: points decay, tied vote drama, last one standing, blocking message, final call
- [ ] Hotel FOMO: scarcity nudge at +6h, +18h, +24h
- [ ] Day-by-day countdown scheduler (T-14 to T-1, personalised to hotel + itinerary)
- [ ] Story chapter messages: destination / hotel / itinerary / trip itself
- [ ] Organizer abandonment detection: 5-day inactivity → auto-notification to most engaged member
- [ ] Trip cancel/archive flow
- [ ] Deploy to Vercel
- [ ] End-to-end test with 3+ simultaneous users
- [ ] Mobile UX review (iOS Safari + Android Chrome)
- [ ] Submit

---

## Verification Checklist

**Core flow**
- [ ] Live URL accessible (not localhost)
- [ ] 3+ people can use simultaneously in real time
- [ ] Full flow works: invite → consent → avatar → budget → destination → hotel shortlist → itinerary preferences → itinerary → dashboard → tasks
- [ ] Organizer cannot publish trip without avatar selected
- [ ] Budget step does not unlock for a member until avatar is selected (avatar is a hard gate)
- [ ] Avatar web page shows role name + 1-line description + 2 key tasks with deadline tags before selection
- [ ] Taken roles are greyed out; available roles are tappable; 1 tap locks the role, page auto-closes
- [ ] Members auto-assigned avatar after 24h; 12h change window before lock
- [ ] Mission Pack confirmation message includes "this takes X tasks off [organizer]'s plate" framing
- [ ] Organizer status updates include avatar claim progress ("3/7 roles claimed, 4 still open")
- [ ] Unclaimed critical avatar (Navigator) triggers organizer alert at 24h, not silently at trip lock
- [ ] Unanimous vote triggers immediate lock — no waiting for 48h
- [ ] Short planning window: vote windows compress to 6h when departure <5 days
- [ ] Vote tie triggers organizer override notification, not platform stall
- [ ] [Looks good ✅] on itinerary locks immediately without full vote cycle
- [ ] [Something's off 🤔] routes correctly to dissent path
- [ ] Squad card generates and forwards to organizer on destination lock
- [ ] Task deadlines calculate correctly from departure date
- [ ] Task delivery loop: optional free-text reply captured after [Done ✅]
- [ ] Points update in real time on dashboard

**Budget accuracy**
- [ ] Individual budget tier stored per-member (not just aggregate)
- [ ] Weighted median computed correctly; extreme budget gap (bottom + top tier both present) triggers private organizer-only WhatsApp note
- [ ] Budget misalignment (itinerary cost >30% over median) surfaces only to organizer dashboard — not to members
- [ ] Organizer cost optimization tips fire after 100% budget submission, not before
- [ ] Tips link opens web page (not another WhatsApp message)
- [ ] Itinerary preference signal (M4d): 2 questions sent as separate messages, 5 min apart
- [ ] M4d daily spend ranges auto-calibrated to group's weighted median (Backpacker group sees lower ranges, Premium group sees higher)
- [ ] Avatar used as fallback if member doesn't respond to M4d within 2h of itinerary generation

**Avatar-aligned recommendations**
- [ ] Hotel shortlist: 3 options collectively cover the top 3 avatar preferences in the group (e.g. Foodie-heavy group gets at least 1 hotel near food district)
- [ ] Itinerary: top 2 avatars by count drive the day structure
- [ ] Itinerary: every avatar present in the group has at least 1 named activity across the trip
- [ ] Itinerary: no activity in the default plan exceeds the weighted median daily spend
- [ ] "For You" callouts generated per-member at itinerary lock; each callout references actual activity in the plan, not generic advice
- [ ] "For You" renders differently for each member on the dashboard (same itinerary, different lens)
- [ ] If all members share the same avatar (single-type group), plan is fully concentrated in that avatar's preference with no dilution

**Hotel shortlist**
- [ ] Hotel shortlist generated immediately after destination locks
- [ ] 3 hotels tiered: one below median / one at median / one just above median
- [ ] Each hotel card shows: highlights + honest caveat + per-person cost (computed from group size + trip duration) + external booking link
- [ ] Hotel vote resolves to dashboard confirmation
- [ ] Navigator Mission Pack task auto-updates with confirmed hotel name + external booking link (MakeMyTrip/Booking.com) — no platform transaction
- [ ] Hotel tiebreaker: organizer one-tap pick triggered on 24h tie

**Edge cases**
- [ ] Groups >7: shared avatar archetypes (Navigator A / Navigator B) assigned correctly
- [ ] Groups of 2-3: only 3 avatar cards shown
- [ ] Budget anonymity guard: zone shown only when 80%+ submitted
- [ ] Non-consenting members: organizer sees count + nudge action
- [ ] Claude API failure: manual template fallback shown, never blank state
- [ ] Organizer abandonment: 5-day inactivity triggers escalation to most engaged member
- [ ] Trip cancel: archive flow works, members notified

**WhatsApp compliance**
- [ ] All 20 templates approved by Meta before first message sent
- [ ] Rate limiter: max 2 messages/user/day enforced across all triggers
- [ ] STOP reply instantly removes user from all queues
- [ ] No messages sent to "No" users except single re-invite on destination lock
- [ ] All proactive messages use approved templates, not free-form
- [ ] Opt-in consent present and required in join flow

**Mobile**
- [ ] Full flow usable on iOS Safari without zoom or horizontal scroll
- [ ] Full flow usable on Android Chrome
- [ ] Avatar page loads under 2 seconds on mobile data
- [ ] Hotel shortlist web page loads under 2 seconds
- [ ] All WhatsApp quick-reply buttons visible without scrolling

