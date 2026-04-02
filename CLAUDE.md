@AGENTS.md

# Toh Chale — Project Context & Session Log

## Project
- **Brand:** Toh Chale (renamed from TripSquad — fully replaced everywhere)
- **Repo:** https://github.com/addydeepak27/Travel-Tech-Repo
- **Local:** /Users/adityadeepak/tripsquad/
- **Stack:** Next.js 16 + React 19 + TypeScript, Supabase (PostgreSQL), Claude Sonnet 4.6, Twilio WhatsApp, Vercel

## Critical rules
- Client components MUST NOT query Supabase with the anon key — RLS blocks reads. Always use service-role API routes.
- Data fetching uses `createServiceClient()` from `@/lib/supabase` (server-side only)
- API routes for pages: `/api/trip/[tripId]/join-info`, `/api/trip/[tripId]/avatar-info`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`
- WhatsApp messages rate-limited: max 2/user/day via `message_log` table
- `destination_options` is JSONB storing `{ name, emoji }` objects (migrated from TEXT[])

## Key files
- `src/app/page.tsx` — onboarding wizard (5 steps)
- `src/app/join/[tripId]/page.tsx` — invite landing page
- `src/app/avatar/[tripId]/[memberId]/page.tsx` — role picker
- `src/app/api/trip/create/route.ts` — trip creation + Twilio invites
- `src/app/api/webhook/twilio/route.ts` — inbound WhatsApp handler
- `src/lib/claude.ts` — AI: destinations / hotels / itinerary / tips
- `src/types/index.ts` — all types + AVATAR_META + BUDGET_TIER_META

## Next to build (ideas from planning)
- FOMO mechanics: 22-step WhatsApp trigger framework (social proof, loss aversion, scarcity, identity)
- Dissent/fallback voting: re-vote when members disagree on itinerary days
- Organizer abandonment escalation: auto-transfer after 5 days inactivity

---
<!-- SESSION LOG: auto-appended on session end -->

## Session: 2026-04-02
**Built / Fixed:**
- Fixed invite link (join page used anon Supabase client → RLS blocked → infinite spinner). Created service-role API routes: `/api/trip/[tripId]/join-info` + `/api/trip/[tripId]/avatar-info`. Split relational queries into two separate calls to avoid PostgREST FK ambiguity. Added 3x retry + "Try again" button.
- Fixed destination rendering — `destination_options` is JSONB `{ name, emoji }` objects, not strings.
- Share screen copy is now mode-aware: `group_vote` → *"Goa, Manali or Coorg — squad, it's time to vote!"* / `organizer_pick` → *"Goa or Bust is live!"*
- Trip name generation mode-aware: `group_vote` → "Goa, Manali or Coorg", `organizer_pick` → "Goa or Bust"
- WhatsApp share + Twilio invite messages now include host's name + FOMO joke: *"Don't be the one friend who finds out from their Instagram stories 😬"*
- Avatar page: fixed same RLS bug; always shows all 6 roles; 2-tap confirm UX; fun taglines per role; live availability counter
- Renamed all "TripSquad" → "Toh Chale" everywhere in source

## Session: 2026-04-02 16:46
**Changed:** src/app/api/trip/create/route.ts src/app/avatar/[tripId]/[memberId]/page.tsx src/app/join/[tripId]/page.tsx src/app/page.tsx src/app/api/trip/[tripId]/ 
**Recent commits:** 9b3430d feat: onboarding redesign, engagement mechanics, brownie points, group vibes 120ac65 merge: incorporate plan doc, keep MVP code on conflicts 380b80b feat: complete Toh Chale MVP — full group travel coordination platform 

## Session: 2026-04-02 16:47
**Changed:** src/app/api/trip/create/route.ts src/app/avatar/[tripId]/[memberId]/page.tsx src/app/join/[tripId]/page.tsx src/app/page.tsx src/app/api/trip/[tripId]/ 
**Recent commits:** fd36d68 session log: 2026-04-02 16:46 9b3430d feat: onboarding redesign, engagement mechanics, brownie points, group vibes 120ac65 merge: incorporate plan doc, keep MVP code on conflicts 

## Session: 2026-04-02 16:48
**Changed:** src/app/api/trip/create/route.ts src/app/avatar/[tripId]/[memberId]/page.tsx src/app/join/[tripId]/page.tsx src/app/page.tsx src/app/api/trip/[tripId]/ 
**Recent commits:** 7ac5355 session log: 2026-04-02 16:47 fd36d68 session log: 2026-04-02 16:46 9b3430d feat: onboarding redesign, engagement mechanics, brownie points, group vibes 

## Session: 2026-04-02 16:54
**Changed:** src/app/api/trip/create/route.ts src/app/avatar/[tripId]/[memberId]/page.tsx src/app/join/[tripId]/page.tsx src/app/page.tsx TOH_CHALE_PROGRESS.md src/app/api/trip/[tripId]/ 
**Recent commits:** fe0ed1b session log: 2026-04-02 16:48 7ac5355 session log: 2026-04-02 16:47 fd36d68 session log: 2026-04-02 16:46 

## Session: 2026-04-02 22:58
**Changed:** src/app/page.tsx 
**Recent commits:** d92af21 feat: invite link fix, avatar overhaul, mode-aware copy, Toh Chale rebrand f75bf3c session log: 2026-04-02 16:54 fe0ed1b session log: 2026-04-02 16:48 

## Session: 2026-04-02 22:59
**Changed:** next.config.ts src/app/page.tsx 
**Recent commits:** 54482db session log: 2026-04-02 22:58 d92af21 feat: invite link fix, avatar overhaul, mode-aware copy, Toh Chale rebrand f75bf3c session log: 2026-04-02 16:54 

## Session: 2026-04-02 23:00
**Changed:** next.config.ts src/app/page.tsx 
**Recent commits:** 6869315 session log: 2026-04-02 22:59 54482db session log: 2026-04-02 22:58 d92af21 feat: invite link fix, avatar overhaul, mode-aware copy, Toh Chale rebrand 

## Session: 2026-04-02 23:02
**Changed:** next.config.ts src/app/page.tsx 
**Recent commits:** b084401 session log: 2026-04-02 23:00 6869315 session log: 2026-04-02 22:59 54482db session log: 2026-04-02 22:58 

## Session: 2026-04-02 23:09
**Changed:** next.config.ts src/app/api/cron/nudge/route.ts src/app/api/organizer/nudge/route.ts src/app/api/trip/create/route.ts src/app/page.tsx src/types/index.ts src/lib/email.ts 
**Recent commits:** 1be53a7 session log: 2026-04-02 23:02 b084401 session log: 2026-04-02 23:00 6869315 session log: 2026-04-02 22:59 

## Session: 2026-04-02 23:10
**Changed:** next.config.ts src/app/api/cron/nudge/route.ts src/app/api/organizer/nudge/route.ts src/app/api/trip/create/route.ts src/app/page.tsx src/types/index.ts src/lib/email.ts 
**Recent commits:** 20f0bb2 session log: 2026-04-02 23:09 1be53a7 session log: 2026-04-02 23:02 b084401 session log: 2026-04-02 23:00 
