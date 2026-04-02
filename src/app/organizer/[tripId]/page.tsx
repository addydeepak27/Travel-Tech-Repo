'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { AVATAR_META, BUDGET_TIER_META } from '@/types'
import type { AvatarType, BudgetTier, Hotel, MissionTask, ItineraryDay } from '@/types'

interface TripMember {
  id: string
  phone: string
  name: string | null
  avatar: AvatarType | null
  avatar_suffix: string | null
  budget_tier: BudgetTier | null
  status: string
  points: number
  opt_out: boolean
}

interface TripData {
  id: string
  name: string
  status: string
  organizer_id: string
  destination_options: string[]
  confirmed_destination: string | null
  confirmed_hotel: Hotel | null
  hotel_options: Hotel[] | null
  itinerary: ItineraryDay[] | null
  departure_date: string | null
  group_budget_zone: { min: number; max: number } | null
  weighted_median_tier: BudgetTier | null
  gamification_enabled: boolean
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  inviting: 'Inviting',
  avatar_collection: 'Collecting Avatars',
  budget_collection: 'Collecting Budgets',
  destination_vote: 'Destination Vote',
  hotel_vote: 'Hotel Vote',
  itinerary_preferences: 'Itinerary Prefs',
  itinerary_vote: 'Itinerary Vote',
  locked: 'Trip Locked',
  cancelled: 'Cancelled',
}

const MEMBER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  invited: { label: 'Invited', color: 'var(--muted)' },
  consented: { label: 'Joined', color: 'var(--accent)' },
  avatar_selected: { label: 'Role set', color: 'var(--accent)' },
  budget_submitted: { label: 'Budget in', color: 'var(--success)' },
  active: { label: 'Active', color: 'var(--success)' },
  declined: { label: 'Declined', color: '#ef4444' },
  dropped: { label: 'Dropped', color: '#ef4444' },
}

export default function OrganizerDashboard({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params)

  const [trip, setTrip] = useState<TripData | null>(null)
  const [members, setMembers] = useState<TripMember[]>([])
  const [tasks, setTasks] = useState<MissionTask[]>([])
  const [votes, setVotes] = useState<{ vote_type: string; value: string; member_id: string }[]>([])
  const [tips, setTips] = useState<{ title: string; tip: string }[]>([])
  const [budgetAlert, setBudgetAlert] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'monitor' | 'tasks' | 'squad' | 'plan'>('monitor')
  const [organizerId, setOrganizerId] = useState<string | null>(null)
  const [nudgingId, setNudgingId] = useState<string | null>(null)
  const [tipsVisible, setTipsVisible] = useState(false)
  const [alertDismissed, setAlertDismissed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(`ts_member_${tripId}`)
    setOrganizerId(stored)
  }, [tripId])

  useEffect(() => {
    if (organizerId === undefined) return

    async function load() {
      const res = await fetch(`/api/trip/${tripId}/organizer-info`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()

      setTrip(data.trip)
      setMembers(data.members ?? [])
      setTasks(data.tasks ?? [])
      setVotes(data.votes ?? [])

      const membersData = data.members ?? []

      // Detect budget tension (spread ≥ 2 tiers)
      if (membersData) {
        const tierValues: Record<string, number> = { backpacker: 1, comfortable: 2, premium: 3, luxury: 4 }
        const submitted = membersData.filter((m: TripMember) => m.budget_tier)
        if (submitted.length >= 2) {
          const vals = submitted.map((m: TripMember) => tierValues[m.budget_tier!] ?? 0)
          const spread = Math.max(...vals) - Math.min(...vals)
          if (spread >= 2) {
            setBudgetAlert(`Heads up: your group has a wide budget gap. ${submitted.filter((m: TripMember) => (tierValues[m.budget_tier!] ?? 0) <= 1).length} members may find the plan a stretch — consider a quick check-in.`)
          }
        }
      }

      setLoading(false)
    }

    load()

    // Real-time subscription
    const channel = supabase
      .channel(`organizer-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `trip_id=eq.${tripId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_tasks', filter: `trip_id=eq.${tripId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `trip_id=eq.${tripId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId, organizerId])

  // Load cost tips once budget zone is available
  useEffect(() => {
    if (!trip?.group_budget_zone || tips.length > 0) return
    async function loadTips() {
      const res = await fetch('/api/claude/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId }),
      })
      if (res.ok) {
        const data = await res.json()
        setTips(data.tips ?? [])
      }
    }
    loadTips()
  }, [trip?.group_budget_zone, tripId, tips.length])

  async function nudge(memberId: string) {
    if (nudgingId || !organizerId) return
    setNudgingId(memberId)
    await fetch('/api/organizer/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, memberId, organizerId }),
    })
    setTimeout(() => setNudgingId(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-3xl animate-pulse">📋</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading organiser view...</p>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-5 text-center">
        <p style={{ color: 'var(--muted)' }}>Trip not found.</p>
      </div>
    )
  }

  const activeMembers = members.filter(m => ['consented', 'avatar_selected', 'budget_submitted', 'active'].includes(m.status))
  const nonResponders = members.filter(m => m.status === 'invited')
  const avatarMap = new Map(members.filter(m => m.avatar).map(m => [m.avatar!, m]))

  // Vote tallies for current step
  const currentVoteType = trip.status === 'destination_vote' ? 'destination'
    : trip.status === 'hotel_vote' ? 'hotel'
    : trip.status === 'itinerary_vote' ? 'itinerary'
    : null
  const currentVotes = currentVoteType ? votes.filter(v => v.vote_type === currentVoteType) : []
  const voteTally: Record<string, number> = {}
  for (const v of currentVotes) { voteTally[v.value] = (voteTally[v.value] ?? 0) + 1 }

  // Task stats — compare date strings to avoid timezone drift (deadlines are stored as DATE, not TIMESTAMP)
  const todayStr = new Date().toISOString().split('T')[0]
  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const overdueTasks = tasks.filter(t => t.status === 'pending' && t.deadline < todayStr)

  const tabs = [
    { id: 'monitor' as const, icon: '👁', label: 'Monitor' },
    { id: 'tasks' as const, icon: '✅', label: 'Tasks' },
    { id: 'plan' as const, icon: '🗺', label: 'Plan' },
    { id: 'squad' as const, icon: '👥', label: 'Squad' },
  ]

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="safe-top px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold leading-tight">{trip.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                {STATUS_LABELS[trip.status] ?? trip.status}
              </span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {activeMembers.length} active · {members.length} total
              </span>
            </div>
          </div>
          {trip.organizer_id && organizerId === trip.organizer_id && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
              Organiser
            </span>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pb-24">

        {/* ── MONITOR TAB ── */}
        {activeTab === 'monitor' && (
          <div className="px-5 space-y-4 pt-2">

            {/* Budget alert */}
            {budgetAlert && !alertDismissed && (
              <div
                className="p-4 rounded-2xl"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span>⚠️</span>
                    <p className="text-xs leading-snug" style={{ color: '#d97706' }}>{budgetAlert}</p>
                  </div>
                  <button onClick={() => setAlertDismissed(true)} className="text-xs flex-shrink-0" style={{ color: 'var(--muted)', minHeight: 'auto', minWidth: 'auto' }}>✕</button>
                </div>
              </div>
            )}

            {/* Budget zone + tips */}
            {trip.group_budget_zone && (
              <div
                className="p-4 rounded-2xl"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium" style={{ color: 'var(--accent)' }}>GROUP BUDGET ZONE</div>
                  {tips.length > 0 && (
                    <button
                      onClick={() => setTipsVisible(v => !v)}
                      className="text-xs font-medium"
                      style={{ color: 'var(--accent)', minHeight: 'auto', minWidth: 'auto' }}
                    >
                      {tipsVisible ? 'Hide tips' : '3 ways to save ↓'}
                    </button>
                  )}
                </div>
                <div className="font-bold text-lg">
                  ₹{trip.group_budget_zone.min.toLocaleString('en-IN')}–₹{trip.group_budget_zone.max.toLocaleString('en-IN')}
                  <span className="text-sm font-normal ml-1" style={{ color: 'var(--muted)' }}>/person</span>
                </div>
                {trip.weighted_median_tier && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {BUDGET_TIER_META[trip.weighted_median_tier].label} · {BUDGET_TIER_META[trip.weighted_median_tier].description}
                  </div>
                )}
                {tipsVisible && tips.length > 0 && (
                  <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
                    {tips.map((tip, i) => (
                      <div key={i}>
                        <div className="text-xs font-semibold">{tip.title}</div>
                        <div className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>{tip.tip}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Avatar claim grid */}
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
                AVATAR CLAIMS ({avatarMap.size}/{Object.keys(AVATAR_META).length} claimed)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(AVATAR_META) as AvatarType[]).map(key => {
                  const meta = AVATAR_META[key]
                  const holder = avatarMap.get(key)
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2.5 p-3 rounded-xl"
                      style={{
                        background: holder ? 'var(--card)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${holder ? 'var(--card-border)' : 'rgba(255,255,255,0.06)'}`,
                        opacity: holder ? 1 : 0.5,
                      }}
                    >
                      <span className="text-xl">{meta.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{meta.label}</div>
                        {holder ? (
                          <div className="text-xs" style={{ color: 'var(--success)' }}>✓ Claimed</div>
                        ) : (
                          <div className="text-xs" style={{ color: 'var(--muted)' }}>Open</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Non-responders */}
            {nonResponders.length > 0 && (
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
                  WAITING TO RESPOND ({nonResponders.length})
                </div>
                <div className="space-y-2">
                  {nonResponders.map(m => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
                    >
                      <div>
                        <div className="text-sm font-medium">{m.name ?? m.phone}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>Invite sent · not responded</div>
                      </div>
                      <button
                        onClick={() => nudge(m.id)}
                        disabled={nudgingId === m.id}
                        className="text-xs px-3 py-1.5 rounded-xl font-medium transition-all"
                        style={{ background: 'var(--accent)', color: '#fff', opacity: nudgingId === m.id ? 0.6 : 1 }}
                      >
                        {nudgingId === m.id ? '✓ Sent' : 'Nudge'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active members needing action */}
            {activeMembers.filter(m => m.status !== 'active').length > 0 && (
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
                  ACTION NEEDED
                </div>
                <div className="space-y-2">
                  {activeMembers.filter(m => m.status !== 'active').map(m => {
                    const statusInfo = MEMBER_STATUS_LABELS[m.status]
                    const needsAvatar = m.status === 'consented'
                    const needsBudget = m.status === 'avatar_selected'
                    const hint = needsAvatar ? 'Hasn\'t picked a role yet' : needsBudget ? 'Hasn\'t submitted budget' : 'In progress'
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            {m.avatar && <span>{AVATAR_META[m.avatar]?.icon}</span>}
                            <span className="text-sm font-medium">{m.name ?? m.phone}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-muted)', color: statusInfo?.color }}>
                              {statusInfo?.label}
                            </span>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{hint}</div>
                        </div>
                        <button
                          onClick={() => nudge(m.id)}
                          disabled={nudgingId === m.id}
                          className="text-xs px-3 py-1.5 rounded-xl font-medium"
                          style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
                        >
                          {nudgingId === m.id ? '✓' : 'Nudge'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Live vote tally */}
            {currentVoteType && Object.keys(voteTally).length > 0 && (
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
                  LIVE VOTE TALLY — {currentVoteType.toUpperCase()}
                </div>
                <div
                  className="p-4 rounded-2xl space-y-2"
                  style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
                >
                  {Object.entries(voteTally).sort(([, a], [, b]) => b - a).map(([option, count]) => {
                    const pct = Math.round((count / activeMembers.length) * 100)
                    return (
                      <div key={option}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{option}</span>
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{count}/{activeMembers.length} · {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                          <div className="h-full rounded-full" style={{ background: 'var(--accent)', width: `${pct}%`, transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="text-xs pt-1" style={{ color: 'var(--muted)' }}>
                    {currentVotes.length}/{activeMembers.length} voted · {activeMembers.length - currentVotes.length} pending
                  </div>
                </div>
              </div>
            )}

            {/* Confirmed info */}
            {trip.confirmed_destination && (
              <div
                className="p-4 rounded-2xl"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
              >
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--accent)' }}>CONFIRMED</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span>📍</span>
                    <span className="font-semibold">{trip.confirmed_destination}</span>
                  </div>
                  {trip.confirmed_hotel && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>🏨</span>
                      <span>{(trip.confirmed_hotel as Hotel).name}</span>
                    </div>
                  )}
                  {trip.departure_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>📅</span>
                      <span>{new Date(trip.departure_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Task summary */}
            {tasks.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Done', count: doneTasks.length, color: 'var(--success)' },
                  { label: 'Pending', count: pendingTasks.length - overdueTasks.length, color: 'var(--accent)' },
                  { label: 'Overdue', count: overdueTasks.length, color: '#ef4444' },
                ].map(({ label, count, color }) => (
                  <div
                    key={label}
                    className="p-3 rounded-xl text-center"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
                  >
                    <div className="text-xl font-bold" style={{ color }}>{count}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {activeTab === 'tasks' && (
          <div className="px-5 pt-2 space-y-3">
            <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
              ALL TASKS · {tasks.length} total
            </div>
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Tasks will appear here once the itinerary is locked.</p>
              </div>
            ) : (
              tasks.map(task => {
                const todayStr = new Date().toISOString().split('T')[0]
                const isOverdue = task.status === 'pending' && task.deadline < todayStr
                const member = members.find(m => m.id === task.member_id)
                const avatarMeta = task.avatar ? AVATAR_META[task.avatar as AvatarType] : null
                return (
                  <div
                    key={task.id}
                    className="p-4 rounded-2xl"
                    style={{
                      background: 'var(--card)',
                      border: `1px solid ${isOverdue ? '#ef4444' : 'var(--card-border)'}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {avatarMeta && <span className="text-sm">{avatarMeta.icon}</span>}
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{avatarMeta?.label}</span>
                          {member && <span className="text-xs" style={{ color: 'var(--muted)' }}>· {member.name ?? member.phone}</span>}
                        </div>
                        <div className="text-sm font-medium leading-tight">{task.title}</div>
                        {task.note && (
                          <div className="text-xs mt-1 p-2 rounded-lg" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                            💬 {task.note}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: task.status === 'done' ? 'rgba(34,197,94,0.15)' : isOverdue ? 'rgba(239,68,68,0.15)' : 'var(--card-border)',
                            color: task.status === 'done' ? 'var(--success)' : isOverdue ? '#ef4444' : 'var(--muted)',
                          }}
                        >
                          {task.status === 'done' ? 'Done' : isOverdue ? 'Overdue' : 'Pending'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          {new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>+{task.points}pts</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── PLAN TAB ── */}
        {activeTab === 'plan' && (
          <div className="px-5 pt-2 space-y-4">
            {/* Destination */}
            {trip.confirmed_destination ? (
              <div
                className="p-4 rounded-2xl"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
              >
                <div className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>DESTINATION</div>
                <div className="font-bold text-lg">{trip.confirmed_destination}</div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl text-center py-8" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Destination vote in progress</p>
              </div>
            )}

            {/* Hotel */}
            {trip.confirmed_hotel && (
              <div
                className="p-4 rounded-2xl"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
              >
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--accent)' }}>HOTEL</div>
                <div className="font-semibold">{(trip.confirmed_hotel as Hotel).name}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{(trip.confirmed_hotel as Hotel).neighbourhood}</div>
                <div className="text-sm font-bold mt-1">₹{(trip.confirmed_hotel as Hotel).total_per_person.toLocaleString('en-IN')}/person</div>
                <a
                  href={(trip.confirmed_hotel as Hotel).booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 text-center text-xs py-2 rounded-xl"
                  style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
                >
                  Book on MakeMyTrip / Booking.com →
                </a>
              </div>
            )}

            {/* Itinerary */}
            {trip.itinerary && (trip.itinerary as ItineraryDay[]).length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>ITINERARY</div>
                {(trip.itinerary as ItineraryDay[]).map(day => (
                  <div
                    key={day.day}
                    className="p-3 rounded-xl"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>Day {day.day}</span>
                      <span className="text-sm font-semibold">{day.title}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      {day.activities.length} activities · ₹{day.activities.reduce((s, a) => s + (a.cost_per_person ?? 0), 0).toLocaleString('en-IN')}/person
                    </div>
                  </div>
                ))}
              </div>
            ) : trip.status === 'locked' ? null : (
              <div className="p-4 rounded-2xl text-center py-8" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Itinerary will appear after hotel is confirmed.</p>
              </div>
            )}
          </div>
        )}

        {/* ── SQUAD TAB ── */}
        {activeTab === 'squad' && (
          <div className="px-5 pt-2 space-y-4">
            <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>SQUAD LEADERBOARD</div>
            {members
              .filter(m => !['declined', 'dropped'].includes(m.status))
              .sort((a, b) => b.points - a.points)
              .map((m, idx) => {
                const avatarMeta = m.avatar ? AVATAR_META[m.avatar] : null
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`
                const isInactive = m.status === 'invited'
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--card-border)',
                      opacity: isInactive ? 0.5 : 1,
                    }}
                  >
                    <span className="text-lg w-8 text-center flex-shrink-0">{medal}</span>
                    <span className="text-xl flex-shrink-0">{avatarMeta?.icon ?? '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {m.name ?? m.phone}
                        {isInactive && <span className="ml-1 text-xs" style={{ color: 'var(--muted)' }}>Zzz</span>}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        {avatarMeta?.label ?? 'No role'} · {MEMBER_STATUS_LABELS[m.status]?.label}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold" style={{ color: 'var(--accent)' }}>{m.points}</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>pts</div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 safe-bottom"
        style={{ background: 'var(--background)', borderTop: '1px solid var(--card-border)' }}
      >
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors"
              style={{ color: activeTab === tab.id ? 'var(--accent)' : 'var(--muted)' }}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
