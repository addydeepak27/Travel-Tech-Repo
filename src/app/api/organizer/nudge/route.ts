import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { tripId, memberId, organizerId, nudgeType } = await req.json()
  if (!tripId || !memberId || !organizerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: trip } = await db
    .from('trips')
    .select('name, organizer_id, status')
    .eq('id', tripId)
    .single()

  if (!trip || trip.organizer_id !== organizerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: member } = await db
    .from('members')
    .select('email, status, avatar, opt_out')
    .eq('id', memberId)
    .single()

  if (!member || member.opt_out || !member.email) {
    return NextResponse.json({ error: 'Member not found or opted out' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  let subject = ''
  let message = ''

  switch (nudgeType ?? member.status) {
    case 'invited':
      subject = `${trip.name} is waiting on you — 1 tap to join`
      message = `${trip.name} is waiting on you.\n\nJoin here → ${appUrl}/join/${tripId}?m=${memberId}`
      break
    case 'consented':
      subject = `${trip.name}: Roles are filling fast — pick yours`
      message = `${trip.name}: You said yes but haven't picked your role yet — roles are filling fast.\n\nPick yours → ${appUrl}/avatar/${tripId}/${memberId}\n\n(24h before auto-assign)`
      break
    case 'avatar_selected':
      subject = `${trip.name}: Quick question before we can build the plan`
      message = `${trip.name}: One quick thing before we can build the plan — what's your budget per person?\n\nSet your budget → ${appUrl}/preferences/${tripId}/${memberId}`
      break
    default:
      subject = `${trip.name} needs your input`
      message = `${trip.name} is waiting for your input. Tap to view → ${appUrl}/trip/${tripId}`
  }

  await sendEmail(member.email, subject, message)

  // Record that the organizer took an action (resets inactivity clock)
  await db.from('members').update({ last_active_at: new Date().toISOString() }).eq('id', organizerId)

  return NextResponse.json({ ok: true })
}
