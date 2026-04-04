import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const { email } = await req.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const db = createServiceClient()

  // Check if trip exists and is joinable
  const { data: trip } = await db
    .from('trips')
    .select('id, status')
    .eq('id', tripId)
    .single()

  if (!trip || trip.status === 'cancelled') {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Check if email already has a member record for this trip
  const { data: existing } = await db
    .from('members')
    .select('id, status')
    .eq('trip_id', tripId)
    .eq('email', email.toLowerCase().trim())
    .single()

  if (existing) {
    if (existing.status === 'declined') {
      return NextResponse.json({ error: 'You declined this trip. Ask the organiser to re-invite you.' }, { status: 403 })
    }
    return NextResponse.json({ memberId: existing.id, status: existing.status })
  }

  // Create new member
  const { data: newMember } = await db
    .from('members')
    .insert({
      trip_id: tripId,
      phone: '',
      email: email.toLowerCase().trim(),
      status: 'invited',
      points: 0,
      brownie_points: 0,
      opt_out: false,
    })
    .select('id')
    .single()

  if (!newMember) {
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
  }

  return NextResponse.json({ memberId: newMember.id, status: 'invited' })
}
