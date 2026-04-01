import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendWhatsApp, formatPhone } from '@/lib/twilio'
import { AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'

export async function POST(req: NextRequest) {
  const { destinations, organizerAvatar, organizerPhone, organizerName, memberPhones } = await req.json()

  if (!destinations?.length || !organizerAvatar || !organizerPhone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // Create the trip
  const tripName = `${destinations[0]} or Bust`
  const { data: trip, error: tripError } = await db
    .from('trips')
    .insert({
      name: tripName,
      status: 'inviting',
      destination_options: destinations,
      gamification_enabled: true,
    })
    .select()
    .single()

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 })
  }

  // Create organizer as first member
  const orgPhone = formatPhone(organizerPhone)
  const { data: organizer } = await db
    .from('members')
    .insert({
      trip_id: trip.id,
      phone: orgPhone,
      name: organizerName ?? 'Organiser',
      avatar: organizerAvatar,
      status: 'active',
      points: 0,
      opt_out: false,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (!organizer) {
    return NextResponse.json({ error: 'Failed to create organiser' }, { status: 500 })
  }

  // Set organizer_id on trip
  await db.from('trips').update({ organizer_id: organizer.id }).eq('id', trip.id)

  // Create invited members
  const memberRows = (memberPhones as string[]).map(phone => ({
    trip_id: trip.id,
    phone: formatPhone(phone),
    status: 'invited',
    points: 0,
    opt_out: false,
  }))

  if (memberRows.length > 0) {
    await db.from('members').insert(memberRows)
  }

  // Fetch all members to show roles needed
  const { data: allMembers } = await db
    .from('members')
    .select('id, phone, status')
    .eq('trip_id', trip.id)

  const allAvatars = Object.keys(AVATAR_META) as AvatarType[]
  const neededRoles = allAvatars
    .filter(a => a !== organizerAvatar)
    .slice(0, 3)
    .map(a => AVATAR_META[a].label)
    .join(', ')

  const orgAvatarLabel = AVATAR_META[organizerAvatar as AvatarType].label
  const inviteLink = `${appUrl}/join/${trip.id}`

  // Send personalised invites (each member gets a link with their ID)
  for (const m of allMembers?.filter(m => m.status === 'invited') ?? []) {
    const personalLink = `${appUrl}/join/${trip.id}?m=${m.id}`
    const message = `*${orgAvatarLabel}* is organising *${tripName}* 🌊\n\n📍 Destinations: ${destinations.join(', ')}\n👥 ${memberPhones.length + 1} people invited\n🎭 Roles still needed: ${neededRoles}\n_(each role owns part of the planning)_\n\nJoin → ${personalLink}\n\n[I'm In 🙌] Reply YES\n[Can't Make It] Reply NO\n\n_Reply STOP anytime to opt out of messages._`
    await sendWhatsApp(m.phone, message)
  }

  // Confirm to organizer
  const dashboardUrl = `${appUrl}/organizer/${trip.id}`
  await sendWhatsApp(
    orgPhone,
    `✅ *${tripName}* is live! Invites sent to ${memberPhones.length} people.\n\nMonitor your trip → ${dashboardUrl}`
  )

  return NextResponse.json({
    tripId: trip.id,
    tripName,
    dashboardUrl,
    inviteLink,
    organizerId: organizer.id,
  })
}
