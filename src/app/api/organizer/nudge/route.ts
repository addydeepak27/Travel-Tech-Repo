import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendWhatsApp } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  const { tripId, memberId, organizerId, nudgeType } = await req.json()
  if (!tripId || !memberId || !organizerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify organizer
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
    .select('phone, status, avatar, opt_out')
    .eq('id', memberId)
    .single()

  if (!member || member.opt_out) {
    return NextResponse.json({ error: 'Member not found or opted out' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  let message = ''

  switch (nudgeType ?? member.status) {
    case 'invited':
      message = `Hey — *${trip.name}* is waiting on you. 1 tap to join:\n${appUrl}/join/${tripId}?m=${memberId}\n\n[I'm In 🙌] Reply YES  |  [Can't make it] Reply NO`
      break
    case 'consented':
      message = `*${trip.name}*: You said yes but haven't picked your role yet — roles are filling fast.\nPick yours → ${appUrl}/avatar/${tripId}/${memberId}\n\n_(24h before auto-assign)_`
      break
    case 'avatar_selected':
      message = `*${trip.name}*: One quick thing before we can build the plan — what's your budget per person?\n\n[1] Backpacker <₹5k  [2] Comfortable ₹5–10k  [3] Premium ₹10–20k  [4] Luxury ₹20k+\n\nReply 1, 2, 3, or 4`
      break
    default:
      message = `*${trip.name}* is waiting for your input. Tap to view → ${appUrl}/trip/${tripId}`
  }

  await sendWhatsApp(member.phone, message)

  return NextResponse.json({ ok: true })
}
