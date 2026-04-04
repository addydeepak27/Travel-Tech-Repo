import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { memberId, avatar, name } = await req.json()
  if (!memberId || !avatar) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const db = createServiceClient()

  // 1. Get member's trip_id and current brownie_points
  const { data: member, error: memberError } = await db
    .from('members')
    .select('trip_id, brownie_points')
    .eq('id', memberId)
    .single()

  if (memberError || !member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const tripId = member.trip_id

  // 2. Check avatar availability — block duplicates only until all 6 non-planner roles are claimed
  const NON_PLANNER_ROLES = ['navigator', 'budgeteer', 'foodie', 'adventure_seeker', 'photographer', 'spontaneous_one']
  const { data: allAvatars } = await db
    .from('members')
    .select('avatar')
    .eq('trip_id', tripId)
    .not('avatar', 'is', null)
    .neq('avatar', 'planner')
    .neq('id', memberId)

  const claimedRoles = new Set((allAvatars ?? []).map((m: { avatar: string }) => m.avatar))
  const allRolesClaimed = NON_PLANNER_ROLES.every(r => claimedRoles.has(r))

  if (!allRolesClaimed && claimedRoles.has(avatar)) {
    return NextResponse.json({ error: 'avatar_taken' }, { status: 409 })
  }

  // 3. Update avatar + status + name (if provided)
  const updateFields: Record<string, unknown> = { avatar, status: 'avatar_selected' }
  if (name?.trim()) updateFields.name = name.trim()

  const { error: updateError } = await db
    .from('members')
    .update(updateFields)
    .eq('id', memberId)

  if (updateError) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  // 4. Award brownie points (idempotent)
  const { data: existing } = await db
    .from('brownie_events')
    .select('id')
    .eq('trip_id', tripId)
    .eq('member_id', memberId)
    .eq('event_type', 'avatar_selected')
    .maybeSingle()

  if (!existing) {
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
