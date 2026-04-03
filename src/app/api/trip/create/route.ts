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
  const destNames = destinationOptionsValue.map((d: { name?: string } | string) => (typeof d === 'object' ? d?.name : d) ?? d)
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
      `${organizerName ?? 'Someone'} is planning ${tripName} — you're invited 🌊`,
      `${organizerName ?? 'The Planner'} is organising ${tripName} 🌊\n\nDon't be the one friend who finds out about this trip from their Instagram stories 😬\n\nRoles needed: ${neededRoles}\n(each role owns part of the planning)\n\nJoin here → ${personalLink}\n\nOr enter code ${travelCode} at ${appUrl}\n\nReply to this email to decline.`
    )
  }

  const dashboardUrl = `${appUrl}/organizer/${trip.id}`
  await sendEmail(
    organizerEmail,
    `✅ ${tripName} is live! Travel code: ${travelCode}`,
    `Your trip is live!\n\nTravel code: ${travelCode}\nShare this to invite anyone: ${joinUrl}\n\nMonitor your trip → ${dashboardUrl}`
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
