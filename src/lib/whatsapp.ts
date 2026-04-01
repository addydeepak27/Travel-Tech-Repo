import { sendWhatsApp } from '@/lib/twilio'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function sendWhatsAppRateLimited(
  db: SupabaseClient,
  memberId: string,
  phone: string,
  message: string,
  messageType: string
): Promise<boolean> {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)

  const { count } = await db
    .from('message_log')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .gte('sent_at', dayStart.toISOString())

  if ((count ?? 0) >= 2) return false

  await sendWhatsApp(phone, message)
  await db.from('message_log').insert({ member_id: memberId, message_type: messageType })
  return true
}
