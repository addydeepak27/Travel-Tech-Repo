'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import type { Hotel, Member } from '@/types'

export default function HotelsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params)
  const [hotels, setHotels] = useState<(Hotel & { recommended?: boolean })[]>([])
  const [tripName, setTripName] = useState('')
  const [budgetZone, setBudgetZone] = useState<{ min: number; max: number } | null>(null)
  const [myVote, setMyVote] = useState<string | null>(null)
  const [tally, setTally] = useState<Record<string, number>>({})
  const [totalVoters, setTotalVoters] = useState(0)
  const [loading, setLoading] = useState(true)

  // Identify member via URL token (simplified: use localStorage in demo)
  const [memberId, setMemberId] = useState<string | null>(null)

  useEffect(() => {
    // In production, member token comes from the URL query or cookie
    const stored = localStorage.getItem(`ts_member_${tripId}`)
    setMemberId(stored)
  }, [tripId])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trips')
        .select('name, hotel_options, group_budget_zone, votes(*), members(id, status)')
        .eq('id', tripId)
        .single()

      if (!data) return

      setTripName(data.name)
      setHotels(data.hotel_options ?? [])
      setBudgetZone(data.group_budget_zone)

      const voters = (data.members ?? []).filter((m: { id: string; status: string }) =>
        ['consented', 'active'].includes(m.status)
      )
      setTotalVoters(voters.length)

      const hotelVotes = (data.votes ?? []).filter((v: { vote_type: string }) => v.vote_type === 'hotel')
      const t: Record<string, number> = {}
      for (const v of hotelVotes) { t[v.value] = (t[v.value] ?? 0) + 1 }
      setTally(t)

      if (memberId) {
        const mine = hotelVotes.find((v: { member_id: string; value: string }) => v.member_id === memberId)
        if (mine) setMyVote(mine.value)
      }

      setLoading(false)
    }

    if (memberId !== undefined) load()
  }, [tripId, memberId])

  async function castVote(hotelName: string) {
    if (!memberId || myVote) return

    await supabase.from('votes').upsert({
      trip_id: tripId,
      member_id: memberId,
      vote_type: 'hotel',
      value: hotelName,
    }, { onConflict: 'trip_id,member_id,vote_type' })

    setMyVote(hotelName)
    setTally(prev => ({ ...prev, [hotelName]: (prev[hotelName] ?? 0) + 1 }))
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-3xl animate-pulse">🏨</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading hotels...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="safe-top px-5 pt-6 pb-4">
        <div className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>WHERE YOU&apos;RE STAYING</div>
        <h1 className="text-xl font-bold">{tripName}</h1>
        {budgetZone && (
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            3 hotels within your group budget · ₹{budgetZone.min.toLocaleString('en-IN')}–₹{budgetZone.max.toLocaleString('en-IN')}/person
          </p>
        )}
        {Object.keys(tally).length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {Object.values(tally).reduce((a, b) => a + b, 0)}/{totalVoters} voted
            </div>
            {myVote && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                Your vote: {myVote}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hotel cards */}
      <div className="flex-1 px-5 space-y-4 pb-32 overflow-y-auto">
        {hotels.map((hotel, idx) => {
          const votes = tally[hotel.name] ?? 0
          const isMyVote = myVote === hotel.name

          return (
            <div
              key={idx}
              className="rounded-2xl overflow-hidden"
              style={{
                border: `1.5px solid ${isMyVote ? 'var(--accent)' : 'var(--card-border)'}`,
                background: 'var(--card)',
              }}
            >
              {/* Static map */}
              {hotel.map_image_url && (
                <img
                  src={hotel.map_image_url}
                  alt={`Map showing ${hotel.name} location`}
                  className="w-full object-cover"
                  style={{ height: 160 }}
                  loading="lazy"
                />
              )}
              {!hotel.map_image_url && (
                <div
                  className="w-full flex items-center justify-center text-2xl"
                  style={{ height: 100, background: 'var(--card-border)' }}
                >
                  📍
                </div>
              )}

              <div className="p-4">
                {/* Name + badge */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base leading-tight">{hotel.name}</h3>
                      {(hotel as Hotel & { recommended?: boolean }).recommended && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {'⭐'.repeat(hotel.stars)} · {hotel.neighbourhood}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-base">₹{hotel.total_per_person.toLocaleString('en-IN')}</div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>per person</div>
                  </div>
                </div>

                {/* Highlights */}
                <div className="flex flex-wrap gap-1.5 my-2.5">
                  {hotel.highlights.map((h, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--foreground)' }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Honest caveat */}
                <div className="flex items-start gap-2 p-2.5 rounded-xl mb-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
                  <span className="text-sm flex-shrink-0">⚠️</span>
                  <p className="text-xs leading-snug" style={{ color: '#d97706' }}>{hotel.caveat}</p>
                </div>

                {/* Vote count */}
                {votes > 0 && (
                  <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                    {votes} {votes === 1 ? 'person' : 'people'} voted for this
                  </div>
                )}

                {/* External booking link */}
                <a
                  href={hotel.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-sm py-2 rounded-xl mb-2 font-medium transition-opacity hover:opacity-80"
                  style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
                >
                  View on MakeMyTrip / Booking.com →
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vote buttons — pinned to bottom */}
      {!myVote && (
        <div
          className="fixed bottom-0 left-0 right-0 px-5 pt-3 safe-bottom"
          style={{ background: 'var(--background)', borderTop: '1px solid var(--card-border)' }}
        >
          <p className="text-xs text-center mb-2" style={{ color: 'var(--muted)' }}>
            Vote for your pick — majority wins
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${hotels.length}, 1fr)` }}>
            {hotels.map((hotel, idx) => (
              <button
                key={idx}
                onClick={() => castVote(hotel.name)}
                className="py-3 rounded-xl text-xs font-semibold text-center transition-all"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {hotel.name.split(' ')[0]} {idx === 0 ? '🌿' : idx === 1 ? '🌟' : '🏄'}
              </button>
            ))}
          </div>
        </div>
      )}

      {myVote && (
        <div
          className="fixed bottom-0 left-0 right-0 px-5 pt-3 safe-bottom text-center"
          style={{ background: 'var(--background)', borderTop: '1px solid var(--card-border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
            ✓ You voted for {myVote}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Waiting for the group · Majority wins
          </p>
        </div>
      )}
    </div>
  )
}
