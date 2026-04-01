import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateDestinations } from '@/lib/claude'
import { sendWhatsApp } from '@/lib/twilio'
import { AVATAR_META } from '@/types'
import type { AvatarType, BudgetTier } from '@/types'

export async function POST(req: NextRequest) {
  const { tripId } = await req.json()
  if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

  const db = createServiceClient()

  const { data: trip } = await db
    .from('trips')
    .select('name, weighted_median_tier, departure_date, return_date, members(avatar, status)')
    .eq('id', tripId)
    .single()

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const budgetTier = (trip.weighted_median_tier as BudgetTier) ?? 'comfortable'

  // Build avatar distribution
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

  const destinations = await generateDestinations(avatarDistribution, budgetTier, tripDurationDays)
  const destinationNames = destinations.map(d => d.name)

  await db.from('trips').update({ destination_options: destinationNames }).eq('id', tripId)

  // Send destination vote to all members
  const { data: members } = await db
    .from('members')
    .select('phone, status')
    .eq('trip_id', tripId)
    .in('status', ['consented', 'active'])
    .eq('opt_out', false)

  const optionLines = destinations
    .map((d, i) => {
      const hotelAnchor = d.hotel_range ? ` · 🏨 ${d.hotel_range}` : ''
      return `[${i + 1}] ${d.emoji} ${d.name} · ${d.estimated_cost}${hotelAnchor}`
    })
    .join('\n')

  for (const m of members ?? []) {
    await sendWhatsApp(
      m.phone,
      `Vote for *${trip.name}* destination — closes in 48h (earlier if everyone votes):\n\n${optionLines}\n\n_Hotel costs are estimates, not bookings_\n\nReply 1, 2, or 3`
    )
  }

  return NextResponse.json({ ok: true, destinations })
}
