import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/twilio'
import { BUDGET_TIER_META } from '@/types'
import type { BudgetTier } from '@/types'
import { ACTIVE_MEMBER_STATUSES } from '@/lib/constants'

export async function checkAndComputeBudgetZone(
  db: SupabaseClient,
  tripId: string
): Promise<void> {
  const { data: trip } = await db
    .from('trips')
    .select('id, name, status, confirmed_destination, organizer_id, departure_date, members(id, budget_tier, status, opt_out, phone, avatar)')
    .eq('id', tripId)
    .single()

  if (!trip) return
  if (!['inviting', 'budget_collection', 'avatar_collection'].includes(trip.status)) return

  const activeMembers = (trip.members ?? []).filter((m: { status: string }) =>
    ACTIVE_MEMBER_STATUSES.includes(m.status as never)
  )
  const withBudget = activeMembers.filter((m: { budget_tier: string | null }) => m.budget_tier)
  const totalActive = activeMembers.length

  const revealThreshold = Math.max(5, Math.ceil(totalActive * 0.8))
  if (withBudget.length < revealThreshold && withBudget.length < totalActive) return

  const tierOrder: BudgetTier[] = ['backpacker', 'comfortable', 'premium', 'luxury']
  const tiers = withBudget.map((m: { budget_tier: string }) => m.budget_tier as BudgetTier)
  const sorted = [...tiers].sort((a, b) => tierOrder.indexOf(a) - tierOrder.indexOf(b))
  const medianTier = sorted[Math.floor(sorted.length / 2)]

  const tierMeta = BUDGET_TIER_META[medianTier]
  const rangeParts = tierMeta.range.replace(/[₹,+<]/g, '').trim().split('–')
  const minBudget = parseInt(rangeParts[0]) || 5000
  const maxBudget = rangeParts[1] ? parseInt(rangeParts[1]) : minBudget * 2

  await db.from('trips').update({
    group_budget_zone: { min: minBudget, max: maxBudget },
    weighted_median_tier: medianTier,
    status_updated_at: new Date().toISOString(),
  }).eq('id', tripId)

  const tierIndices = tiers.map(t => tierOrder.indexOf(t))
  const spread = Math.max(...tierIndices) - Math.min(...tierIndices)
  if (spread >= 2) {
    const organiser = (trip.members ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
    if (organiser?.phone) {
      await sendWhatsApp(organiser.phone,
        `⚠️ *Budget heads-up (private):* Your group has a wide budget gap — some members are on a tight budget while others are comfortable spending more.\n\nThe itinerary will be built for the majority. Some members may find certain activities a stretch.\n\n_This message is only visible to you._`
      )
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (trip.confirmed_destination) {
    await db.from('trips').update({
      status: 'hotel_vote',
      status_updated_at: new Date().toISOString(),
    }).eq('id', tripId)

    await fetch(`${appUrl}/api/claude/hotels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId }),
    })
  } else {
    const destinations = await fetch(`${appUrl}/api/claude/destinations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId }),
    })
    if (!destinations.ok) return

    await db.from('trips').update({
      status: 'destination_vote_pending',
      destination_vote_scheduled_at: new Date(Date.now() + 2 * 3600000).toISOString(),
      status_updated_at: new Date().toISOString(),
    }).eq('id', tripId)

    const organiser = (trip.members ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
    if (organiser?.phone) {
      await sendWhatsApp(organiser.phone,
        `All budgets in! Group zone: ₹${minBudget.toLocaleString('en-IN')}–₹${maxBudget.toLocaleString('en-IN')}/person.\n\n3 destination options are ready. The vote sends to the group in 2h.\n\nReply *sendnow* to send immediately, or *changeoptions* to adjust.\n\nView options → ${appUrl}/organizer/${tripId}`
      )
    }
  }
}

export function deriveSpendVote(tier: BudgetTier): 'low' | 'mid' | 'high' {
  if (tier === 'backpacker') return 'low'
  if (tier === 'comfortable') return 'mid'
  return 'high'
}

export async function checkItineraryPreferencesComplete(
  db: SupabaseClient,
  tripId: string
): Promise<void> {
  const { data: trip } = await db
    .from('trips')
    .select('id, name, status, confirmed_destination, confirmed_hotel, members(id, pace_vote, spend_vote, status, opt_out)')
    .eq('id', tripId)
    .single()

  if (!trip) return
  if (trip.status !== 'itinerary_preferences') return

  const activeMembers = (trip.members ?? []).filter((m: { status: string }) =>
    ACTIVE_MEMBER_STATUSES.includes(m.status as never)
  )
  const withPrefs = activeMembers.filter((m: { pace_vote: string | null }) => m.pace_vote)
  const threshold = Math.ceil(activeMembers.length * 0.8)

  if (withPrefs.length < threshold) return

  await db.from('trips').update({
    status: 'itinerary_vote',
    status_updated_at: new Date().toISOString(),
  }).eq('id', tripId)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  await fetch(`${appUrl}/api/claude/itinerary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId }),
  })
}
