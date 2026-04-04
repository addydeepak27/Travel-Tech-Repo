import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const { memberId, choice } = await req.json() // choice: 'in' | 'out'
  if (!memberId || !choice) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const db = createServiceClient()

  // Fetch current status to guard against regression
  const { data: current } = await db
    .from('members')
    .select('status, brownie_points')
    .eq('id', memberId)
    .eq('trip_id', tripId)
    .single()

  if (!current) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const ACTIVE_STATUSES = ['consented', 'avatar_selected', 'avatar_selection', 'pref_q1', 'pref_q2', 'pref_q3', 'pref_q4', 'budget_submitted', 'active']

  if (choice === 'out') {
    // Don't regress active/further-along members back to declined
    if (ACTIVE_STATUSES.includes(current.status)) {
      return NextResponse.json({ error: 'Cannot decline after progressing' }, { status: 400 })
    }
    await db.from('members').update({ status: 'declined' }).eq('id', memberId).eq('trip_id', tripId)
    return NextResponse.json({ ok: true })
  }

  // choice === 'in' — idempotent if already consented or further
  if (ACTIVE_STATUSES.includes(current.status)) {
    return NextResponse.json({ ok: true }) // already in, no-op
  }

  const { data: member, error } = await db
    .from('members')
    .update({ status: 'consented', joined_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('trip_id', tripId)
    .select('brownie_points')
    .single()

  if (error || !member) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 500 })

  // Award brownie points for accepting invite (idempotent)
  const { data: existing } = await db
    .from('brownie_events')
    .select('id')
    .eq('trip_id', tripId)
    .eq('member_id', memberId)
    .eq('event_type', 'trip_accepted')
    .maybeSingle()

  if (!existing) {
    const { count: priorCount } = await db
      .from('brownie_events')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .eq('event_type', 'trip_accepted')

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
      event_type: 'trip_accepted', points_earned: pts, rank,
    })

    await db.from('members')
      .update({ brownie_points: (member.brownie_points ?? 0) + pts })
      .eq('id', memberId)
  }

  return NextResponse.json({ ok: true })
}
