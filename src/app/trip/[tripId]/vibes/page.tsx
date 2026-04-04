'use client'

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'
import { ACTIVE_MEMBER_STATUSES } from '@/lib/constants'

// Note: supabase anon client is used ONLY for realtime subscriptions (trigger only, not data).
// All data reads go through service-role API routes to bypass RLS.

interface MemberData {
  avatar: AvatarType | null
  budget_tier: string | null
  pace_vote: string | null
  activity_pref: string | null
  trip_priority: string | null
  special_requests: string | null
  status: string
  name: string | null
  brownie_points: number
}

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0) || 1
  const r = 54, cx = 70, cy = 70, sw = 22
  const circ = 2 * Math.PI * r
  const cumulatives = slices.map((_, i) => slices.slice(0, i).reduce((sum, d) => sum + d.value, 0))
  return (
    <div className="flex items-center gap-4">
      <svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        {slices.map((s, i) => {
          const dash = (s.value / total) * circ
          const rotation = (cumulatives[i] / total) * 360 - 90
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${circ - dash}`}
              transform={`rotate(${rotation} ${cx} ${cy})`} />
          )
        })}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fill="var(--foreground)" fontWeight="bold">{total}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={9} fill="var(--muted)">members</text>
      </svg>
      <div className="space-y-1.5">
        {slices.filter(s => s.value > 0).map(s => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span style={{ color: 'var(--muted)' }}>×{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ items }: { items: { emoji: string; label: string; count: number }[] }) {
  const max = Math.max(...items.map(d => d.count), 1)
  return (
    <div className="space-y-3">
      {[...items].sort((a, b) => b.count - a.count).map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span>{item.emoji} {item.label}</span>
            <span style={{ color: 'var(--muted)' }}>{item.count}</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: 'var(--card-border)' }}>
            <div className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${(item.count / max) * 100}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      <div className="text-xs font-medium mb-3" style={{ color: 'var(--accent)' }}>{title}</div>
      {children}
    </div>
  )
}

export default function VibesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params)
  const router = useRouter()
  const [tripName, setTripName] = useState('')
  const [members, setMembers] = useState<MemberData[]>([])
  const [totalInvited, setTotalInvited] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/trip/${tripId}/dashboard-info`)
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        setTripName(data.trip?.name ?? '')
        const all = (data.members ?? []) as MemberData[]
        setTotalInvited(all.length)
        setMembers(all.filter((m: MemberData) => ACTIVE_MEMBER_STATUSES.includes(m.status as never)))
      } catch { /* fall through — shows empty state */ }
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`vibes-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `trip_id=eq.${tripId}` }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-3xl animate-pulse">✨</div>
      </div>
    )
  }

  const responded = members.length

  const budgetSlices = [
    { label: 'Backpacker', value: members.filter(m => m.budget_tier === 'backpacker').length, color: '#6366f1' },
    { label: 'Comfortable', value: members.filter(m => m.budget_tier === 'comfortable').length, color: '#22c55e' },
    { label: 'Premium', value: members.filter(m => m.budget_tier === 'premium').length, color: '#f59e0b' },
    { label: 'Luxury', value: members.filter(m => m.budget_tier === 'luxury').length, color: '#ec4899' },
  ]

  const activityItems = [
    { emoji: '🏄', label: 'Adventure & outdoors', count: members.filter(m => m.activity_pref === 'adventure').length },
    { emoji: '🍜', label: 'Food & culture', count: members.filter(m => m.activity_pref === 'food_culture').length },
    { emoji: '🧘', label: 'Relaxation & wellness', count: members.filter(m => m.activity_pref === 'relaxation').length },
    { emoji: '🎉', label: 'Nightlife & vibes', count: members.filter(m => m.activity_pref === 'nightlife').length },
  ]

  const priorityItems = [
    { emoji: '👥', label: 'Making memories', count: members.filter(m => m.trip_priority === 'memories').length },
    { emoji: '🗺', label: 'Exploring hidden gems', count: members.filter(m => m.trip_priority === 'exploring').length },
    { emoji: '🥂', label: 'Epic food & drinks', count: members.filter(m => m.trip_priority === 'food_drinks').length },
    { emoji: '⚡', label: 'Thrills & experiences', count: members.filter(m => m.trip_priority === 'thrills').length },
  ]

  const pacePcts = {
    easy_chill: members.filter(m => m.pace_vote === 'easy_chill').length,
    balanced_mix: members.filter(m => m.pace_vote === 'balanced_mix').length,
    packed_schedule: members.filter(m => m.pace_vote === 'packed_schedule').length,
  }
  const paceTotal = pacePcts.easy_chill + pacePcts.balanced_mix + pacePcts.packed_schedule || 1

  const leaderboard = [...members]
    .filter(m => m.brownie_points > 0)
    .sort((a, b) => b.brownie_points - a.brownie_points)
    .slice(0, 8)
  const maxPts = leaderboard[0]?.brownie_points ?? 1

  const allAvatars = Object.keys(AVATAR_META) as AvatarType[]
  const specialReqs = members.filter(m => m.special_requests).map(m => m.special_requests!)

  return (
    <div className="min-h-dvh" style={{ background: 'var(--background)' }}>
      <div className="safe-top px-5 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm" style={{ color: 'var(--muted)' }}>← Back</button>
        <h1 className="font-bold text-lg">{tripName} — Group Vibes</h1>
      </div>

      <div className="px-5 space-y-4 pb-10">
        <div className="p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">{responded} of {totalInvited} members responded</span>
            <span style={{ color: 'var(--muted)' }}>{Math.round((responded / (totalInvited || 1)) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: 'var(--card-border)' }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${(responded / (totalInvited || 1)) * 100}%`, background: 'var(--accent)' }} />
          </div>
        </div>

        {responded === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
            No responses yet. Check back once your squad answers their preferences.
          </p>
        ) : (
          <>
            <Card title="BUDGET SPLIT">
              <DonutChart slices={budgetSlices} />
            </Card>

            <Card title="WHAT THE SQUAD ENJOYS">
              <BarChart items={activityItems} />
            </Card>

            <Card title="TRAVEL VIBE">
              <div className="flex h-3 rounded-full overflow-hidden mb-2">
                <div style={{ width: `${(pacePcts.easy_chill / paceTotal) * 100}%`, background: '#22c55e' }} />
                <div style={{ width: `${(pacePcts.balanced_mix / paceTotal) * 100}%`, background: '#6366f1' }} />
                <div style={{ width: `${(pacePcts.packed_schedule / paceTotal) * 100}%`, background: '#f59e0b' }} />
              </div>
              <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
                <span>🌴 Easy ({pacePcts.easy_chill})</span>
                <span>🎯 Balanced ({pacePcts.balanced_mix})</span>
                <span>🔥 Packed ({pacePcts.packed_schedule})</span>
              </div>
            </Card>

            <Card title="TRIP PRIORITIES">
              <BarChart items={priorityItems} />
            </Card>

            <Card title="WHO'S WHO">
              <div className="flex flex-wrap gap-3">
                {allAvatars.map(av => {
                  const count = members.filter(m => m.avatar === av).length
                  return (
                    <div key={av} className="flex items-center gap-1.5 text-sm" style={{ opacity: count === 0 ? 0.35 : 1 }}>
                      <span className="text-xl">{AVATAR_META[av].icon}</span>
                      <span>×{count}</span>
                    </div>
                  )
                })}
              </div>
            </Card>

            {specialReqs.length > 0 && (
              <Card title="SPECIAL REQUESTS">
                <div className="space-y-2">
                  {specialReqs.map((r, i) => (
                    <div key={i} className="text-sm flex items-start gap-2">
                      <span>💬</span>
                      <span style={{ color: 'var(--muted)' }}>&quot;{r}&quot;</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {leaderboard.length > 0 && (
              <Card title="🏆 BROWNIE POINTS">
                <div className="space-y-2">
                  {leaderboard.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs w-4 text-right" style={{ color: 'var(--muted)' }}>{i + 1}.</span>
                      <span className="text-lg">{m.avatar ? AVATAR_META[m.avatar].icon : '👤'}</span>
                      <span className="text-xs flex-1 truncate">{m.name ?? 'Member'}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full" style={{ width: 60, background: 'var(--card-border)' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${(m.brownie_points / maxPts) * 60}px`, background: 'var(--accent)' }} />
                        </div>
                        <span className="text-xs font-mono">{m.brownie_points}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
