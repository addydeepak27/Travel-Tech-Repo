import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const db = createServiceClient()

  const { data: trip, error: tripError } = await db
    .from('trips')
    .select('id, name, organizer_id')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) {
    console.error('[avatar-info] trip error:', tripError)
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const { data: members, error: membersError } = await db
    .from('members')
    .select('id, avatar, status, name')
    .eq('trip_id', tripId)

  if (membersError) {
    console.error('[avatar-info] members error:', membersError)
  }

  return NextResponse.json({ ...trip, members: members ?? [] })
}
