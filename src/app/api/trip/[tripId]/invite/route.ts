import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const { email, organizerId } = await req.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const db = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const { data: trip } = await db
    .from('trips')
    .select('id, name, organizer_id, status, destination_options')
    .eq('id', tripId)
    .single()

  if (!trip || trip.status === 'cancelled') {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  if (trip.organizer_id !== organizerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const normalized = email.toLowerCase().trim()

  // Check if already a member
  const { data: existing } = await db
    .from('members')
    .select('id, status, name')
    .eq('trip_id', tripId)
    .eq('email', normalized)
    .single()

  if (existing) {
    if (existing.status === 'declined') {
      return NextResponse.json({ error: 'This person declined the trip.' }, { status: 409 })
    }
    // Already invited — resend invite
    const personalLink = `${appUrl}/join/${tripId}?m=${existing.id}`
    const { data: organizer } = await db.from('members').select('name').eq('id', organizerId).single()
    const orgName = organizer?.name ?? 'Your organizer'
    await sendEmail(
      normalized,
      `${orgName} is nudging you again — ${trip.name} is waiting 👀`,
      `Okay so you missed the first invite. No judgment.\n\n${orgName} is clearly very persistent (and slightly desperate 😅).\n\n${trip.name} needs you. The squad is waiting. Your role is still unclaimed.\n\n👉 Join here → ${personalLink}\n\nSeriously takes 30 seconds. ${orgName} will stop sending these if you just tap the link.`
    )
    return NextResponse.json({ memberId: existing.id, resent: true })
  }

  // Create new member
  const { data: newMember } = await db
    .from('members')
    .insert({
      trip_id: tripId,
      phone: '',
      email: normalized,
      status: 'invited',
      points: 0,
      brownie_points: 0,
      opt_out: false,
    })
    .select('id')
    .single()

  if (!newMember) {
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }

  const personalLink = `${appUrl}/join/${tripId}?m=${newMember.id}`
  const { data: organizer } = await db.from('members').select('name').eq('id', organizerId).single()
  const orgName = organizer?.name ?? 'Someone'

  const destOptions = Array.isArray(trip.destination_options) ? trip.destination_options : []
  const destNames = destOptions
    .map((d: { name?: string } | string) => (typeof d === 'object' ? d?.name : d))
    .filter(Boolean)
    .join(', ')

  await sendEmail(
    normalized,
    `${orgName} added you to ${trip.name} — don't be the last to join ✈️`,
    `Hey!\n\n${orgName} just added you to ${trip.name}${destNames ? ` (we're talking ${destNames})` : ''}.\n\nHere's the thing — brownie points go to whoever joins first. The squad is already moving. Your role is sitting there unclaimed.\n\n👉 Join now → ${personalLink}\n\nTakes 30 seconds. No app. No sign-up. Just tap.\n\nDon't be the one who finds out from someone else's Instagram story 😬`
  )

  return NextResponse.json({ memberId: newMember.id, sent: true })
}
