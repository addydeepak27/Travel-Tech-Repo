import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { ACTIVE_MEMBER_STATUSES, AVATAR_ASSUMED_BUDGET, getVoteWindowHours } from '@/lib/constants'
import { shouldLockDecision } from '@/lib/decisions'
import { AVATAR_META, BUDGET_TIER_META } from '@/types'
import type { AvatarType, BudgetTier } from '@/types'
import { deriveSpendVote, checkAndTriggerItinerary } from '@/lib/trip-checks'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const now = Date.now()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  await db.from('processed_messages')
    .delete()
    .lt('processed_at', new Date(now - 2 * 3600000).toISOString())

  // ── 1. Vote nudges ─────────────────────────────────────────────────────────
  const voteTypes = [
    { type: 'destination', status: 'destination_vote' },
    { type: 'hotel', status: 'hotel_vote' },
    { type: 'itinerary', status: 'itinerary_vote' },
  ] as const

  for (const { type: voteType, status: tripStatus } of voteTypes) {
    const { data: trips } = await db
      .from('trips')
      .select('id, name, confirmed_destination, destination_options, status, status_updated_at, departure_date, organizer_id')
      .eq('status', tripStatus)

    for (const trip of trips ?? []) {
      const voteWindowHours = getVoteWindowHours(trip.departure_date)
      const hoursOpen = (now - new Date(trip.status_updated_at ?? now).getTime()) / 3600000

      const stageThresholds = voteWindowHours === 6
        ? [1, 3, 5]
        : [6, 18, 36]

      const { data: voted } = await db.from('votes').select('member_id, value').eq('trip_id', trip.id).eq('vote_type', voteType)
      const votedIds = new Set((voted ?? []).map((v: { member_id: string }) => v.member_id))

      const { data: activeMembers } = await db.from('members')
        .select('id, email, name, brownie_points')
        .eq('trip_id', trip.id)
        .in('status', ACTIVE_MEMBER_STATUSES)
        .eq('opt_out', false)

      const nonVoters = (activeMembers ?? []).filter((m: { id: string }) => !votedIds.has(m.id))
      const voteDeadline = new Date(new Date(trip.status_updated_at ?? now).getTime() + voteWindowHours * 3_600_000)

      // Lock early at 70% completion OR when the full vote window expires
      if (shouldLockDecision(votedIds.size, (activeMembers ?? []).length, voteDeadline)) {
        const tally: Record<string, number> = {}
        for (const v of voted ?? []) {
          const val = (v as { value?: string }).value ?? 'unknown'
          tally[val] = (tally[val] ?? 0) + 1
        }
        const entries = Object.entries(tally).sort(([, a], [, b]) => b - a)

        if (entries.length === 0) {
          const firstOpt = Array.isArray(trip.destination_options)
            ? (trip.destination_options[0] as { name?: string } | string)
            : null
          const winner = typeof firstOpt === 'object' ? firstOpt?.name : firstOpt ?? 'Option 1'
          const organiser = (activeMembers ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
          if (organiser?.email) {
            await sendEmail(organiser.email,
              `Zero votes on ${trip.name}'s ${voteType} — classic squad 😅`,
              `Your squad collectively looked at the ${voteType} options for ${trip.name} and decided... to do nothing.\n\nWe've gone with ${winner} as the default. You can override it if you hate it.\n\nChange it → ${appUrl}/organizer/${trip.id}`)
          }
        } else {
          const topCount = entries[0][1]
          const tied = entries.filter(([, c]) => c === topCount)
          const winner = tied[Math.floor(Math.random() * tied.length)][0]

          if (tied.length > 1 && voteType !== 'destination') {
            const organiser = (activeMembers ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
            if (organiser?.email) {
              const opts = tied.map(([v], i) => `[${i + 1}] ${v}`).join('\n')
              await sendEmail(organiser.email,
                `Your squad couldn't agree on ${trip.name}'s ${voteType} 🤷 — your call`,
                `Democracy has failed. It's a tie.\n\n${opts}\n\nYou're the organizer. This is your moment. Pick one → ${appUrl}/organizer/${trip.id}`)
              await db.from('trips').update({ status: `${voteType}_tiebreaker` as never }).eq('id', trip.id)
              continue
            }
          }

          await db.from('trips').update({
            confirmed_destination: voteType === 'destination' ? winner : undefined,
            status: voteType === 'destination' ? 'hotel_vote' : voteType === 'hotel' ? 'itinerary_preferences' : 'locked',
            status_updated_at: new Date().toISOString(),
          }).eq('id', trip.id)

          // Phase 7: auto-trigger itinerary generation when hotel locks
          // (destination + budget + dates already set at this point)
          if (voteType === 'hotel') {
            await checkAndTriggerItinerary(db, trip.id)
          }

          for (const m of nonVoters) {
            if (!m.email) continue
            await sendEmail(m.email,
              `Voting closed for ${trip.name} — ${winner} it is!`,
              `Voting closed for ${trip.name}. ${winner} it is! Here's what's happening next → ${appUrl}/trip/${trip.id}`)
          }
        }
        continue
      }

      for (const member of nonVoters) {
        if (!member.email) continue
        let stage: 1 | 2 | 3 | null = null
        if (hoursOpen >= stageThresholds[2]) stage = 3
        else if (hoursOpen >= stageThresholds[1]) stage = 2
        else if (hoursOpen >= stageThresholds[0]) stage = 1

        if (!stage) continue

        const { data: existing } = await db.from('nudges').select('id')
          .eq('trip_id', trip.id).eq('member_id', member.id)
          .eq('vote_type', voteType).eq('stage', stage).single()
        if (existing) continue

        const totalActive = (activeMembers ?? []).length
        const decayedPoints = Math.max(totalActive - Math.floor(hoursOpen), 1)

        const subjects: Record<1 | 2 | 3, string> = {
          1: `⏳ The ${trip.name} ${voteType} vote is waiting for you`,
          2: `Everyone voted on ${trip.name} except you 😬`,
          3: `🚨 Final call — ${trip.name} ${voteType} vote closes soon`,
        }
        const msgs: Record<1 | 2 | 3, string> = {
          1: `Hey! The ${voteType} vote for ${trip.name} is open and ${nonVoters.length - 1} of you haven't voted yet.\n\nYour opinion matters (and so do the brownie points 👀)\n\nVote now → ${appUrl}/trip/${trip.id}`,
          2: `Okay this is awkward. Everyone voted on the ${voteType} for ${trip.name}... except you.\n\nNot judging. But the group is waiting.\n\n+${decayedPoints} brownie points if you vote right now → ${appUrl}/trip/${trip.id}\n\n(Points decay the longer you wait — just saying 😅)`,
          3: `LAST CALL 🚨 The ${trip.name} ${voteType} vote closes very soon.\n\nIf you don't vote, the group's pick goes forward without your input — and you lose your chance at brownie points.\n\nVote now → ${appUrl}/trip/${trip.id}`,
        }

        await sendEmail(member.email, subjects[stage], msgs[stage])
        await db.from('nudges').insert({ trip_id: trip.id, member_id: member.id, vote_type: voteType, stage })
      }
    }
  }

  // ── 2. Questionnaire nudges ─────────────────────────────────────────────────
  const questStates = ['consented', 'avatar_selection', 'pref_q1', 'pref_q2', 'pref_q3', 'pref_q4']
  const { data: questMembers } = await db.from('members')
    .select('id, email, name, trip_id, status, updated_at, trips(name, departure_date)')
    .in('status', questStates)
    .eq('opt_out', false)

  for (const member of questMembers ?? []) {
    if (!member.email) continue
    const trip = (member as unknown as { trips?: { name: string; departure_date: string | null } }).trips
    if (!trip) continue
    const hoursElapsed = (now - new Date((member as { updated_at?: string }).updated_at ?? now).getTime()) / 3600000

    let stage: 1 | 2 | 3 | null = null
    if (hoursElapsed >= 36) stage = 3
    else if (hoursElapsed >= 18) stage = 2
    else if (hoursElapsed >= 6) stage = 1

    if (!stage) continue

    const { data: existing } = await db.from('nudges').select('id')
      .eq('trip_id', member.trip_id).eq('member_id', member.id)
      .eq('vote_type', 'questionnaire').eq('stage', stage).single()
    if (existing) continue

    const subjects: Record<1 | 2 | 3, string> = {
      1: `4 questions. 60 seconds. ${trip.name} is waiting ✈️`,
      2: `Your squad is already filling in ${trip.name} details — don't get left behind`,
      3: `⚠️ Final nudge — we need your vibe for ${trip.name}`,
    }
    const msgs: Record<1 | 2 | 3, string> = {
      1: `The organizer worked hard to get this trip going. The least you can do is answer 4 questions 😅\n\nTakes 60 seconds → ${appUrl}/preferences/${member.trip_id}/${member.id}`,
      2: `Everyone else is filling in their preferences for ${trip.name}.\n\nYou're making the organizer refresh the dashboard every 5 minutes. They need a hobby. Help them out.\n\nPick up here → ${appUrl}/preferences/${member.trip_id}/${member.id}`,
      3: `Okay this is your last nudge, we promise.\n\nThe organizer has stress-planned this trip for days. Your 4-question input is all that's missing.\n\nDo it now → ${appUrl}/preferences/${member.trip_id}/${member.id}`,
    }

    await sendEmail(member.email, subjects[stage], msgs[stage])
    await db.from('nudges').insert({ trip_id: member.trip_id, member_id: member.id, vote_type: 'questionnaire', stage })
  }

  // ── 3. Auto-assign avatar at T+24h ─────────────────────────────────────────
  const { data: unassigned } = await db.from('members')
    .select('id, email, trip_id, name, updated_at')
    .eq('status', 'consented')
    .is('avatar', null)
    .eq('opt_out', false)

  for (const member of unassigned ?? []) {
    if (!member.email) continue
    const hours = (now - new Date((member as { updated_at?: string }).updated_at ?? now).getTime()) / 3600000
    if (hours < 24) continue

    const { data: taken } = await db.from('members')
      .select('avatar').eq('trip_id', member.trip_id).not('avatar', 'is', null)
    const takenCounts = (taken ?? []).reduce((acc: Record<string, number>, m: { avatar: string | null }) => {
      if (m.avatar) acc[m.avatar] = (acc[m.avatar] ?? 0) + 1
      return acc
    }, {})

    const candidates: AvatarType[] = ['navigator', 'budgeteer', 'foodie', 'adventure_seeker', 'photographer', 'spontaneous_one']
    const leastTaken = candidates.sort((a, b) => (takenCounts[a] ?? 0) - (takenCounts[b] ?? 0))[0]

    await db.from('members').update({
      avatar: leastTaken,
      status: 'avatar_selection',
      avatar_auto_assigned: true,
    }).eq('id', member.id)

    const { data: tripData } = await db.from('trips').select('name').eq('id', member.trip_id).single()

    await sendEmail(member.email,
      `You've been auto-assigned a role for ${tripData?.name ?? 'your trip'} 🎭`,
      `Since you didn't pick a role, we went ahead and made you ${AVATAR_META[leastTaken].label} for ${tripData?.name ?? 'your trip'}.\n\nNo hard feelings — you can swap it in the next 12h if it's not vibing.\n\nChange your role → ${appUrl}/avatar/${member.trip_id}/${member.id}\n\n(The organizer will never know 🤫)`)
  }

  // ── 4. Budget assumed default at T+18h ────────────────────────────────────
  const { data: nobudget } = await db.from('members')
    .select('id, email, trip_id, avatar, updated_at')
    .not('avatar', 'is', null)
    .is('budget_tier', null)
    .in('status', ['avatar_selection', 'active'])
    .eq('opt_out', false)
    .eq('budget_assumed', false)

  for (const member of nobudget ?? []) {
    if (!member.email) continue
    const hours = (now - new Date((member as { updated_at?: string }).updated_at ?? now).getTime()) / 3600000
    if (hours < 18) continue

    const avatar = member.avatar as AvatarType
    const assumedTier: BudgetTier = AVATAR_ASSUMED_BUDGET[avatar] ?? 'comfortable'
    const tierMeta = BUDGET_TIER_META[assumedTier]

    await db.from('members').update({
      budget_tier: assumedTier,
      spend_vote: deriveSpendVote(assumedTier),
      budget_assumed: true,
    }).eq('id', member.id)

    await sendEmail(member.email,
      `We guessed your budget for ${tripData?.name ?? 'your trip'} — hope that's okay 😅`,
      `You didn't fill in your budget preferences, so we assumed ${tierMeta.label} (${tierMeta.range}/person) based on your vibe.\n\nThe organizer didn't notice. Yet.\n\nWant to change it before they do? → ${appUrl}/preferences/${member.trip_id}/${member.id}`)
  }

  // ── 4b. Auto-advance destination_vote_pending → destination_vote ──────────
  // Fires when destination_vote_scheduled_at has passed
  const { data: pendingVoteTrips } = await db.from('trips')
    .select('id, name, organizer_id, destination_vote_scheduled_at, members(id, email, opt_out, status)')
    .eq('status', 'destination_vote_pending')
    .lt('destination_vote_scheduled_at', new Date(now).toISOString())

  for (const trip of pendingVoteTrips ?? []) {
    await db.from('trips').update({
      status: 'destination_vote',
      status_updated_at: new Date(now).toISOString(),
    }).eq('id', trip.id)

    // Notify all active members that voting is open
    const active = (trip.members ?? []).filter((m: { status: string; opt_out: boolean }) =>
      ACTIVE_MEMBER_STATUSES.includes(m.status as never) && !m.opt_out
    )
    for (const m of active) {
      if (!m.email) continue
      await sendEmail(
        m.email,
        `🗳 Voting is open for ${trip.name} — be first, earn more points`,
        `The squad is voting on where to go for ${trip.name}!\n\nFirst to vote gets the most brownie points 👀 Don't let your mates lock in the destination without you.\n\nVote now → ${appUrl}/trip/${trip.id}`
      )
    }
  }

  // ── 5. Zero-member trip auto-cancel ───────────────────────────────────────
  const { data: staleTrips } = await db.from('trips')
    .select('id, name, organizer_id, status_updated_at, members(id, email, status)')
    .eq('status', 'inviting')
    .lt('status_updated_at', new Date(now - 48 * 3600000).toISOString())

  for (const trip of staleTrips ?? []) {
    const active = (trip.members ?? []).filter((m: { status: string }) =>
      ACTIVE_MEMBER_STATUSES.includes(m.status as never)
    )
    if (active.length > 1) continue

    await db.from('trips').update({ status: 'cancelled', status_updated_at: new Date().toISOString() }).eq('id', trip.id)

    const organiser = (trip.members ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
    if (organiser?.email) {
      await sendEmail(organiser.email,
        `${trip.name} got auto-cancelled 😬 — no one joined`,
        `Ouch. Your trip ${trip.name} was auto-cancelled because no one joined in 48 hours.\n\nMaybe try a group chat first next time? 😅\n\nStart fresh → ${appUrl}`)
    }
  }

  // ── 6. Day-by-day countdown (T-14 to T-1) ─────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0]
  const t14 = new Date(now + 14 * 86400000).toISOString().split('T')[0]
  const { data: countdownTrips } = await db.from('trips')
    .select('id, name, confirmed_destination, confirmed_hotel, itinerary, departure_date, members(id, email, avatar, opt_out, status, name)')
    .eq('status', 'locked')
    .gte('departure_date', todayStr)
    .lte('departure_date', t14)

  for (const trip of countdownTrips ?? []) {
    const daysOut = Math.ceil((new Date(trip.departure_date).getTime() - now) / 86400000)
    if (daysOut < 1) continue

    for (const member of (trip.members ?? []).filter((m: { status: string; opt_out: boolean }) =>
      m.status === 'active' && !m.opt_out
    )) {
      if (!member.email) continue
      const { data: alreadySent } = await db.from('nudges').select('id')
        .eq('trip_id', trip.id).eq('member_id', member.id)
        .eq('vote_type', `countdown_${daysOut}`).single()
      if (alreadySent) continue

      let msg = ''
      if (daysOut >= 8) {
        msg = `In ${daysOut} days: You're going to ${trip.confirmed_destination}! ${(trip.confirmed_hotel as { name?: string })?.name ? `Staying at ${(trip.confirmed_hotel as { name: string }).name} 🏨` : ''}`
      } else if (daysOut >= 2) {
        const day1 = (trip.itinerary as { activities?: { title: string }[] }[] | null)?.[0]
        const firstActivity = day1?.activities?.[0]?.title
        msg = `In ${daysOut} days: ${firstActivity ? `Day 1 plan includes ${firstActivity}.` : `${trip.confirmed_destination} is almost here!`} 🎉`
      } else {
        msg = `${trip.name} is tomorrow! Everything is planned. Just pack. 🎒`
      }

      await sendEmail(member.email, `${trip.name} — ${daysOut} day${daysOut > 1 ? 's' : ''} to go!`, msg)
      await db.from('nudges').insert({
        trip_id: trip.id, member_id: member.id,
        vote_type: `countdown_${daysOut}`, stage: 1,
      })
    }
  }

  // ── 7. Organizer abandonment escalation ───────────────────────────────────
  const { data: activeTrips } = await db.from('trips')
    .select('id, name, organizer_id, created_at, status')
    .not('status', 'in', '("locked","cancelled","draft")')
    .not('organizer_id', 'is', null)

  for (const trip of activeTrips ?? []) {
    const { data: organizer } = await db.from('members')
      .select('id, email, name, last_active_at, brownie_points')
      .eq('id', trip.organizer_id)
      .single()
    if (!organizer?.email) continue

    // Fall back to trip creation time if organizer has never had activity tracked
    const lastActive = organizer.last_active_at ?? trip.created_at
    const hoursInactive = (now - new Date(lastActive).getTime()) / 3600000

    // Stage 1: 3 days (72h) — reminder
    // Stage 2: 4 days (96h) — 48h warning
    // Stage 3: 5 days (120h) — transfer ownership
    let stage: 1 | 2 | 3 | null = null
    if (hoursInactive >= 120) stage = 3
    else if (hoursInactive >= 96) stage = 2
    else if (hoursInactive >= 72) stage = 1

    if (!stage) continue

    const { data: existingNudge } = await db.from('nudges').select('id')
      .eq('trip_id', trip.id).eq('member_id', organizer.id)
      .eq('vote_type', 'organizer_inactivity').eq('stage', stage).single()
    if (existingNudge) continue

    if (stage === 3) {
      // Find most-engaged active member to take over (highest brownie_points, exclude current organizer)
      const { data: candidates } = await db.from('members')
        .select('id, email, name, brownie_points')
        .eq('trip_id', trip.id)
        .eq('status', 'active')
        .eq('opt_out', false)
        .neq('id', organizer.id)
        .order('brownie_points', { ascending: false })
        .limit(1)

      const newOrganizer = candidates?.[0]
      if (!newOrganizer?.email) {
        // No eligible member to transfer to — skip transfer, still log nudge to avoid spam
        await db.from('nudges').insert({
          trip_id: trip.id, member_id: organizer.id,
          vote_type: 'organizer_inactivity', stage: 3,
        })
        continue
      }

      // Transfer ownership
      await db.from('trips').update({ organizer_id: newOrganizer.id }).eq('id', trip.id)
      await db.from('members').update({ last_active_at: new Date().toISOString() }).eq('id', newOrganizer.id)

      // Notify old organizer
      await sendEmail(
        organizer.email,
        `${newOrganizer.name} took over ${trip.name} — the squad needed a captain 🏴‍☠️`,
        `Hey ${organizer.name ?? 'there'},\n\nYou've been AWOL for 5 days, so we handed the organizer role to ${newOrganizer.name} — the most engaged person in your squad.\n\nNo hard feelings. ${newOrganizer.name} is probably better at this anyway 😅\n\nIf you're back and want to reclaim your throne, reach out to your squad directly.`
      )

      // Notify new organizer
      await sendEmail(
        newOrganizer.email,
        `Congratulations — you're the new captain of ${trip.name} 🎉`,
        `Hey ${newOrganizer.name ?? 'there'}!\n\nThe previous organizer disappeared. Your squad needed someone responsible. They picked you.\n\nNo pressure, but the whole trip depends on you now. 😬\n\nTake the wheel → ${appUrl}/organizer/${trip.id}\n\nYou've got this.`
      )

      await db.from('nudges').insert({
        trip_id: trip.id, member_id: organizer.id,
        vote_type: 'organizer_inactivity', stage: 3,
      })
    } else if (stage === 2) {
      await sendEmail(
        organizer.email,
        `⏰ 48h warning — ${trip.name} needs its organizer back`,
        `Hey ${organizer.name ?? 'there'},\n\nYour squad is still waiting. If the trip doesn't get some love in the next 2 days, we'll hand the organizer badge to whoever's been most active.\n\nYou spent time planning this. Don't let someone else take the glory 😅\n\nPick it back up → ${appUrl}/organizer/${trip.id}`
      )
      await db.from('nudges').insert({
        trip_id: trip.id, member_id: organizer.id,
        vote_type: 'organizer_inactivity', stage: 2,
      })
    } else {
      await sendEmail(
        organizer.email,
        `Your squad joined ${trip.name} — now they're just... waiting 👀`,
        `Hey ${organizer.name ?? 'there'},\n\nGood news: your squad joined the trip!\nBad news: they can't move forward without you.\n\nThe organizer (that's you) has been quiet for 3 days. Your squad is too polite to say anything. We're not.\n\nJump back in → ${appUrl}/organizer/${trip.id}`
      )
      await db.from('nudges').insert({
        trip_id: trip.id, member_id: organizer.id,
        vote_type: 'organizer_inactivity', stage: 1,
      })
    }
  }

  // ── 8. FOMO emails — questionnaire deadline urgency ───────────────────────
  // Stage 1: pre-deadline warmup  (threshold varies by nudge_frequency_type)
  // Stage 2: peak FOMO            ("it's just you")
  // Stage 3: deadline passed      → last chance to update
  //
  // Thresholds (minutes before deadline to fire each stage):
  //   gentle:     stage1=120, stage2=60
  //   normal:     stage1=90,  stage2=60
  //   aggressive: stage1=60,  stage2=30
  //   custom:     stage1=nudge_frequency_value*2, stage2=nudge_frequency_value
  const FOMO_THRESHOLDS: Record<string, [number, number]> = {
    gentle:     [120, 60],
    normal:     [90,  60],
    aggressive: [60,  30],
  }

  const { data: fomoMembers } = await db.from('members')
    .select('id, email, name, trip_id, fomo_stage, trips(id, name, questionnaire_deadline_at, status, organizer_id, nudge_frequency_type, nudge_frequency_value)')
    .is('budget_tier', null)
    .eq('opt_out', false)
    .not('status', 'in', '("declined","dropped","active")')

  for (const member of fomoMembers ?? []) {
    if (!member.email) continue
    const trip = (member as unknown as {
      trips?: {
        id: string; name: string; questionnaire_deadline_at: string | null
        status: string; organizer_id: string | null
        nudge_frequency_type: string; nudge_frequency_value: number | null
      }
    }).trips
    if (!trip?.questionnaire_deadline_at) continue
    if (['locked', 'cancelled', 'draft'].includes(trip.status)) continue

    const freqType = trip.nudge_frequency_type ?? 'normal'
    const freqVal = trip.nudge_frequency_value
    const [s1MinsBefore, s2MinsBefore] = freqType === 'custom' && freqVal
      ? [freqVal * 2, freqVal]
      : (FOMO_THRESHOLDS[freqType] ?? FOMO_THRESHOLDS.normal)

    const deadlineMs = new Date(trip.questionnaire_deadline_at).getTime()
    const msToDeadline = deadlineMs - now
    const deadlinePassed = msToDeadline <= 0

    let targetStage: 1 | 2 | 3 | null = null
    if (deadlinePassed) targetStage = 3
    else if (msToDeadline <= s2MinsBefore * 60000) targetStage = 2
    else if (msToDeadline <= s1MinsBefore * 60000) targetStage = 1

    if (!targetStage) continue
    const currentStage = (member as unknown as { fomo_stage?: number }).fomo_stage ?? 0
    if (currentStage >= targetStage && !targetStage) continue

    // Fetch organizer name + live submitted count in parallel
    const [organizerRes, countRes, totalCountRes] = await Promise.all([
      trip.organizer_id
        ? db.from('members').select('name').eq('id', trip.organizer_id).single()
        : Promise.resolve({ data: null }),
      db.from('members')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', member.trip_id)
        .not('budget_tier', 'is', null),
      db.from('members')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', member.trip_id)
        .not('status', 'in', '("declined","dropped")'),
    ])

    const submitted = countRes.count ?? 0
    const totalActive = totalCountRes.count ?? 0
    const remaining = totalActive - submitted   // members (incl. this one) who haven't submitted

    // Override conditions — bypass frequency schedule, always send stage 2 immediately
    const isLastUser = remaining === 1           // this member is the only one left
    const majorityReached = submitted > totalActive / 2  // >50% already in
    const deadlineNear = !deadlinePassed && msToDeadline <= 30 * 60000  // ≤30 min left

    const override = (isLastUser || majorityReached || deadlineNear) && currentStage < 2
    const effectiveStage: 1 | 2 | 3 = override ? 2 : (targetStage ?? 1)

    if (currentStage >= effectiveStage) continue

    const organizerName = (organizerRes.data as { name?: string | null } | null)?.name ?? 'the organizer'
    const userName = member.name ?? 'there'
    const link = `${appUrl}/preferences/${member.trip_id}/${member.id}`

    const subjects: Record<1 | 2 | 3, string> = {
      1: `${submitted} squad members locked their budget for ${trip.name} — you haven't 👀`,
      2: `💀 It's literally just you left, ${userName}`,
      3: `⏰ Budget window closed for ${trip.name} — here's what we assumed for you`,
    }
    const msgs: Record<1 | 2 | 3, string> = {
      1: `Hey ${userName},\n\n${submitted} of your squad already locked their budget for ${trip.name}.\n\n${organizerName} is definitely not refreshing the dashboard every 5 minutes waiting for you. Definitely not. 😅\n\nTakes 30 seconds → ${link}`,
      2: `Hey ${userName},\n\n💀 It's just you.\n\nEvery. Single. Person. In the squad has filled this in. The organizer (${organizerName}) has read-receipts on the dashboard and is watching.\n\nJust... do it. → ${link}`,
      3: `Hey ${userName},\n\nThe budget window for ${trip.name} has closed.\n\nWe've assigned you a default budget based on your role — but you've got a small window to override it before the plan locks.\n\nUpdate now → ${link}`,
    }

    await sendEmail(member.email, subjects[effectiveStage], msgs[effectiveStage])
    await db.from('members').update({
      fomo_stage: effectiveStage,
      last_fomo_sent_at: new Date(now).toISOString(),
    }).eq('id', member.id)
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
}
