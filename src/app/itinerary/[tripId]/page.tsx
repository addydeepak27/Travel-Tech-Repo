'use client'

import { useState, useEffect, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AVATAR_META } from '@/types'
import type { ItineraryDay, ForYouCallout, AvatarType } from '@/types'

const ACTIVITY_ICONS: Record<string, string> = {
  food: '🍽',
  activity: '🎯',
  transport: '🚗',
  free: '✨',
  photo: '📷',
}

export default function ItineraryPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params)
  const searchParams = useSearchParams()
  const urlMemberId = searchParams.get('m')

  const [tripName, setTripName] = useState('')
  const [destination, setDestination] = useState('')
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([])
  const [callouts, setCallouts] = useState<ForYouCallout[]>([])
  const [myAvatar, setMyAvatar] = useState<AvatarType | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]))

  useEffect(() => {
    const stored = localStorage.getItem(`ts_member_${tripId}`)
    const memberId = urlMemberId ?? stored

    async function load() {
      const { data: trip } = await supabase
        .from('trips')
        .select('name, confirmed_destination, itinerary, status')
        .eq('id', tripId)
        .single()

      if (!trip) return

      setTripName(trip.name)
      setDestination(trip.confirmed_destination ?? '')
      setItinerary(trip.itinerary ?? [])

      if (memberId) {
        const { data: member } = await supabase
          .from('members')
          .select('avatar')
          .eq('id', memberId)
          .single()

        if (member?.avatar) setMyAvatar(member.avatar as AvatarType)

        const { data: foryou } = await supabase
          .from('for_you_callouts')
          .select('*')
          .eq('trip_id', tripId)
          .eq('member_id', memberId)

        if (foryou) setCallouts(foryou)
      }

      setLoading(false)
    }
    load()
  }, [tripId, urlMemberId])

  function toggleDay(day: number) {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(day)) { next.delete(day) } else { next.add(day) }
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-3xl animate-pulse">🗺</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading itinerary...</p>
        </div>
      </div>
    )
  }

  if (!itinerary.length) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-5 text-center safe-top safe-bottom">
        <div className="text-4xl mb-4">⏳</div>
        <h1 className="text-xl font-bold mb-2">Itinerary not ready yet</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          The itinerary is being generated. Check back soon or wait for the WhatsApp message.
        </p>
      </div>
    )
  }

  const avatarMeta = myAvatar ? AVATAR_META[myAvatar] : null

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="safe-top px-5 pt-6 pb-4">
        <div className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>YOUR ITINERARY</div>
        <h1 className="text-xl font-bold">{tripName}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          {destination} · {itinerary.length} {itinerary.length === 1 ? 'day' : 'days'}
        </p>
        {avatarMeta && (
          <div
            className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
          >
            <span>{avatarMeta.icon}</span>
            <span>{avatarMeta.label} view</span>
          </div>
        )}
      </div>

      {/* Days */}
      <div className="flex-1 px-5 space-y-3 pb-8 overflow-y-auto">
        {itinerary.map(day => {
          const expanded = expandedDays.has(day.day)
          const callout = callouts.find(c => c.day === day.day)
          const dayCost = day.activities.reduce((sum, a) => sum + (a.cost_per_person ?? 0), 0)

          return (
            <div
              key={day.day}
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--card-border)', background: 'var(--card)' }}
            >
              {/* Day header — always visible, tap to expand */}
              <button
                onClick={() => toggleDay(day.day)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                    >
                      Day {day.day}
                    </span>
                    <span className="font-semibold text-sm">{day.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {day.activities.length} activities
                    </span>
                    {dayCost > 0 && (
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        ~₹{dayCost.toLocaleString('en-IN')}/person
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ color: 'var(--muted)' }}>{expanded ? '▲' : '▼'}</span>
              </button>

              {expanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* For You callout */}
                  {callout && avatarMeta && (
                    <div
                      className="flex items-start gap-2 p-3 rounded-xl"
                      style={{ background: 'var(--accent-muted)', border: '1px solid rgba(99,102,241,0.2)' }}
                    >
                      <span className="flex-shrink-0">{avatarMeta.icon}</span>
                      <p className="text-xs leading-snug" style={{ color: 'var(--accent)' }}>
                        {callout.callout}
                      </p>
                    </div>
                  )}

                  {/* Activities */}
                  <div className="space-y-2">
                    {day.activities.map((activity, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 py-2"
                        style={{ borderBottom: idx < day.activities.length - 1 ? '1px solid var(--card-border)' : 'none' }}
                      >
                        <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 44 }}>
                          <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{activity.time}</span>
                          <span className="text-base">{ACTIVITY_ICONS[activity.type] ?? '📌'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium leading-tight">{activity.title}</div>
                          <div className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>
                            {activity.description}
                          </div>
                          {activity.cost_per_person != null && activity.cost_per_person > 0 && (
                            <div className="text-xs mt-1 font-medium" style={{ color: 'var(--success)' }}>
                              ₹{activity.cost_per_person.toLocaleString('en-IN')}/person
                            </div>
                          )}
                          {activity.cost_per_person === 0 && (
                            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Free</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
