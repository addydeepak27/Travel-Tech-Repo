import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/twilio'
import { ACTIVE_MEMBER_STATUSES } from '@/lib/constants'

export async function awardBrowniePoints(
  db: SupabaseClient,
  tripId: string,
  memberId: string,
  eventType: string,
  phone: string,
  eventLabel: string
): Promise<void> {
  const { count: totalActive } = await db
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .in('status', ACTIVE_MEMBER_STATUSES)

  const { count: alreadyAwarded } = await db
    .from('brownie_events')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .eq('event_type', eventType)

  const rank = (alreadyAwarded ?? 0) + 1
  const points = Math.max((totalActive ?? 1) - rank + 1, 1)

  const { error } = await db.from('brownie_events').upsert(
    { trip_id: tripId, member_id: memberId, event_type: eventType, points_earned: points, rank },
    { onConflict: 'trip_id,member_id,event_type', ignoreDuplicates: true }
  )
  if (error) return

  await db.rpc('increment_member_brownie_points', { p_member_id: memberId, p_amount: points })

  const ordinal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`
  const headline = rank === 1
    ? `🍫 *+${points} brownie points!*\nYou were FIRST to ${eventLabel} 🔥`
    : `🍫 *+${points} brownie points!*\nYou were ${ordinal} to ${eventLabel} — nice one!`

  const { data: member } = await db
    .from('members').select('brownie_points').eq('id', memberId).single()

  await sendWhatsApp(phone, `${headline}\nYour total: ${member?.brownie_points ?? points} pts 🏆`)
}
