'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { AVATAR_META, BUDGET_TIER_META } from '@/types'
import type { AvatarType, BudgetTier, Hotel, MissionTask, ItineraryDay } from '@/types'

// ── Deadline display — owns its own timer so Date.now() is never called in render ──
function DeadlineChip({ deadline }: { deadline: string }) {
  const [info, setInfo] = useState<{ label: string; closed: boolean; urgent: boolean } | null>(null)

  useEffect(() => {
    function compute() {
      const ms = new Date(deadline).getTime() - Date.now()
      const closed = ms <= 0
      const urgent = !closed && ms < 3_600_000
      const totalMins = Math.floor(ms / 60000)
      const h = Math.floor(totalMins / 60)
      const d = Math.floor(h / 24)
      const m = totalMins % 60
      const label = closed ? 'Vote closed' : d > 0 ? `${d}d ${h % 24}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`
      setInfo({ label, closed, urgent })
    }
    compute()
    const id = setInterval(compute, 60_000)
    return () => clearInterval(id)
  }, [deadline])

  if (!info) return null
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <span className="text-xs">{info.closed ? '🔒' : info.urgent ? '🔴' : '⏳'}</span>
      <span className="text-xs font-semibold" style={{ color: info.closed ? 'var(--muted)' : info.urgent ? '#ef4444' : '#db2777' }}>
        {info.closed ? 'Vote closed' : `Poll closes in ${info.label}`}
      </span>
    </div>
  )
}

function DeadlineBanner({ deadline }: { deadline: string }) {
  const [info, setInfo] = useState<{ label: string; closed: boolean; urgent: boolean } | null>(null)

  useEffect(() => {
    function compute() {
      const ms = new Date(deadline).getTime() - Date.now()
      const closed = ms <= 0
      const urgent = !closed && ms < 3_600_000
      const totalMins = Math.floor(ms / 60000)
      const h = Math.floor(totalMins / 60)
      const d = Math.floor(h / 24)
      const m = totalMins % 60
      const label = closed ? 'Vote deadline passed' : d > 0 ? `${d}d ${h % 24}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`
      setInfo({ label, closed, urgent })
    }
    compute()
    const id = setInterval(compute, 60_000)
    return () => clearInterval(id)
  }, [deadline])

  if (!info) return null
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-2xl"
      style={{
        background: info.closed ? 'rgba(100,116,139,0.08)' : info.urgent ? 'rgba(239,68,68,0.08)' : 'rgba(219,39,119,0.08)',
        border: `1.5px solid ${info.closed ? 'var(--card-border)' : info.urgent ? 'rgba(239,68,68,0.3)' : 'rgba(219,39,119,0.25)'}`,
      }}
    >
      <span className="text-xl flex-shrink-0">{info.closed ? '🔒' : info.urgent ? '🔴' : '⏳'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: info.closed ? 'var(--muted)' : info.urgent ? '#ef4444' : '#db2777' }}>
          {info.label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          {new Date(deadline).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

interface TripMember {
  id: string
  phone: string
  name: string | null
  email: string
  avatar: AvatarType | null
  avatar_suffix: string | null
  budget_tier: BudgetTier | null
  status: string
  points: number
  brownie_points: number
  joined_at: string | null
  opt_out: boolean
}

interface TripData {
  id: string
  name: string
  status: string
  organizer_id: string
  travel_code: string
  destination_options: { name: string; emoji?: string }[] | string[]
  confirmed_destination: string | null
  confirmed_hotel: Hotel | null
  hotel_options: Hotel[] | null
  itinerary: ItineraryDay[] | null
  departure_date: string | null
  group_budget_zone: { min: number; max: number } | null
  weighted_median_tier: BudgetTier | null
  gamification_enabled: boolean
  vote_deadline: string | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  inviting: 'Inviting',
  avatar_collection: 'Picking roles',
  budget_collection: 'Setting budgets',
  destination_vote: 'Voting: destination',
  hotel_vote: 'Voting: hotel',
  itinerary_preferences: 'Filling preferences',
  itinerary_vote: 'Voting: itinerary',
  locked: 'Locked ✓',
  cancelled: 'Cancelled',
}

const MEMBER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  invited:          { label: 'Invited',    color: 'var(--muted)' },
  consented:        { label: 'Joined',     color: 'var(--accent)' },
  avatar_selected:  { label: 'Role set',   color: 'var(--accent)' },
  budget_submitted: { label: 'Budget in',  color: 'var(--success)' },
  active:           { label: 'Active',     color: 'var(--success)' },
  declined:         { label: 'Declined',   color: '#ef4444' },
  dropped:          { label: 'Dropped',    color: '#ef4444' },
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: 'var(--muted)' }}>
      {children}
    </p>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex-1 flex flex-col items-center py-3 rounded-2xl bg-white" style={{ border: '1px solid var(--card-border)' }}>
      <span className="text-xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{label}</span>
    </div>
  )
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
  const [activeTab, setActiveTab] = useState<'monitor' | 'tasks' | 'plan' | 'squad'>('monitor')
  const [organizerId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(`ts_member_${tripId}`) : null
  )
  const [nudgingIds, setNudgingIds] = useState<Set<string>>(new Set())
  const [tipsVisible, setTipsVisible] = useState(false)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyInviteLink() {
    const url = `${window.location.origin}/join/${tripId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // fallback for older browsers
      const el = document.createElement('input')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {

    async function load() {
      try {
        const res = await fetch(`/api/trip/${tripId}/organizer-info`)
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()

        setTrip(data.trip)
        setMembers(data.members ?? [])
        setTasks(data.tasks ?? [])
        setVotes(data.votes ?? [])

        const membersData: TripMember[] = data.members ?? []
        const tierValues: Record<string, number> = { backpacker: 1, comfortable: 2, premium: 3, luxury: 4 }
        const submitted = membersData.filter(m => m.budget_tier)
        if (submitted.length >= 2) {
          const vals = submitted.map(m => tierValues[m.budget_tier!] ?? 0)
          const spread = Math.max(...vals) - Math.min(...vals)
          if (spread >= 2) {
            setBudgetAlert(`Wide budget gap in the squad. ${submitted.filter(m => (tierValues[m.budget_tier!] ?? 0) <= 1).length} members may find the plan a stretch — consider a check-in.`)
          }
        }
      } catch { /* fall through — trip state stays null, shows error screen */ }
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`organizer-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `trip_id=eq.${tripId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_tasks', filter: `trip_id=eq.${tripId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `trip_id=eq.${tripId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId, organizerId])

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
    if (nudgingIds.has(memberId)) return
    // Use trip.organizer_id from API (not localStorage) so nudge always works
    const realOrganizerId = trip?.organizer_id ?? organizerId
    if (!realOrganizerId) return
    setNudgingIds(prev => new Set(prev).add(memberId))
    await fetch('/api/organizer/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, memberId, organizerId: realOrganizerId }),
    })
    setTimeout(() => setNudgingIds(prev => { const s = new Set(prev); s.delete(memberId); return s }), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center space-y-2">
          <div className="text-4xl animate-pulse">📋</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading organizer view…</p>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-5 text-center" style={{ background: 'var(--background)' }}>
        <p style={{ color: 'var(--muted)' }}>Trip not found.</p>
      </div>
    )
  }


  const activeMembers = members.filter(m => ['consented', 'avatar_selected', 'budget_submitted', 'active'].includes(m.status))
  const nonResponders = members.filter(m => m.status === 'invited')
  const organizerMember = members.find(m => m.id === trip.organizer_id) ?? null
  const organizerNeedsPrefs = organizerMember?.budget_tier === null

  // Non-planner role claim map (planner is always the organiser's role)
  const NON_PLANNER_ROLES: AvatarType[] = ['navigator', 'budgeteer', 'foodie', 'adventure_seeker', 'photographer', 'spontaneous_one']
  const avatarClaimMap = new Map<AvatarType, TripMember[]>()
  for (const m of members) {
    if (!m.avatar || m.avatar === 'planner') continue
    const key = m.avatar as AvatarType
    if (!avatarClaimMap.has(key)) avatarClaimMap.set(key, [])
    avatarClaimMap.get(key)!.push(m)
  }
  const claimedCount = avatarClaimMap.size

  const currentVoteType = trip.status === 'destination_vote' ? 'destination'
    : trip.status === 'hotel_vote' ? 'hotel'
    : trip.status === 'itinerary_vote' ? 'itinerary'
    : null
  const currentVotes = currentVoteType ? votes.filter(v => v.vote_type === currentVoteType) : []
  const voteTally: Record<string, number> = {}
  for (const v of currentVotes) { voteTally[v.value] = (voteTally[v.value] ?? 0) + 1 }

  const todayStr = new Date().toISOString().split('T')[0]
  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const overdueTasks = tasks.filter(t => t.status === 'pending' && t.deadline < todayStr)

  const tabs: { id: 'monitor' | 'tasks' | 'plan' | 'squad'; emoji: string; label: string }[] = [
    { id: 'monitor', emoji: '👁', label: 'Monitor' },
    { id: 'tasks',   emoji: '✅', label: 'Tasks' },
    { id: 'plan',    emoji: '🗺', label: 'Plan' },
    { id: 'squad',   emoji: '👥', label: 'Squad' },
  ]

  const memberLabel = (m: TripMember) => m.name || m.email || m.phone || 'Member'

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>

      {/* ── Header ── */}
      <div className="px-5 pt-6 pb-4 bg-white" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight truncate" style={{ color: 'var(--foreground)' }}>{trip.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                {STATUS_LABELS[trip.status] ?? trip.status}
              </span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {activeMembers.length} active · {members.length} total
              </span>
            </div>
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{ background: 'var(--card-border)', color: 'var(--muted)' }}>
            Organiser
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.round((activeMembers.length / Math.max(members.length, 1)) * 100)}%`,
              background: 'linear-gradient(90deg, #7c3aed, #db2777)',
            }}
          />
        </div>

        {/* Vote deadline inline chip */}
        {trip.vote_deadline && <DeadlineChip deadline={trip.vote_deadline} />}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 80 }}>

        {/* MONITOR */}
        {activeTab === 'monitor' && (
          <div className="px-5 pt-5 space-y-5">

            {/* Vote deadline banner */}
            {trip.vote_deadline && <DeadlineBanner deadline={trip.vote_deadline} />}

            {/* Invite & share card — always visible */}
            <div className="p-4 rounded-2xl bg-white" style={{ border: '1.5px solid var(--accent)', background: 'rgba(124,58,237,0.03)' }}>
              <p className="text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: 'var(--accent)' }}>Share with your squad</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-black tracking-widest" style={{ color: 'var(--foreground)', fontFamily: 'monospace' }}>{trip.travel_code}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>Travel code</span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                Share the link below or give them the code to enter at the home page.
              </p>
              <button
                onClick={copyInviteLink}
                className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: copied ? 'var(--success)' : 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff' }}
              >
                {copied ? '✓ Copied!' : 'Copy invite link'}
              </button>
            </div>

            {/* Organiser needs to fill their own preferences */}
            {organizerNeedsPrefs && (trip?.organizer_id ?? organizerId) && (
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(217,119,6,0.08)', border: '1.5px solid rgba(217,119,6,0.3)' }}>
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">📝</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">You haven&apos;t filled your preferences</p>
                    <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--muted)' }}>
                      Your budget + vibe feeds into the group plan. Takes 60 seconds.
                    </p>
                    <a
                      href={`/preferences/${tripId}/${trip?.organizer_id ?? organizerId}`}
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold"
                      style={{ background: '#d97706', color: '#fff' }}
                    >
                      Fill my preferences →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Budget alert */}
            {budgetAlert && !alertDismissed && (
              <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)' }}>
                <span className="text-lg flex-shrink-0">⚠️</span>
                <p className="flex-1 text-xs leading-relaxed" style={{ color: '#92400e' }}>{budgetAlert}</p>
                <button
                  onClick={() => setAlertDismissed(true)}
                  className="flex-shrink-0 text-xs"
                  style={{ color: 'var(--muted)', minHeight: 'unset', minWidth: 'unset' }}
                >✕</button>
              </div>
            )}

            {/* Task summary pills */}
            {tasks.length > 0 && (
              <div className="flex gap-2">
                <StatPill value={doneTasks.length}    label="Done"    color="var(--success)" />
                <StatPill value={pendingTasks.length - overdueTasks.length} label="Pending" color="var(--accent)" />
                <StatPill value={overdueTasks.length} label="Overdue" color="#ef4444" />
              </div>
            )}

            {/* Budget zone */}
            {trip.group_budget_zone && (
              <div className="p-4 rounded-2xl bg-white" style={{ border: '1px solid var(--card-border)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>Group budget</span>
                  {tips.length > 0 && (
                    <button
                      onClick={() => setTipsVisible(v => !v)}
                      className="text-xs font-medium"
                      style={{ color: 'var(--accent)', minHeight: 'unset', minWidth: 'unset' }}
                    >
                      {tipsVisible ? 'Hide tips ↑' : '3 ways to save ↓'}
                    </button>
                  )}
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                  ₹{trip.group_budget_zone.min.toLocaleString('en-IN')}–₹{trip.group_budget_zone.max.toLocaleString('en-IN')}
                  <span className="text-sm font-normal ml-1" style={{ color: 'var(--muted)' }}>/person</span>
                </p>
                {trip.weighted_median_tier && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {BUDGET_TIER_META[trip.weighted_median_tier].label} · {BUDGET_TIER_META[trip.weighted_median_tier].description}
                  </p>
                )}
                {tipsVisible && tips.length > 0 && (
                  <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                    {tips.map((tip, i) => (
                      <div key={i}>
                        <p className="text-xs font-semibold">{tip.title}</p>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>{tip.tip}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live vote tally */}
            {currentVoteType && Object.keys(voteTally).length > 0 && (
              <div>
                <SectionLabel>Live vote — {currentVoteType}</SectionLabel>
                <div className="p-4 rounded-2xl bg-white space-y-3" style={{ border: '1px solid var(--card-border)' }}>
                  {Object.entries(voteTally).sort(([, a], [, b]) => b - a).map(([option, count]) => {
                    const pct = activeMembers.length > 0 ? Math.round((count / activeMembers.length) * 100) : 0
                    return (
                      <div key={option}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{option}</span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{count}/{activeMembers.length}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                          <div className="h-full rounded-full transition-all" style={{ background: 'var(--accent)', width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-xs pt-1" style={{ color: 'var(--muted)' }}>
                    {currentVotes.length}/{activeMembers.length} voted · {activeMembers.length - currentVotes.length} pending
                  </p>
                </div>
              </div>
            )}

            {/* Avatar claims — non-planner roles only */}
            <div>
              <SectionLabel>Roles claimed ({claimedCount}/6)</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {NON_PLANNER_ROLES.map(key => {
                  const meta = AVATAR_META[key]
                  const claimants = avatarClaimMap.get(key) ?? []
                  const claimed = claimants.length > 0
                  return (
                    <div
                      key={key}
                      className="flex items-start gap-2.5 p-3 rounded-2xl bg-white transition-opacity"
                      style={{
                        border: `1.5px solid ${claimed ? 'var(--accent)' : 'var(--card-border)'}`,
                        opacity: claimed ? 1 : 0.4,
                      }}
                    >
                      <span className="text-2xl flex-shrink-0 mt-0.5">{meta.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{meta.label.replace('The ', '')}</p>
                        {claimed ? (
                          <div className="mt-0.5 space-y-0.5">
                            {claimants.map(c => (
                              <p key={c.id} className="text-xs font-medium truncate" style={{ color: 'var(--success)' }}>
                                ✓ {c.name || c.email?.split('@')[0] || 'Member'}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Open</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Waiting to respond */}
            {nonResponders.length > 0 && (
              <div>
                <SectionLabel>Waiting to respond ({nonResponders.length})</SectionLabel>
                <div className="space-y-2">
                  {nonResponders.map(m => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white"
                      style={{ border: '1px solid var(--card-border)' }}
                    >
                      <div>
                        <p className="text-sm font-medium">{memberLabel(m)}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Invite sent · no response</p>
                      </div>
                      <button
                        onClick={() => nudge(m.id)}
                        disabled={nudgingIds.has(m.id)}
                        className="text-xs px-4 py-2 rounded-xl font-semibold transition-all flex-shrink-0"
                        style={{ background: 'var(--accent)', color: '#fff', opacity: nudgingIds.has(m.id) ? 0.6 : 1 }}
                      >
                        {nudgingIds.has(m.id) ? '✓ Sent' : 'Nudge'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action needed */}
            {activeMembers.filter(m => m.status !== 'active').length > 0 && (
              <div>
                <SectionLabel>Action needed</SectionLabel>
                <div className="space-y-2">
                  {activeMembers.filter(m => m.status !== 'active').map(m => {
                    const statusInfo = MEMBER_STATUS_LABELS[m.status]
                    const hint = m.status === 'consented' ? "Hasn't picked a role yet" : m.status === 'avatar_selected' ? "Hasn't submitted budget" : 'In progress'
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white"
                        style={{ border: '1px solid var(--card-border)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {m.avatar && <span>{AVATAR_META[m.avatar]?.icon}</span>}
                            <span className="text-sm font-medium truncate">{memberLabel(m)}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-muted)', color: statusInfo?.color ?? 'var(--muted)' }}>
                              {statusInfo?.label}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{hint}</p>
                        </div>
                        <button
                          onClick={() => nudge(m.id)}
                          disabled={nudgingIds.has(m.id)}
                          className="flex-shrink-0 text-xs px-3 py-2 rounded-xl font-medium ml-2"
                          style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
                        >
                          {nudgingIds.has(m.id) ? '✓' : 'Nudge'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Confirmed */}
            {trip.confirmed_destination && (
              <div>
                <SectionLabel>Confirmed</SectionLabel>
                <div className="p-4 rounded-2xl bg-white space-y-2" style={{ border: '1px solid var(--card-border)' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">📍</span>
                    <span className="text-sm font-semibold">{trip.confirmed_destination}</span>
                  </div>
                  {trip.confirmed_hotel && (
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🏨</span>
                      <span className="text-sm">{(trip.confirmed_hotel as Hotel).name}</span>
                    </div>
                  )}
                  {trip.departure_date && (
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">📅</span>
                      <span className="text-sm">{new Date(trip.departure_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TASKS */}
        {activeTab === 'tasks' && (
          <div className="px-5 pt-5 space-y-3">
            <SectionLabel>All tasks · {tasks.length} total</SectionLabel>
            {tasks.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-4xl mb-3">📝</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Tasks unlock when the itinerary is locked.</p>
              </div>
            ) : (
              tasks.map(task => {
                const isOverdue = task.status === 'pending' && task.deadline < todayStr
                const member = members.find(m => m.id === task.member_id)
                const avatarMeta = task.avatar ? AVATAR_META[task.avatar as AvatarType] : null
                return (
                  <div
                    key={task.id}
                    className="p-4 rounded-2xl bg-white"
                    style={{ border: `1px solid ${isOverdue ? '#fca5a5' : 'var(--card-border)'}` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {avatarMeta && <span className="text-sm">{avatarMeta.icon}</span>}
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{avatarMeta?.label}</span>
                          {member && <span className="text-xs" style={{ color: 'var(--muted)' }}>· {memberLabel(member)}</span>}
                        </div>
                        <p className="text-sm font-semibold leading-snug">{task.title}</p>
                        {task.note && (
                          <p className="text-xs mt-1.5 px-2.5 py-2 rounded-xl" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                            💬 {task.note}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{
                            background: task.status === 'done' ? 'rgba(22,163,74,0.12)' : isOverdue ? 'rgba(239,68,68,0.12)' : 'var(--card-border)',
                            color: task.status === 'done' ? 'var(--success)' : isOverdue ? '#ef4444' : 'var(--muted)',
                          }}
                        >
                          {task.status === 'done' ? 'Done' : isOverdue ? 'Overdue' : 'Pending'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          {new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>+{task.points}pts</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* PLAN */}
        {activeTab === 'plan' && (
          <div className="px-5 pt-5 space-y-4">
            {trip.confirmed_destination ? (
              <div className="p-4 rounded-2xl bg-white" style={{ border: '1px solid var(--card-border)' }}>
                <p className="text-xs font-semibold tracking-wide uppercase mb-1" style={{ color: 'var(--accent)' }}>Destination</p>
                <p className="text-xl font-bold">{trip.confirmed_destination}</p>
              </div>
            ) : trip.status === 'destination_vote' ? (
              <div className="p-6 rounded-2xl bg-white text-center" style={{ border: '1px solid var(--card-border)' }}>
                <p className="text-3xl mb-2">🗳</p>
                <p className="text-sm font-medium">Destination vote in progress</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Results lock at 70% participation or deadline</p>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-white text-center" style={{ border: '1px solid var(--card-border)' }}>
                <p className="text-3xl mb-2">👥</p>
                <p className="text-sm font-medium">Gathering the squad first</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {['inviting','avatar_collection','budget_collection'].includes(trip.status)
                    ? 'Destination voting opens once everyone has filled their preferences.'
                    : 'Trip is being set up.'}
                </p>
              </div>
            )}

            {trip.confirmed_hotel && (
              <div className="p-4 rounded-2xl bg-white" style={{ border: '1px solid var(--card-border)' }}>
                <p className="text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: 'var(--accent)' }}>Hotel</p>
                <p className="font-semibold">{(trip.confirmed_hotel as Hotel).name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{(trip.confirmed_hotel as Hotel).neighbourhood}</p>
                <p className="text-base font-bold mt-1">₹{(trip.confirmed_hotel as Hotel).total_per_person.toLocaleString('en-IN')}/person</p>
                <a
                  href={(trip.confirmed_hotel as Hotel).booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center py-2.5 rounded-xl text-xs font-medium"
                  style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
                >
                  Book on MakeMyTrip / Booking.com →
                </a>
              </div>
            )}

            {trip.itinerary && (trip.itinerary as ItineraryDay[]).length > 0 ? (
              <div>
                <SectionLabel>Itinerary</SectionLabel>
                <div className="space-y-2">
                  {(trip.itinerary as ItineraryDay[]).map(day => (
                    <div
                      key={day.day}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-white"
                      style={{ border: '1px solid var(--card-border)' }}
                    >
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>Day {day.day}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{day.title}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {day.activities.length} activities · ₹{day.activities.reduce((s, a) => s + (a.cost_per_person ?? 0), 0).toLocaleString('en-IN')}/person
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : trip.confirmed_destination ? (
              <div className="p-6 rounded-2xl bg-white text-center" style={{ border: '1px solid var(--card-border)' }}>
                <p className="text-3xl mb-2">🏨</p>
                <p className="text-sm font-medium">
                  {trip.status === 'hotel_vote' ? 'Hotel vote in progress' : 'Itinerary coming soon'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {trip.status === 'hotel_vote' ? 'Results lock at 70% participation or deadline' : 'Unlocks after hotel is confirmed'}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* SQUAD */}
        {activeTab === 'squad' && (
          <div className="px-5 pt-5 space-y-3">
            <SectionLabel>Squad · {members.filter(m => !['declined','dropped'].includes(m.status)).length} members</SectionLabel>
            {members
              .filter(m => !['declined', 'dropped'].includes(m.status))
              .sort((a, b) => (b.brownie_points ?? 0) - (a.brownie_points ?? 0))
              .map((m, idx) => {
                const avatarMeta = m.avatar ? AVATAR_META[m.avatar] : null
                const isInactive = m.status === 'invited'
                const pts = m.brownie_points ?? 0
                const medal = pts > 0 ? (idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`) : `${idx + 1}`
                const statusInfo = MEMBER_STATUS_LABELS[m.status]
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white"
                    style={{ border: '1px solid var(--card-border)', opacity: isInactive ? 0.5 : 1 }}
                  >
                    {/* Rank */}
                    <span className="text-lg w-7 text-center flex-shrink-0">{medal}</span>

                    {/* Avatar icon */}
                    <span className="text-2xl flex-shrink-0">{avatarMeta?.icon ?? '👤'}</span>

                    {/* Name + role + status */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {memberLabel(m)}
                        {isInactive && <span className="ml-1 text-xs" style={{ color: 'var(--muted)' }}>Zzz</span>}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          {avatarMeta?.label.replace('The ', '') ?? 'No role'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--card-border)' }}>·</span>
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            background: 'var(--accent-muted)',
                            color: statusInfo?.color ?? 'var(--muted)',
                          }}
                        >
                          {statusInfo?.label ?? m.status}
                        </span>
                      </div>
                    </div>

                    {/* Brownie points — matches user dashboard format */}
                    <div className="text-right flex-shrink-0 min-w-[48px]">
                      <p className="text-base font-bold" style={{ color: pts > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                        {pts}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>🍫 pts</p>
                    </div>
                  </div>
                )
              })}

            {/* Brownie points legend — same as user dashboard */}
            {(() => {
              const squadSize = members.filter(m => !['declined', 'dropped'].includes(m.status)).length
              return (
                <div className="p-3 rounded-2xl bg-white mt-2" style={{ border: '1px solid var(--card-border)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--accent)' }}>HOW POINTS WORK</p>
                  <div className="space-y-1">
                    {[
                      'Accepted the invite',
                      'Picked their role',
                      'Shared their vibe',
                      'Voted on destination',
                      'Picked a hotel',
                      'Approved the plan',
                    ].map(label => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--muted)' }}>{label}</span>
                        <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                          +{squadSize} pts
                          {squadSize > 1 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (last: +1)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                    Each action is independent — first to do it earns +{squadSize} pts, last earns +1 pt.
                  </p>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── Bottom tab bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 safe-bottom"
        style={{ background: 'white', borderTop: '1px solid var(--card-border)' }}
      >
        <div className="flex">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3"
                style={{ minHeight: 56 }}
              >
                <span
                  className="flex items-center justify-center w-10 h-7 rounded-full text-lg transition-all"
                  style={{ background: isActive ? 'var(--accent-muted)' : 'transparent' }}
                >
                  {tab.emoji}
                </span>
                <span
                  className="text-xs font-medium transition-colors"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--muted)' }}
                >
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
