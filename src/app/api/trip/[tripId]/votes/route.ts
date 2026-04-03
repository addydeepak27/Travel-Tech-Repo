import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const voteType = req.nextUrl.searchParams.get('voteType')

  const db = createServiceClient()

  let query = db
    .from('votes')
    .select('member_id, value, vote_type')
    .eq('trip_id', tripId)

  if (voteType) query = query.eq('vote_type', voteType)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
