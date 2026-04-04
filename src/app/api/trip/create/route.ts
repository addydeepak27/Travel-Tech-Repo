import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'

function generateTravelCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function getUniqueTravelCode(db: ReturnType<typeof createServiceClient>): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateTravelCode()
    const { data } = await db.from('trips').select('id').eq('travel_code', code).single()
    if (!data) return code
  }
  return generateTravelCode()
}

export async function POST(req: NextRequest) {
  const {
    destinations,
    organizerName,
    organizerEmail,
    memberEmails,
    destinationMode,
    travelMonth,
    voteDeadline,
  } = await req.json()

  if (!destinations?.length || !organizerEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const travelCode = await getUniqueTravelCode(db)

  const organizerAvatar: AvatarType = 'planner'

  const isOrganizerPick = destinationMode === 'organizer_pick'

  const destinationOptionsValue = Array.isArray(destinations) ? destinations : [destinations]
  const destNames = destinationOptionsValue
    .map((d: { name?: string } | string) => (typeof d === 'object' ? d?.name : d))
    .filter((n): n is string => Boolean(n))
  const tripName = isOrganizerPick
    ? `${destNames[0]} or Bust`
    : destNames.length > 1
      ? `${destNames.slice(0, -1).join(', ')} or ${destNames[destNames.length - 1]}`
      : `${destNames[0]} Trip`

  const now = new Date()
  const questDeadline = new Date(now.getTime() + 2 * 3_600_000) // T+2h

  const { data: trip, error: tripError } = await db
    .from('trips')
    .insert({
      name: tripName,
      status: 'inviting',
      destination_options: destinationOptionsValue,
      confirmed_destination: isOrganizerPick ? (destinationOptionsValue[0]?.name ?? destinationOptionsValue[0]) : null,
      gamification_enabled: true,
      travel_code: travelCode,
      departure_date: travelMonth ? `${travelMonth}-01` : null,
      return_date: null,
      vote_deadline: voteDeadline ? new Date(voteDeadline).toISOString() : null,
      status_updated_at: now.toISOString(),
      questionnaire_started_at: now.toISOString(),
      questionnaire_deadline_at: questDeadline.toISOString(),
    })
    .select()
    .single()

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 })
  }

  const { data: organizer } = await db
    .from('members')
    .insert({
      trip_id: trip.id,
      phone: '',
      name: organizerName ?? 'Organiser',
      email: organizerEmail,
      avatar: organizerAvatar,
      status: 'active',
      points: 0,
      brownie_points: 0,
      opt_out: false,
      joined_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (!organizer) {
    return NextResponse.json({ error: 'Failed to create organiser' }, { status: 500 })
  }

  await db.from('trips').update({ organizer_id: organizer.id }).eq('id', trip.id)

  const rawEmails: string[] = (memberEmails ?? []).filter((e: string) => e.includes('@'))
  const memberRows = rawEmails.map(email => ({
    trip_id: trip.id,
    phone: '',
    email,
    status: 'invited',
    points: 0,
    brownie_points: 0,
    opt_out: false,
  }))

  if (memberRows.length > 0) {
    await db.from('members').insert(memberRows)
  }

  const { data: allMembers } = await db
    .from('members')
    .select('id, email, status')
    .eq('trip_id', trip.id)

  const allAvatars = Object.keys(AVATAR_META) as AvatarType[]
  const neededRoles = allAvatars
    .filter(a => a !== 'planner')
    .slice(0, 3)
    .map(a => AVATAR_META[a].label)
    .join(', ')

  const joinUrl = `${appUrl}/join/${trip.id}`

  for (const m of allMembers?.filter(m => m.status === 'invited') ?? []) {
    if (!m.email) continue
    const personalLink = `${appUrl}/join/${trip.id}?m=${m.id}`
    await sendEmail(
      m.email,
      `${organizerName ?? 'Someone'} is planning ${tripName} and YOU made the cut ✈️`,
      `Hey!\n\n${organizerName ?? 'Your friend'} spent way too long on a spreadsheet planning ${tripName} — and you're on the invite list. Congrats.\n\nBefore you ghost this email: there are roles. Real ones. The Foodie finds the restaurants. The Navigator keeps everyone from getting lost. The Budgeteer stops the group from going broke on day 2.\n\n👉 Your personal link (1 tap, no sign-up): ${personalLink}\n\nDon't be the one friend who finds out from someone else's Instagram story 😬\n\nRoles filling up: ${neededRoles}\n\nTravel code if you lose this email: ${travelCode}\n\n— The Toh Chale squad bot (${organizerName ?? 'your organizer'} made us send this)`
    )
  }

  const dashboardUrl = `${appUrl}/organizer/${trip.id}`
  await sendEmail(
    organizerEmail,
    `🎉 ${tripName} is live — invites sent!`,
    `Your trip is live and the invites are out!\n\nHere's what you need:\n📋 Organizer dashboard → ${dashboardUrl}\n🔗 Generic invite link → ${joinUrl}\n🔑 Travel code → ${travelCode}\n\nWhat to do next:\n→ Share your invite link with anyone you missed\n→ Nudge anyone who hasn't joined from your dashboard\n→ Fill in your own preferences so the AI can build the plan\n\nPS: The AI can't do anything until at least 2 people fill their preferences. Hint hint 😅`
  )

  return NextResponse.json({
    tripId: trip.id,
    tripName,
    travelCode,
    dashboardUrl,
    inviteLink: joinUrl,
    organizerId: organizer.id,
  })
}
