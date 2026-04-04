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

  // Fetch organizer name for the jokes
  const { data: organizerMember } = await db
    .from('members')
    .select('name')
    .eq('id', organizerId)
    .single()
  const orgName = organizerMember?.name ?? 'your organizer'

  switch (nudgeType ?? member.status) {
    case 'invited':
      subject = `${orgName} is personally offended you haven't joined ${trip.name} yet 😤`
      message = `Okay not *personally* offended. But ${orgName} did spend 20 minutes picking destinations, so... the least you could do is tap a button 😅\n\nJoin ${trip.name} → ${appUrl}/join/${tripId}?m=${memberId}\n\nTakes 30 seconds. ${orgName} will sleep better tonight.`
      break
    case 'consented':
      subject = `You said yes to ${trip.name} — now pick a role before ${orgName} panics`
      message = `Good news: you're in! Bad news: ${orgName} is stress-checking the app every 10 minutes waiting for you to pick a role 😭\n\nTakes 5 seconds. Pick yours → ${appUrl}/avatar/${tripId}/${memberId}\n\n(${orgName} will relax. Probably.)`
      break
    case 'avatar_selected':
      subject = `${trip.name} is almost ready to plan — just needs your budget 💸`
      message = `${orgName} has been staring at an incomplete budget chart for way too long.\n\nJust 4 questions and the AI can build the full plan.\n\nFill it in → ${appUrl}/preferences/${tripId}/${memberId}\n\nSeriously, ${orgName} will buy you a drink on the trip if you do this now.`
      break
    default:
      subject = `${trip.name} needs you — ${orgName} said please 🙏`
      message = `${orgName} is too polite to say it, so we will: the trip can't move forward without your input.\n\nTake a look → ${appUrl}/trip/${tripId}`
  }

  await sendEmail(member.email, subject, message)

  // Record that the organizer took an action (resets inactivity clock)
  await db.from('members').update({ last_active_at: new Date().toISOString() }).eq('id', organizerId)

  return NextResponse.json({ ok: true })
}
