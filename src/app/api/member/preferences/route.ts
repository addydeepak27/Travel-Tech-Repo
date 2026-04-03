import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { checkAndComputeBudgetZone, checkItineraryPreferencesComplete, deriveSpendVote } from '@/lib/trip-checks'
import { awardBrowniePoints } from '@/lib/brownie'
import type { BudgetTier } from '@/types'

const BUDGET_RANGE_LABEL: Record<BudgetTier, string> = {
  backpacker: '₹0–50k',
  comfortable: '₹50k–1L',
  premium: '₹1L–5L',
  luxury: '₹5L+',
}

// Midpoint daily spend per person (INR) — used for alignment & outlier detection
const BUDGET_VALUE_PER_DAY: Record<BudgetTier, number> = {
  backpacker: 2000,
  comfortable: 6000,
  premium: 17500,
  luxury: 50000,
}

export async function POST(req: NextRequest) {
  const { tripId, memberId, budget_tier, pace_vote, activity_pref, trip_priority, special_requests } = await req.json()

  if (!tripId || !memberId) {
    return NextResponse.json({ error: 'Missing tripId or memberId' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: member } = await db
    .from('members')
    .select('email, status, budget_tier')
    .eq('id', memberId)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Only award points on first submission (budget_tier was null before this)
  const isFirstSubmission = member.budget_tier === null

  const tier = budget_tier as BudgetTier
  await db.from('members').update({
    budget_tier: tier,
    budget_range: BUDGET_RANGE_LABEL[tier] ?? null,
    budget_value_per_day: BUDGET_VALUE_PER_DAY[tier] ?? null,
    pace_vote,
    spend_vote: deriveSpendVote(tier),
    activity_pref,
    trip_priority,
    special_requests: special_requests || null,
    status: 'active',
  }).eq('id', memberId)

  // points = total_users - response_rank + 1 (first responder gets most)
  if (isFirstSubmission && member.email) {
    await awardBrowniePoints(db, tripId, memberId, 'questionnaire_completed', member.email, 'share their vibe')
  }

  await checkAndComputeBudgetZone(db, tripId)
  await checkItineraryPreferencesComplete(db, tripId)

  return NextResponse.json({ ok: true })
}
