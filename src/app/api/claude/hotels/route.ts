import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateHotels } from '@/lib/claude'
import { sendEmail } from '@/lib/email'
import type { AvatarType, BudgetTier } from '@/types'

export async function POST(req: NextRequest) {
  const { tripId } = await req.json()
  if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

  const db = createServiceClient()

  const { data: trip } = await db
    .from('trips')
    .select('name, confirmed_destination, weighted_median_tier, departure_date, return_date, members(id, avatar, status, email)')
    .eq('id', tripId)
    .single()

  if (!trip?.confirmed_destination) {
    return NextResponse.json({ error: 'No confirmed destination' }, { status: 400 })
  }

  const budgetTier = (trip.weighted_median_tier as BudgetTier) ?? 'comfortable'
  const activeMembers = (trip.members ?? []).filter((m: { status: string }) =>
    ['consented', 'active'].includes(m.status)
  )

  const avatarDistribution: Record<AvatarType, number> = {
    planner: 0, navigator: 0, budgeteer: 0, foodie: 0,
    adventure_seeker: 0, photographer: 0, spontaneous_one: 0,
  }
  for (const m of activeMembers) {
    if (m.avatar) avatarDistribution[m.avatar as AvatarType]++
  }

  const departure = trip.departure_date ? new Date(trip.departure_date) : null
  const returnDate = trip.return_date ? new Date(trip.return_date) : null
  const tripDurationDays = departure && returnDate
    ? Math.ceil((returnDate.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24))
    : 3

  const hotels = await generateHotels(
    trip.confirmed_destination,
    avatarDistribution,
    budgetTier,
    activeMembers.length,
    tripDurationDays
  )

  // Try to generate static map URLs for each hotel (best effort)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const hotelsWithMaps = hotels.map(h => {
    if (h.lat && h.lng) {
      h.map_image_url = `${appUrl}/api/maps/hotel-card?lat=${h.lat}&lng=${h.lng}&name=${encodeURIComponent(h.name)}`
    }
    return h
  })

  await db.from('trips').update({ hotel_options: hotelsWithMaps }).eq('id', tripId)

  // Notify all members + send vote
  const hotelLink = `${appUrl}/hotels/${tripId}`
  const voteOptions = hotelsWithMaps
    .map((h, i) => `[${i + 1}] ${h.name} · ₹${h.total_per_person.toLocaleString('en-IN')}/person`)
    .join('\n')

  for (const m of activeMembers) {
    if (!m.email) continue
    await sendEmail(
      m.email,
      `3 hotels shortlisted for ${trip.confirmed_destination}`,
      `3 hotels shortlisted for ${trip.confirmed_destination} within your group budget.\n\nSee details + vote → ${hotelLink}\n\nOptions:\n${voteOptions}`
    )
  }

  return NextResponse.json({ ok: true, hotels: hotelsWithMaps })
}
