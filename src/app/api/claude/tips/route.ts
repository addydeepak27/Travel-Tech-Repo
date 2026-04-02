import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateCostTips } from '@/lib/claude'
import { sendEmail } from '@/lib/email'
import type { BudgetTier } from '@/types'

export async function POST(req: NextRequest) {
  const { tripId } = await req.json()
  if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

  const db = createServiceClient()

  const { data: trip } = await db
    .from('trips')
    .select('name, confirmed_destination, destination_options, group_budget_zone, weighted_median_tier, departure_date, return_date, organizer_id, members(id, email, status)')
    .eq('id', tripId)
    .single()

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const destination = trip.confirmed_destination ?? trip.destination_options?.[0] ?? 'your destination'
  const budgetZone = trip.group_budget_zone ?? { min: 5000, max: 10000 }
  const activeMembers = (trip.members ?? []).filter((m: { status: string }) =>
    ['consented', 'active'].includes(m.status)
  )

  const departure = trip.departure_date ? new Date(trip.departure_date) : null
  const returnDate = trip.return_date ? new Date(trip.return_date) : null
  const tripDurationDays = departure && returnDate
    ? Math.ceil((returnDate.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24))
    : 3

  const tips = await generateCostTips(destination, budgetZone, activeMembers.length, tripDurationDays)

  // Find organizer to notify
  const organizer = (trip.members ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
  if (organizer?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    await sendEmail(
      organizer.email,
      `All budgets are in for ${trip.name}`,
      `All budgets are in. Group zone: ₹${budgetZone.min.toLocaleString('en-IN')}–₹${budgetZone.max.toLocaleString('en-IN')}/person.\n\n3 ways to stretch it further → ${appUrl}/organizer/${tripId}`
    )
  }

  return NextResponse.json({ ok: true, tips })
}
