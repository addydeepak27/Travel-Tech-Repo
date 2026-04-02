import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const db = createServiceClient()

  const { data: trip, error } = await db
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (error || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const { data: members } = await db
    .from('members')
    .select('*')
    .eq('trip_id', tripId)

  const { data: tasks } = await db
    .from('mission_tasks')
    .select('*')
    .eq('trip_id', tripId)

  const { data: forYou } = await db
    .from('for_you_callouts')
    .select('*')
    .eq('trip_id', tripId)

  const { data: brownieEvents } = await db
    .from('brownie_events')
    .select('event_type, points_earned, member_id')
    .eq('trip_id', tripId)

  return NextResponse.json({
    trip,
    members: members ?? [],
    tasks: tasks ?? [],
    forYou: forYou ?? [],
    brownieEvents: brownieEvents ?? [],
  })
}
