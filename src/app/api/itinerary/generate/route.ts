import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { checkAndTriggerItinerary } from '@/lib/trip-checks'

/**
 * POST /api/itinerary/generate
 * Canonical entry point for itinerary generation.
 * Guards the 3-condition gate: destination + budget + dates must all be locked.
 * Safe to call multiple times — no-ops if conditions unmet or itinerary already exists.
 */
export async function POST(req: NextRequest) {
  const { tripId } = await req.json()
  if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

  const db = createServiceClient()

  const { data: trip } = await db
    .from('trips')
    .select('confirmed_destination, weighted_median_tier, departure_date, confirmed_hotel, itinerary, status')
    .eq('id', tripId)
    .single()

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  // Validate the 3-condition gate
  const missing: string[] = []
  if (!trip.confirmed_destination) missing.push('destination')
  if (!trip.weighted_median_tier)   missing.push('budget')
  if (!trip.departure_date)         missing.push('dates')
  if (!trip.confirmed_hotel)        missing.push('hotel')

  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Not ready to generate', missing },
      { status: 422 }
    )
  }

  if (trip.itinerary) {
    return NextResponse.json({ ok: true, status: 'already_generated' })
  }

  await checkAndTriggerItinerary(db, tripId)

  return NextResponse.json({ ok: true, status: 'triggered' })
}
