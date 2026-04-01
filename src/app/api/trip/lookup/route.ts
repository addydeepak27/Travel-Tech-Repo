import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.toUpperCase().trim()

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: trip } = await db
    .from('trips')
    .select('id, name, status')
    .eq('travel_code', code)
    .single()

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  if (trip.status === 'cancelled') {
    return NextResponse.json({ error: 'This trip has been cancelled' }, { status: 410 })
  }

  return NextResponse.json({ tripId: trip.id, tripName: trip.name })
}
