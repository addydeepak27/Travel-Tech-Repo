import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendWhatsApp } from '@/lib/twilio'
import { ACTIVE_MEMBER_STATUSES, AVATAR_ASSUMED_BUDGET, getVoteWindowHours } from '@/lib/constants'
import { AVATAR_META, BUDGET_TIER_META } from '@/types'
import type { AvatarType, BudgetTier } from '@/types'
import { deriveSpendVote } from '@/lib/trip-checks'

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
        .select('id, phone, name, brownie_points')
        .eq('trip_id', trip.id)
        .in('status', ACTIVE_MEMBER_STATUSES)
        .eq('opt_out', false)

      const nonVoters = (activeMembers ?? []).filter((m: { id: string }) => !votedIds.has(m.id))

      if (hoursOpen >= voteWindowHours) {
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
          if (organiser?.phone) {
            await sendWhatsApp(organiser.phone,
              `No one voted for *${trip.name}*'s ${voteType}. We've gone with *${winner}* as the default. Change it from your dashboard → ${appUrl}/organizer/${trip.id}`)
          }
        } else {
          const topCount = entries[0][1]
          const tied = entries.filter(([, c]) => c === topCount)
          const winner = tied[Math.floor(Math.random() * tied.length)][0]

          if (tied.length > 1 && voteType !== 'destination') {
            const organiser = (activeMembers ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
            if (organiser?.phone) {
              const opts = tied.map(([v], i) => `[${i + 1}] ${v}`).join('\n')
              await sendWhatsApp(organiser.phone,
                `🔵 Tied vote for *${trip.name}* ${voteType}.\n\n${opts}\n\nYou decide — reply 1 or ${tied.length}.`)
              await db.from('trips').update({ status: `${voteType}_tiebreaker` as never }).eq('id', trip.id)
              continue
            }
          }

          await db.from('trips').update({
            confirmed_destination: voteType === 'destination' ? winner : undefined,
            status: voteType === 'destination' ? 'hotel_vote' : voteType === 'hotel' ? 'itinerary_preferences' : 'locked',
            status_updated_at: new Date().toISOString(),
          }).eq('id', trip.id)

          for (const m of nonVoters) {
            await sendWhatsApp(m.phone,
              `Voting closed for *${trip.name}*. *${winner}* it is! Here's what's happening next → ${appUrl}/trip/${trip.id}`)
          }
        }
        continue
      }

      for (const member of nonVoters) {
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

        const msgs: Record<1 | 2 | 3, string> = {
          1: `👋 Quick reminder — *${trip.name}* ${voteType} vote is still open.\n\nYou're one of ${nonVoters.length} yet to vote. Takes 5 seconds.\n\nReply with your pick, or *options* to see the choices again.`,
          2: `⏳ *${nonVoters.length - 1} people voted* for *${trip.name}* ${voteType}. You haven't yet.\n\nIf you don't vote, the group picks without you.\n\n🍫 *${decayedPoints} brownie points* available if you vote now.\n\nReply *options* to see the choices.`,
          3: `🚨 *Last chance* — *${trip.name}* vote closes soon.\n\nGroup's majority pick goes forward automatically if you don't respond.\n\nReply *options* for the choices 👆`,
        }

        await sendWhatsApp(member.phone, msgs[stage])
        await db.from('nudges').insert({ trip_id: trip.id, member_id: member.id, vote_type: voteType, stage })
      }
    }
  }

  // ── 2. Questionnaire nudges ─────────────────────────────────────────────────
  const questStates = ['consented', 'avatar_selection', 'pref_q1', 'pref_q2', 'pref_q3', 'pref_q4']
  const { data: questMembers } = await db.from('members')
    .select('id, phone, name, trip_id, status, updated_at, trips(name, departure_date)')
    .in('status', questStates)
    .eq('opt_out', false)

  for (const member of questMembers ?? []) {
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

    const msgs: Record<1 | 2 | 3, string> = {
      1: `👋 Just 4 quick questions and you're all set for *${trip.name}*! Reply *hi* anytime to continue.`,
      2: `The group is waiting on your preferences for *${trip.name}*. Reply *hi* to pick up where you left off.`,
      3: `Last nudge — your squad needs your input to plan *${trip.name}*. Reply *hi* to answer 4 quick questions.`,
    }

    await sendWhatsApp(member.phone, msgs[stage])
    await db.from('nudges').insert({ trip_id: member.trip_id, member_id: member.id, vote_type: 'questionnaire', stage })
  }

  // ── 3. Auto-assign avatar at T+24h ─────────────────────────────────────────
  const { data: unassigned } = await db.from('members')
    .select('id, phone, trip_id, name, updated_at')
    .eq('status', 'consented')
    .is('avatar', null)
    .eq('opt_out', false)

  for (const member of unassigned ?? []) {
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

    await sendWhatsApp(member.phone,
      `We've given you *${AVATAR_META[leastTaken].label}* for *${tripData?.name ?? 'your trip'}* — you can swap it in the next 12h 👇\n${appUrl}/avatar/${member.trip_id}/${member.id}`)
  }

  // ── 4. Budget assumed default at T+18h ────────────────────────────────────
  const { data: nobudget } = await db.from('members')
    .select('id, phone, trip_id, avatar, updated_at')
    .not('avatar', 'is', null)
    .is('budget_tier', null)
    .in('status', ['avatar_selection', 'active'])
    .eq('opt_out', false)
    .eq('budget_assumed', false)

  for (const member of nobudget ?? []) {
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

    await sendWhatsApp(member.phone,
      `We've assumed *${tierMeta.label}* budget (${tierMeta.range}) for you based on your role.\n\nWrong? Fix it — reply:\n[1] Backpacker <₹5k\n[2] Comfortable ₹5–10k\n[3] Premium ₹10–20k\n[4] Luxury ₹20k+`)
  }

  // ── 5. Zero-member trip auto-cancel ───────────────────────────────────────
  const { data: staleTrips } = await db.from('trips')
    .select('id, name, organizer_id, status_updated_at, members(id, phone, status)')
    .eq('status', 'inviting')
    .lt('status_updated_at', new Date(now - 48 * 3600000).toISOString())

  for (const trip of staleTrips ?? []) {
    const active = (trip.members ?? []).filter((m: { status: string }) =>
      ACTIVE_MEMBER_STATUSES.includes(m.status as never)
    )
    if (active.length > 1) continue

    await db.from('trips').update({ status: 'cancelled', status_updated_at: new Date().toISOString() }).eq('id', trip.id)

    const organiser = (trip.members ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
    if (organiser?.phone) {
      await sendWhatsApp(organiser.phone,
        `Your trip *${trip.name}* was auto-cancelled — no one joined in 48 hours. Start a new one at ${appUrl} 🌊`)
    }
  }

  // ── 6. Day-by-day countdown (T-14 to T-1) ─────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0]
  const t14 = new Date(now + 14 * 86400000).toISOString().split('T')[0]
  const { data: countdownTrips } = await db.from('trips')
    .select('id, name, confirmed_destination, confirmed_hotel, itinerary, departure_date, members(id, phone, avatar, opt_out, status, name)')
    .eq('status', 'locked')
    .gte('departure_date', todayStr)
    .lte('departure_date', t14)

  for (const trip of countdownTrips ?? []) {
    const daysOut = Math.ceil((new Date(trip.departure_date).getTime() - now) / 86400000)
    if (daysOut < 1) continue

    for (const member of (trip.members ?? []).filter((m: { status: string; opt_out: boolean }) =>
      m.status === 'active' && !m.opt_out
    )) {
      const { data: alreadySent } = await db.from('nudges').select('id')
        .eq('trip_id', trip.id).eq('member_id', member.id)
        .eq('vote_type', `countdown_${daysOut}`).single()
      if (alreadySent) continue

      let msg = ''
      if (daysOut >= 8) {
        msg = `In *${daysOut} days*: You're going to *${trip.confirmed_destination}*! ${(trip.confirmed_hotel as { name?: string })?.name ? `Staying at ${(trip.confirmed_hotel as { name: string }).name} 🏨` : ''}`
      } else if (daysOut >= 2) {
        const day1 = (trip.itinerary as { activities?: { title: string }[] }[] | null)?.[0]
        const firstActivity = day1?.activities?.[0]?.title
        msg = `In *${daysOut} days*: ${firstActivity ? `Day 1 plan includes ${firstActivity}.` : `${trip.confirmed_destination} is almost here!`} 🎉`
      } else {
        msg = `*${trip.name}* is tomorrow! Everything is planned. Just pack. 🎒`
      }

      await sendWhatsApp(member.phone, msg)
      await db.from('nudges').insert({
        trip_id: trip.id, member_id: member.id,
        vote_type: `countdown_${daysOut}`, stage: 1,
      })
    }
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
}
