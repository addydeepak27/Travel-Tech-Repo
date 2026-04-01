import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { checkAndComputeBudgetZone, checkItineraryPreferencesComplete, deriveSpendVote } from '@/lib/trip-checks'
import { awardBrowniePoints } from '@/lib/brownie'
import type { BudgetTier } from '@/types'

export async function POST(req: NextRequest) {
  const { tripId, memberId, budget_tier, pace_vote, activity_pref, trip_priority, special_requests } = await req.json()

  if (!tripId || !memberId) {
    return NextResponse.json({ error: 'Missing tripId or memberId' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: member } = await db
    .from('members')
    .select('phone, status, brownie_points')
    .eq('id', memberId)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  await db.from('members').update({
    budget_tier: budget_tier as BudgetTier,
    pace_vote,
    spend_vote: deriveSpendVote(budget_tier as BudgetTier),
    activity_pref,
    trip_priority,
    special_requests: special_requests || null,
    status: 'active',
  }).eq('id', memberId)

  if (member.phone) {
    await awardBrowniePoints(db, tripId, memberId, 'questionnaire_completed', member.phone, 'share their vibe')
  }

  await checkAndComputeBudgetZone(db, tripId)
  await checkItineraryPreferencesComplete(db, tripId)

  return NextResponse.json({ ok: true })
}
