import type { SupabaseClient } from '@supabase/supabase-js'
import { ACTIVE_MEMBER_STATUSES } from '@/lib/constants'

export async function getVotePendingLine(
  db: SupabaseClient,
  tripId: string,
  voteType: 'destination' | 'hotel' | 'itinerary',
  excludeMemberId: string
): Promise<string> {
  const { data: voted } = await db
    .from('votes')
    .select('member_id')
    .eq('trip_id', tripId)
    .eq('vote_type', voteType)
    .neq('member_id', excludeMemberId)

  const { data: active } = await db
    .from('members')
    .select('id')
    .eq('trip_id', tripId)
    .in('status', ACTIVE_MEMBER_STATUSES)

  const votedIds = new Set((voted ?? []).map((v: { member_id: string }) => v.member_id))
  const totalActive = (active ?? []).length
  const votedCount = (active ?? []).filter((m: { id: string }) => votedIds.has(m.id)).length
  const remaining = totalActive - votedCount

  if (remaining <= 1) return `_You're the last one — the group is waiting on you._`
  if (votedCount === 0) return `_Be the first to vote — kick things off!_`
  return `_${votedCount} of ${totalActive} voted. You're one of ${remaining} left._`
}
