import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { memberId, avatar } = await req.json()
  if (!memberId || !avatar) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const db = createServiceClient()

  // Update avatar + status
  const { data: member, error } = await db
    .from('members')
    .update({ avatar, status: 'avatar_selected' })
    .eq('id', memberId)
    .select('trip_id, brownie_points')
    .single()

  if (error || !member) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 500 })

  const tripId = member.trip_id

  // Check if this event already awarded for this member (idempotent)
  const { data: existing } = await db
    .from('brownie_events')
    .select('id')
    .eq('trip_id', tripId)
    .eq('member_id', memberId)
    .eq('event_type', 'avatar_selected')
    .maybeSingle()

  if (!existing) {
    // Rank = how many have already earned this event
    const { count: priorCount } = await db
      .from('brownie_events')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .eq('event_type', 'avatar_selected')

    const { count: squadSize } = await db
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .not('status', 'in', '("declined","dropped")')

    const rank = (priorCount ?? 0) + 1
    const total = squadSize ?? 1
    const pts = Math.max(1, total - (rank - 1))

    await db.from('brownie_events').insert({
      trip_id: tripId, member_id: memberId,
      event_type: 'avatar_selected', points_earned: pts, rank,
    })

    await db.from('members')
      .update({ brownie_points: (member.brownie_points ?? 0) + pts })
      .eq('id', memberId)
  }

  return NextResponse.json({ ok: true })
}
