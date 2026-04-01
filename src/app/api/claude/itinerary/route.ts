import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateItinerary } from '@/lib/claude'
import { sendWhatsApp } from '@/lib/twilio'
import type { AvatarType, BudgetTier, Hotel, VotePace } from '@/types'

export async function POST(req: NextRequest) {
  const { tripId, constraint } = await req.json()
  if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

  const db = createServiceClient()

  const { data: trip } = await db
    .from('trips')
    .select('name, confirmed_destination, confirmed_hotel, weighted_median_tier, departure_date, return_date, members(id, avatar, budget_tier, status, pace_vote, spend_vote, phone)')
    .eq('id', tripId)
    .single()

  if (!trip?.confirmed_destination || !trip?.confirmed_hotel) {
    return NextResponse.json({ error: 'Missing destination or hotel' }, { status: 400 })
  }

  const budgetTier = (trip.weighted_median_tier as BudgetTier) ?? 'comfortable'
  const hotel = trip.confirmed_hotel as Hotel
  const activeMembers = (trip.members ?? []).filter((m: { status: string }) =>
    ['consented', 'active'].includes(m.status)
  )

  const avatarDistribution: Record<AvatarType, number> = {
    planner: 0, navigator: 0, budgeteer: 0, foodie: 0,
    adventure_seeker: 0, photographer: 0, spontaneous_one: 0,
  }
  const paceDistribution: Record<VotePace, number> = {
    easy_chill: 0, balanced_mix: 0, packed_schedule: 0,
  }

  for (const m of activeMembers) {
    if (m.avatar) avatarDistribution[m.avatar as AvatarType]++
    if (m.pace_vote) paceDistribution[m.pace_vote as VotePace]++
  }

  const departure = trip.departure_date ? new Date(trip.departure_date) : null
  const returnDate = trip.return_date ? new Date(trip.return_date) : null
  const tripDurationDays = departure && returnDate
    ? Math.ceil((returnDate.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24))
    : 3

  // Override budget tier if constraint requested
  const effectiveTier: BudgetTier = constraint === 'budget' ? 'backpacker' : budgetTier

  const { itinerary, for_you } = await generateItinerary(
    trip.confirmed_destination,
    hotel,
    avatarDistribution,
    effectiveTier,
    paceDistribution,
    tripDurationDays,
    activeMembers.map((m: { id: string; avatar: AvatarType | null; budget_tier: BudgetTier | null; spend_vote: string | null }) => ({
      id: m.id,
      avatar: m.avatar,
      budget_tier: m.budget_tier,
      spend_vote: (m.spend_vote as 'low' | 'mid' | 'high' | null),
    })),
    tripId
  )

  // Remove the now-redundant trip_id override since generateItinerary sets it correctly

  // Save itinerary on trip
  await db.from('trips').update({
    itinerary,
    status: 'itinerary_vote',
  }).eq('id', tripId)

  // Save per-member For You callouts (trip_id already set by generateItinerary)
  if (for_you.length > 0) {
    await db.from('for_you_callouts').upsert(for_you, { onConflict: 'member_id,trip_id,day' })
  }

  // Send itinerary to all members
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const itineraryLink = `${appUrl}/itinerary/${tripId}`

  for (const m of activeMembers) {
    if (m.phone) {
      await sendWhatsApp(
        m.phone,
        `Here's your *${trip.confirmed_destination}* plan 👇\n${itineraryLink}\n\n[1] Looks good ✅\n[2] Something's off 🤔\n\nReply 1 to approve, 2 to flag an issue.`
      )
    }
  }

  return NextResponse.json({ ok: true, days: itinerary.length })
}
