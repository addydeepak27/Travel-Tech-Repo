import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { awardBrowniePoints } from '@/lib/brownie'

export async function POST(req: NextRequest) {
  const { tripId, memberId, voteType, value } = await req.json()
  if (!tripId || !memberId || !voteType || !value) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()

  // Enforce vote_deadline server-side
  const { data: trip } = await db.from('trips').select('vote_deadline, status').eq('id', tripId).single()
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  if (trip.vote_deadline && new Date(trip.vote_deadline) < new Date()) {
    return NextResponse.json({ error: 'Voting has closed — the deadline has passed.' }, { status: 403 })
  }

  const { data: member } = await db
    .from('members')
    .select('email, status')
    .eq('id', memberId)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Upsert — one vote per member per vote type
  const { error } = await db.from('votes').upsert(
    { trip_id: tripId, member_id: memberId, vote_type: voteType, value },
    { onConflict: 'trip_id,member_id,vote_type' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Award brownie points for first-time vote on this type
  if (member.email) {
    const eventType = `${voteType}_voted`
    await awardBrowniePoints(db, tripId, memberId, eventType, member.email, `vote on ${voteType}`)
  }

  return NextResponse.json({ ok: true })
}
