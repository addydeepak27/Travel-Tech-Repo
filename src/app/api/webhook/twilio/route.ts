import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendWhatsApp } from '@/lib/twilio'
import { BUDGET_TIER_META } from '@/types'
import type { AvatarType, BudgetTier, VotePace } from '@/types'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = (formData.get('From') as string)?.replace('whatsapp:', '') ?? ''
  const body = (formData.get('Body') as string)?.trim().toLowerCase() ?? ''

  if (!from) return NextResponse.json({ ok: true })

  // Handle STOP immediately
  if (body === 'stop') {
    const db = createServiceClient()
    await db.from('members').update({ opt_out: true }).eq('phone', from)
    return NextResponse.json({ ok: true })
  }

  const db = createServiceClient()

  // Find member by phone
  const { data: member } = await db
    .from('members')
    .select('*, trips(*)')
    .eq('phone', from)
    .eq('opt_out', false)
    .order('joined_at', { ascending: false })
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ ok: true })

  const trip = member.trips
  if (!trip) return NextResponse.json({ ok: true })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // Route based on member status + trip status
  if (body === "i'm in" || body === 'yes') {
    await handleConsent(db, member, trip, from)
  } else if (body === "can't make it" || body === 'no') {
    await handleDecline(db, member, trip, from)
  } else if (!member.budget_tier && member.avatar && ['consented', 'avatar_selected', 'active'].includes(member.status)) {
    // Budget reply: accept at any status after avatar selection, not just 'consented'
    await handleBudgetReply(db, member, trip, from, body)
  } else if (trip.status === 'destination_vote') {
    await handleDestinationVote(db, member, trip, from, body)
  } else if (trip.status === 'hotel_vote') {
    await handleHotelVote(db, member, trip, from, body)
  } else if (trip.status === 'itinerary_preferences') {
    await handleItineraryPreference(db, member, trip, from, body)
  } else if (trip.status === 'itinerary_vote') {
    await handleItineraryVote(db, member, trip, from, body)
  } else if (body === 'done' || body === '✅') {
    await handleTaskDone(db, member, from)
  } else if (body === 'reassign' || body === '🔄') {
    await handleTaskReassign(db, member, trip, from)
  } else if (trip.status !== 'draft' && trip.status !== 'locked') {
    // Catch-all: reply with context so user isn't left in silence
    await sendWhatsApp(from, `Not sure what that means — I'll send you a prompt when the group needs your input. View your trip → ${appUrl}/trip/${trip.id}`)
  }

  return NextResponse.json({ ok: true })
}

async function handleConsent(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string; trip_id: string },
  trip: { id: string; name: string },
  phone: string
) {
  await db.from('members').update({ status: 'consented', joined_at: new Date().toISOString() }).eq('id', member.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const avatarUrl = `${appUrl}/avatar/${trip.id}/${member.id}`

  await sendWhatsApp(
    phone,
    `You're in 🙌 One thing before we can build the plan — pick your role for *${trip.name}*.\n\nEvery role owns a slice of the planning. The organiser can't carry it all.\n\nPick your role → ${avatarUrl}\n\n_(24h before auto-assign)_`
  )
}

async function handleDecline(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string },
  _trip: unknown,
  phone: string
) {
  await db.from('members').update({ status: 'declined' }).eq('id', member.id)
  await sendWhatsApp(phone, `No problem — we've noted that you can't make it. If your plans change, ask the organiser to re-invite you.`)
}

async function handleBudgetReply(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string; trip_id: string; avatar: string },
  trip: { id: string },
  phone: string,
  body: string
) {
  const tierMap: Record<string, BudgetTier> = {
    '1': 'backpacker', 'backpacker': 'backpacker',
    '2': 'comfortable', 'comfortable': 'comfortable',
    '3': 'premium', 'premium': 'premium',
    '4': 'luxury', 'luxury': 'luxury',
  }
  const tier = tierMap[body]
  if (!tier) return

  await db.from('members').update({ budget_tier: tier, status: 'active' }).eq('id', member.id)
  await checkAndComputeBudgetZone(db, trip.id)
}

async function checkAndComputeBudgetZone(
  db: ReturnType<typeof createServiceClient>,
  tripId: string
) {
  // Only count members who have actively joined (not merely invited or declined)
  const { data: members } = await db
    .from('members')
    .select('budget_tier, status')
    .eq('trip_id', tripId)
    .in('status', ['consented', 'avatar_selected', 'active'])

  if (!members || members.length === 0) return

  const consented = members // already filtered to active statuses above
  const submitted = consented.filter(m => m.budget_tier)
  const pct = submitted.length / consented.length

  if (pct < 0.8) return // wait for 80%+

  const tierOrder: BudgetTier[] = ['backpacker', 'comfortable', 'premium', 'luxury']
  const tierValues: Record<BudgetTier, number> = { backpacker: 1, comfortable: 2, premium: 3, luxury: 4 }
  const tierRanges: Record<BudgetTier, { min: number; max: number }> = {
    backpacker: { min: 2000, max: 5000 },
    comfortable: { min: 5000, max: 10000 },
    premium: { min: 10000, max: 20000 },
    luxury: { min: 20000, max: 40000 },
  }

  const values = submitted.map(m => tierValues[m.budget_tier as BudgetTier]).sort((a, b) => a - b)
  if (values.length === 0) return

  // Correct median for both odd and even-length arrays
  const mid = Math.floor(values.length / 2)
  const medianValue = values.length % 2 === 0
    ? Math.round((values[mid - 1] + values[mid]) / 2)
    : values[mid]
  const medianTier = tierOrder[Math.max(0, Math.min(3, medianValue - 1))]

  const budgetZone = tierRanges[medianTier]

  await db.from('trips').update({
    weighted_median_tier: medianTier,
    group_budget_zone: budgetZone,
    status: 'destination_vote',
  }).eq('id', tripId)

  // Fire cost tips generation for organizer (non-blocking)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/claude/tips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId }),
  }).catch(() => null)

  // Trigger destination generation
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/claude/destinations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId }),
  })
}

async function handleDestinationVote(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string; trip_id: string },
  trip: { id: string; departure_date?: string },
  _phone: string,
  body: string
) {
  const { data: options } = await db
    .from('trips')
    .select('destination_options')
    .eq('id', trip.id)
    .single()

  if (!options?.destination_options) return

  const destinations: string[] = options.destination_options
  const voteMap: Record<string, string> = { '1': destinations[0], '2': destinations[1], '3': destinations[2] }
  const voted = voteMap[body] ?? destinations.find(d => body.includes(d.toLowerCase()))
  if (!voted) return

  // Upsert vote
  await db.from('votes').upsert({
    trip_id: trip.id,
    member_id: member.id,
    vote_type: 'destination',
    value: voted,
  }, { onConflict: 'trip_id,member_id,vote_type' })

  await checkDestinationVoteResult(db, trip.id)
}

async function checkDestinationVoteResult(
  db: ReturnType<typeof createServiceClient>,
  tripId: string
) {
  const { data: votes } = await db
    .from('votes')
    .select('value')
    .eq('trip_id', tripId)
    .eq('vote_type', 'destination')

  const { data: members } = await db
    .from('members')
    .select('id')
    .eq('trip_id', tripId)
    .in('status', ['consented', 'active'])

  if (!votes || !members) return

  const total = members.length
  const tally: Record<string, number> = {}
  for (const v of votes) { tally[v.value] = (tally[v.value] ?? 0) + 1 }
  const leader = Object.entries(tally).sort(([, a], [, b]) => b - a)[0]
  if (!leader) return

  const unanimous = votes.length === total && Object.keys(tally).length === 1
  const majority = leader[1] > total / 2

  if (unanimous || majority) {
    await db.from('trips').update({
      confirmed_destination: leader[0],
      status: 'hotel_vote',
    }).eq('id', tripId)

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/claude/hotels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId }),
    })
  }
}

async function handleHotelVote(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string; trip_id: string },
  trip: { id: string },
  _phone: string,
  body: string
) {
  const { data: tripData } = await db
    .from('trips')
    .select('hotel_options')
    .eq('id', trip.id)
    .single()

  if (!tripData?.hotel_options) return

  const hotels: { name: string }[] = tripData.hotel_options
  const voteMap: Record<string, string> = {
    '1': hotels[0]?.name,
    '2': hotels[1]?.name,
    '3': hotels[2]?.name,
  }
  const voted = voteMap[body] ?? hotels.find(h => body.includes(h.name.toLowerCase()))?.name
  if (!voted) return

  await db.from('votes').upsert({
    trip_id: trip.id,
    member_id: member.id,
    vote_type: 'hotel',
    value: voted,
  }, { onConflict: 'trip_id,member_id,vote_type' })

  await checkHotelVoteResult(db, trip.id)
}

async function checkHotelVoteResult(
  db: ReturnType<typeof createServiceClient>,
  tripId: string
) {
  const { data: votes } = await db.from('votes').select('value').eq('trip_id', tripId).eq('vote_type', 'hotel')
  const { data: members } = await db.from('members').select('id').eq('trip_id', tripId).in('status', ['consented', 'active'])
  if (!votes || !members) return

  const tally: Record<string, number> = {}
  for (const v of votes) { tally[v.value] = (tally[v.value] ?? 0) + 1 }
  const leader = Object.entries(tally).sort(([, a], [, b]) => b - a)[0]
  if (!leader) return

  if (leader[1] > members.length / 2) {
    const { data: tripData } = await db.from('trips').select('hotel_options').eq('id', tripId).single()
    const confirmedHotel = tripData?.hotel_options?.find((h: { name: string }) => h.name === leader[0])
    if (!confirmedHotel) return

    await db.from('trips').update({
      confirmed_hotel: confirmedHotel,
      status: 'itinerary_preferences',
    }).eq('id', tripId)

    // Send itinerary preference questions to all members
    const { data: allMembers } = await db.from('members').select('phone, avatar').eq('trip_id', tripId).in('status', ['consented', 'active'])
    const tierMeta = await db.from('trips').select('weighted_median_tier').eq('id', tripId).single()
    const tier = (tierMeta.data?.weighted_median_tier as BudgetTier) ?? 'comfortable'

    const spendRanges = BUDGET_TIER_META[tier].daily_spend_ranges

    for (const m of allMembers ?? []) {
      if (!m.phone) continue
      await sendWhatsApp(
        m.phone,
        `One quick thing before we build your plan — what's your vibe for the days?\n\n[1] Easy & Chill 🌴\n[2] Balanced Mix 🎯\n[3] Packed Schedule 🔥\n\nReply 1, 2, or 3`
      )
      // Q2 fires after a 5-minute delay so it feels like two separate questions
      const phone = m.phone
      setTimeout(async () => {
        await sendWhatsApp(
          phone,
          `And how much are you comfortable spending per day on food + activities?\n\n[1] ${spendRanges[0]}\n[2] ${spendRanges[1]}\n[3] ${spendRanges[2]}\n\nReply 1, 2, or 3`
        )
      }, 5 * 60 * 1000)
    }
  }
}

async function handleItineraryPreference(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string; trip_id: string; pace_vote: string | null },
  trip: { id: string },
  _phone: string,
  body: string
) {
  if (!member.pace_vote) {
    // First answer = pace
    const paceMap: Record<string, VotePace> = { '1': 'easy_chill', '2': 'balanced_mix', '3': 'packed_schedule' }
    const pace = paceMap[body]
    if (pace) await db.from('members').update({ pace_vote: pace }).eq('id', member.id)
  } else {
    // Second answer = spend
    const spendMap: Record<string, string> = { '1': 'low', '2': 'mid', '3': 'high' }
    const spend = spendMap[body]
    if (spend) {
      await db.from('members').update({ spend_vote: spend }).eq('id', member.id)
      await checkItineraryPreferencesComplete(db, trip.id)
    }
  }
}

async function checkItineraryPreferencesComplete(
  db: ReturnType<typeof createServiceClient>,
  tripId: string
) {
  // Guard: only trigger if trip is still in preferences stage (prevents duplicate generation)
  const { data: currentTrip } = await db.from('trips').select('status').eq('id', tripId).single()
  if (currentTrip?.status !== 'itinerary_preferences') return

  const { data: members } = await db
    .from('members')
    .select('pace_vote, spend_vote, avatar')
    .eq('trip_id', tripId)
    .in('status', ['consented', 'avatar_selected', 'active'])

  if (!members || members.length === 0) return

  const submitted = members.filter(m => m.pace_vote && m.spend_vote)
  if (submitted.length / members.length >= 0.8) {
    // Atomically advance status — if this trip was already advanced by a concurrent call, the update won't match
    const { data: updated } = await db
      .from('trips')
      .update({ status: 'itinerary_vote' })
      .eq('id', tripId)
      .eq('status', 'itinerary_preferences') // conditional: only matches if still in this status
      .select('id')

    if (!updated || updated.length === 0) return // another concurrent request already advanced it

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/claude/itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId }),
    })
  }
}

async function handleItineraryVote(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string; trip_id: string },
  trip: { id: string },
  phone: string,
  body: string
) {
  // Check if this member is already in the vibe-selection flow
  const { data: existingVote } = await db
    .from('votes')
    .select('value')
    .eq('trip_id', trip.id)
    .eq('member_id', member.id)
    .eq('vote_type', 'itinerary')
    .single()

  if (existingVote?.value === 'dissent_vibe') {
    await handleVibeSelection(db, member, trip, phone, body)
    return
  }

  if (body === 'looks good' || body === 'yes' || body === '1' || body === '✅') {
    await db.from('votes').upsert({
      trip_id: trip.id,
      member_id: member.id,
      vote_type: 'itinerary',
      value: 'approved',
    }, { onConflict: 'trip_id,member_id,vote_type' })

    await checkItineraryApproval(db, trip.id)
  } else if (body === "something's off" || body === '2' || body === 'no' || body === '🤔') {
    // Use A/B/C to avoid colliding with the 1/2/3 approve flow on the next reply
    await sendWhatsApp(
      phone,
      `What's the issue?\n\n[A] Too expensive 💸\n[B] Wrong vibe 🎭\n[C] Bad timing ⏰\n\nReply A, B, or C`
    )
  } else if (body === 'a' || body === 'too expensive') {
    await sendWhatsApp(phone, `Got it — regenerating a tighter plan. Give us a moment.`)
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/claude/itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: trip.id, constraint: 'budget' }),
    })
  } else if (body === 'b' || body === 'wrong vibe') {
    // Record dissent_vibe state — this member's next reply is a vibe selection
    await db.from('votes').upsert({
      trip_id: trip.id,
      member_id: member.id,
      vote_type: 'itinerary',
      value: 'dissent_vibe',
    }, { onConflict: 'trip_id,member_id,vote_type' })
    await sendWhatsApp(
      phone,
      `What vibe do you want instead?\n\n[1] Chill & Eat 🍜\n[2] Mix it up 🎯\n[3] Full Send 🔥\n\nReply 1, 2, or 3`
    )
  } else if (body === 'c' || body === 'bad timing') {
    // Notify organizer to adjust specific day
    const { data: tripData } = await db.from('trips').select('organizer_id, members(id, phone)').eq('id', trip.id).single()
    const organizer = tripData?.members?.find((m: { id: string }) => m.id === tripData.organizer_id)
    if (organizer?.phone) {
      await sendWhatsApp(organizer.phone, `⚠️ One member flagged timing issues with the itinerary. Review → ${process.env.NEXT_PUBLIC_APP_URL}/organizer/${trip.id}`)
    }
    await sendWhatsApp(phone, `Flagged for the organiser — they'll review the timing and adjust.`)
  }
}

async function handleVibeSelection(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string; trip_id: string },
  trip: { id: string },
  phone: string,
  body: string
) {
  const paceMap: Record<string, VotePace> = {
    '1': 'easy_chill', 'chill': 'easy_chill',
    '2': 'balanced_mix', 'mix': 'balanced_mix',
    '3': 'packed_schedule', 'full': 'packed_schedule', 'send': 'packed_schedule',
  }
  const pace = paceMap[body]

  if (!pace) {
    await sendWhatsApp(phone, `Reply 1 for Chill & Eat, 2 for Mix it up, or 3 for Full Send.`)
    return
  }

  const paceLabel: Record<VotePace, string> = {
    easy_chill: 'Chill & Eat',
    balanced_mix: 'Balanced Mix',
    packed_schedule: 'Full Send',
  }

  await sendWhatsApp(phone, `Got it — regenerating with a *${paceLabel[pace]}* vibe. Give us a moment.`)

  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/claude/itinerary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId: trip.id, paceOverride: pace }),
  })
}

async function checkItineraryApproval(
  db: ReturnType<typeof createServiceClient>,
  tripId: string
) {
  const { data: votes } = await db.from('votes').select('value').eq('trip_id', tripId).eq('vote_type', 'itinerary')
  const { data: members } = await db.from('members').select('id').eq('trip_id', tripId).in('status', ['consented', 'active'])
  if (!votes || !members) return

  const approved = votes.filter(v => v.value === 'approved').length
  if (approved > members.length / 2) {
    await db.from('trips').update({ status: 'locked' }).eq('id', tripId)
    await generateAndSendMissionPacks(db, tripId)
  }
}

async function generateAndSendMissionPacks(
  db: ReturnType<typeof createServiceClient>,
  tripId: string
) {
  const { data: tripData } = await db
    .from('trips')
    .select('*, members(*)')
    .eq('id', tripId)
    .single()

  if (!tripData) return

  const departure = tripData.departure_date ? new Date(tripData.departure_date) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  for (const member of tripData.members ?? []) {
    if (!member.avatar || member.opt_out) continue

    const tasks = getTasksForAvatar(member.avatar as AvatarType, tripId, member.id, departure)

    await db.from('mission_tasks').insert(tasks)

    const taskCount = tasks.length
    await sendWhatsApp(
      member.phone,
      `*${tripData.name}* is locked ✅\n\nThis takes *${taskCount} tasks* off the organiser's plate — they're all yours now.\n\nYour first task: ${tasks[0]?.title}\nDue: ${tasks[0]?.deadline}\n\nSee all your tasks → ${process.env.NEXT_PUBLIC_APP_URL}/trip/${tripId}`
    )
  }
}

function getTasksForAvatar(
  avatar: AvatarType,
  tripId: string,
  memberId: string,
  departure: Date
) {
  const deadline = (daysBeforeDeparture: number) => {
    const d = new Date(departure)
    d.setDate(d.getDate() - daysBeforeDeparture)
    return d.toISOString().split('T')[0]
  }

  const taskMap: Record<AvatarType, { title: string; description: string; days: number; points: number }[]> = {
    planner: [
      { title: 'Finalise itinerary after group vote', description: 'Review the locked plan and make any final adjustments.', days: 10, points: 15 },
      { title: 'Collect dietary and medical needs', description: 'Ask the group for any dietary restrictions or medical needs before booking food.', days: 7, points: 8 },
      { title: 'Confirm all members have accommodation sorted', description: 'Check that everyone has made their hotel booking.', days: 5, points: 10 },
      { title: 'Share final trip summary to group', description: 'Send a summary of the full plan — itinerary, hotel, meetup details.', days: 2, points: 10 },
    ],
    navigator: [
      { title: 'Coordinate airport/station pickup for all members', description: 'Arrange shared transport from the arrival point to the hotel.', days: 7, points: 15 },
      { title: 'Confirm inter-city transport arrangements', description: 'Book or confirm any transport between cities during the trip.', days: 5, points: 12 },
      { title: 'Confirm Day 1 local transport plan', description: 'Make sure everyone knows how they\'re getting around on Day 1.', days: 1, points: 10 },
      { title: 'Share departure point + group meetup time', description: 'Send the final meetup details to the group.', days: 2, points: 10 },
    ],
    budgeteer: [
      { title: 'Remind all members to contribute to trip kitty', description: 'Send a reminder to all members to transfer their share.', days: 14, points: 15 },
      { title: 'Share accommodation cost breakdown', description: 'Calculate and share the per-person hotel cost with the group.', days: 7, points: 10 },
      { title: 'Share estimated per-person trip total', description: 'Give the group a final cost estimate covering hotel, transport, and activities.', days: 5, points: 8 },
    ],
    foodie: [
      { title: 'Collect dietary restrictions from group', description: 'Ask the group for any food allergies or preferences before shortlisting restaurants.', days: 10, points: 8 },
      { title: 'Shortlist 3 restaurant options per day', description: 'Find and share 3 restaurant options for each day of the trip.', days: 7, points: 12 },
      { title: 'Confirm dinner reservations for Day 1 + 2', description: 'Book or confirm dinner reservations for the first two nights.', days: 5, points: 15 },
    ],
    adventure_seeker: [
      { title: 'Research and share activity options', description: 'Find ticketed activities, permit requirements, and adventure options at the destination.', days: 10, points: 10 },
      { title: 'Confirm activity plans and share with group', description: 'Book or confirm the agreed activities and share details with everyone.', days: 7, points: 15 },
      { title: 'Share permit requirements and safety notes', description: 'Brief the group on any permits needed and key safety information.', days: 2, points: 8 },
    ],
    photographer: [
      { title: 'Research and share best photo spots', description: 'Find the top photo locations at the destination and share with the group.', days: 7, points: 10 },
      { title: 'Add golden hour windows to itinerary', description: 'Add sunrise and sunset times per day to the trip plan.', days: 5, points: 8 },
    ],
    spontaneous_one: [
      { title: 'Find and share 2 hidden gems at destination', description: 'Research and share 2 lesser-known spots the group wouldn\'t find on their own.', days: 5, points: 12 },
      { title: 'Prepare and share 1 backup plan per day', description: 'Have a backup activity or plan ready for each day in case plans change.', days: 3, points: 10 },
    ],
  }

  return (taskMap[avatar] ?? []).map(t => ({
    trip_id: tripId,
    member_id: memberId,
    avatar,
    title: t.title,
    description: t.description,
    deadline: deadline(t.days),
    points: t.points,
    status: 'pending',
    note: null,
    completed_at: null,
  }))
}

async function handleTaskDone(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string },
  phone: string
) {
  const { data: task } = await db
    .from('mission_tasks')
    .select('*')
    .eq('member_id', member.id)
    .eq('status', 'pending')
    .order('deadline', { ascending: true })
    .limit(1)
    .single()

  if (!task) return

  await db.from('mission_tasks').update({
    status: 'done',
    completed_at: new Date().toISOString(),
  }).eq('id', task.id)

  await db.rpc('increment_member_points', { mid: member.id, pts: task.points })

  await sendWhatsApp(
    phone,
    `✅ Marked as done! +${task.points} points\n\nAdd a note for the group? (e.g. pickup confirmed for 9am, meetup point — optional)\n\nJust reply with the note, or ignore this.`
  )
}

async function handleTaskReassign(
  db: ReturnType<typeof createServiceClient>,
  member: { id: string; trip_id: string },
  _trip: unknown,
  phone: string
) {
  const { data: task } = await db
    .from('mission_tasks')
    .select('*')
    .eq('member_id', member.id)
    .eq('status', 'pending')
    .order('deadline', { ascending: true })
    .limit(1)
    .single()

  if (!task) return

  await db.from('mission_tasks').update({ status: 'reassigned' }).eq('id', task.id)

  await sendWhatsApp(
    phone,
    `Task reassigned. The organiser has been notified and will reallocate it.`
  )

  // Notify organiser
  const { data: tripData } = await db
    .from('trips')
    .select('organizer_id, members(*)')
    .eq('id', member.trip_id)
    .single()

  const organizer = tripData?.members?.find((m: { id: string }) => m.id === tripData.organizer_id)
  if (organizer?.phone) {
    await sendWhatsApp(organizer.phone, `⚠️ ${task.title} has been reassigned. Tap to reallocate → ${process.env.NEXT_PUBLIC_APP_URL}/organizer/${member.trip_id}`)
  }
}
