'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AVATAR_META, BUDGET_TIER_META } from '@/types'
import type { Trip, Member, MissionTask, ForYouCallout, ItineraryDay, BudgetTier } from '@/types'
import Card from '@/components/Card'
import { getBudgetStats } from '@/lib/budget'
import { assignTasks, DOMAIN_META } from '@/lib/tasks'

// ── Sticky Header — Trip Snapshot ─────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  inviting: 'Inviting',
  avatar_collection: 'Picking roles',
  budget_collection: 'Setting budget',
  destination_vote: 'Voting live',
  destination_vote_pending: 'Vote soon',
  destination_tiebreaker: 'Tied',
  hotel_vote: 'Hotel vote',
  hotel_tiebreaker: 'Tied',
  itinerary_preferences: 'Filling vibes',
  itinerary_vote: 'Final vote',
  locked: 'Locked ✓',
}

const BUDGET_RANGE_COMPACT: Record<string, string> = {
  backpacker: '₹0–50k',
  comfortable: '₹50k–1L',
  premium: '₹1L–5L',
  luxury: '₹5L+',
}

function StickyHeader({
  trip,
  myMember,
  members,
  hypeScore,
  brownieEvents,
}: {
  trip: Trip
  myMember: Member | null
  members: Member[]
  hypeScore: number
  brownieEvents: { event_type: string; points_earned: number }[]
}) {
  const myAvatarMeta = myMember?.avatar ? AVATAR_META[myMember.avatar] : null
  const totalBrownie = brownieEvents.reduce((s, e) => s + e.points_earned, 0)

  // 📍 {destination} ({status})
  const destination = trip.confirmed_destination ?? 'TBD'
  const statusLabel = STATUS_LABELS[trip.status]
  const destinationText = statusLabel ? `${destination} (${statusLabel})` : destination

  // 📅 {dates}
  const dates = trip.departure_date
    ? new Date(trip.departure_date).toLocaleString('en-IN', { month: 'short', year: 'numeric' })
    : null

  // 💸 {budget_range} — prefer tier label, fall back to budget zone
  const budgetRange = (() => {
    if (trip.weighted_median_tier) return BUDGET_RANGE_COMPACT[trip.weighted_median_tier] ?? null
    if (!trip.group_budget_zone) return null
    const { min, max } = trip.group_budget_zone
    if (max > 400000) return '₹5L+'
    const fmt = (n: number) => n >= 100000 ? `₹${n / 100000}L` : `₹${n / 1000}k`
    return `${fmt(min)}–${fmt(max)}`
  })()

  // 🧑‍🤝‍🧑 {active}/{total}
  const activeCount = members.filter(m => m.status === 'active').length
  const totalCount = members.filter(m => !['declined', 'dropped'].includes(m.status)).length

  const pills = [
    { emoji: '📍', text: destinationText },
    dates ? { emoji: '📅', text: dates } : null,
    budgetRange ? { emoji: '💸', text: budgetRange } : null,
    { emoji: '🧑‍🤝‍🧑', text: `${activeCount}/${totalCount}` },
  ].filter(Boolean) as { emoji: string; text: string }[]

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 pt-4 pb-3">
      <div className="flex items-start justify-between">
        <h1 className="text-lg font-bold truncate flex-1 min-w-0 pr-3">{trip.name}</h1>
        {myAvatarMeta && (
          <div className="flex flex-col items-center flex-shrink-0">
            <span className="text-2xl">{myAvatarMeta.icon}</span>
            <span className="text-xs mt-0.5 text-gray-400">{myAvatarMeta.label.replace('The ', '')}</span>
            {totalBrownie > 0 && (
              <span className="text-xs font-semibold mt-0.5" style={{ color: 'var(--accent)' }}>
                🍫 {totalBrownie}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-2 overflow-x-auto pb-0.5 no-scrollbar">
        {pills.map((pill, i) => (
          <div key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 flex-shrink-0 text-xs font-medium text-gray-700">
            <span>{pill.emoji}</span>
            <span>{pill.text}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-2.5">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${hypeScore}%`, background: 'var(--accent)' }} />
        </div>
        <span className="text-xs font-bold" style={{ color: hypeScore > 70 ? 'var(--success)' : 'var(--accent)' }}>
          {hypeScore}% 🔥
        </span>
      </div>
    </div>
  )
}

// ── Locked Banner ─────────────────────────────────────────────────────────────
function LockedBanner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-500">
      <span>🔒</span>
      <span>{label} locked</span>
    </div>
  )
}

// ── Stage helper ──────────────────────────────────────────────────────────────
type Stage = 'preferences' | 'voting' | 'locked'

function getStage(status: Trip['status']): Stage {
  if (status === 'locked') return 'locked'
  if (['destination_vote', 'destination_tiebreaker', 'hotel_vote', 'hotel_tiebreaker', 'itinerary_vote'].includes(status)) return 'voting'
  return 'preferences'
}

// ── Itinerary Card (locked stage) ─────────────────────────────────────────────
function ItineraryCard({
  trip, myMember, forYou,
}: {
  trip: Trip
  myMember: Member | null
  forYou: ForYouCallout[]
}) {
  const [expandedDay, setExpandedDay] = useState<number | null>(0)

  return (
    <div className="space-y-3">
      {trip.confirmed_hotel && (
        <Card title="Where you're staying">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold">{trip.confirmed_hotel.name}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{trip.confirmed_hotel.neighbourhood}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">₹{trip.confirmed_hotel.total_per_person.toLocaleString('en-IN')}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>per person</div>
            </div>
          </div>
          <a
            href={trip.confirmed_hotel.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium"
            style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
          >
            Book on MakeMyTrip / Booking.com →
          </a>
        </Card>
      )}

      {trip.group_budget_zone && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Group budget</span>
            <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
              ₹{trip.group_budget_zone.min.toLocaleString('en-IN')}–₹{trip.group_budget_zone.max.toLocaleString('en-IN')}/person
            </span>
          </div>
        </Card>
      )}

      {trip.itinerary ? (
        <Card title="Day-by-day plan">
          <div className="space-y-2">
            {(trip.itinerary as ItineraryDay[]).map(day => {
              const dayCallout = forYou.find(f => f.day === day.day)
              const isExpanded = expandedDay === day.day
              return (
                <div key={day.day} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left bg-white"
                  >
                    <div>
                      <span className="font-semibold text-sm">Day {day.day}</span>
                      <span className="text-sm ml-2" style={{ color: 'var(--muted)' }}>{day.title}</span>
                    </div>
                    <span style={{ color: 'var(--muted)' }}>{isExpanded ? '↑' : '↓'}</span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 bg-white">
                      {dayCallout && (
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--accent-muted)' }}>
                          <span className="text-sm flex-shrink-0">
                            {myMember?.avatar ? AVATAR_META[myMember.avatar].icon : '👤'}
                          </span>
                          <p className="text-xs leading-snug" style={{ color: 'var(--accent)' }}>{dayCallout.callout}</p>
                        </div>
                      )}
                      {day.activities.map((activity, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="text-xs font-mono w-12 flex-shrink-0 pt-0.5" style={{ color: 'var(--muted)' }}>
                            {activity.time}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{activity.title}</div>
                            <div className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>{activity.description}</div>
                            {activity.cost_per_person != null && activity.cost_per_person > 0 && (
                              <div className="text-xs mt-1 font-medium" style={{ color: 'var(--accent)' }}>
                                ~₹{activity.cost_per_person.toLocaleString('en-IN')}/person
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="py-4 text-center">
            <div className="text-3xl mb-2">🗺</div>
            <p className="font-semibold text-sm">Itinerary coming soon</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Unlocks once hotel is confirmed and preferences are in.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Voting Card (voting stage) ────────────────────────────────────────────────
function VotingCard({ trip, tripId }: { trip: Trip; tripId: string }) {
  const router = useRouter()

  const configs: Partial<Record<Trip['status'], { icon: string; title: string; body: string; cta?: { label: string; href: string } }>> = {
    destination_vote: {
      icon: '🗳',
      title: 'Where should the squad go?',
      body: 'Options are on the table. Vote before the window closes.',
    },
    destination_tiebreaker: {
      icon: '⚖️',
      title: "It's a tie — organizer breaks it",
      body: "Two destinations are neck and neck. Your organizer's deciding.",
    },
    hotel_vote: {
      icon: '🏨',
      title: 'Pick your hotel',
      body: 'AI shortlisted 3 hotels. The top pick wins.',
      cta: { label: 'See hotels & vote →', href: `/hotels/${tripId}` },
    },
    hotel_tiebreaker: {
      icon: '🏨',
      title: 'Hotel tied — organizer decides',
      body: "Two hotels are tied. Your organizer's picking the winner.",
    },
    itinerary_vote: {
      icon: '📋',
      title: 'Vote on the itinerary',
      body: 'AI built the full plan. Approve it to lock in the trip.',
    },
  }

  const config = configs[trip.status]
  if (!config) return null

  const destOptions = Array.isArray(trip.destination_options)
    ? (trip.destination_options as unknown as { name: string; emoji?: string }[])
    : []

  return (
    <Card title="Open vote">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{config.icon}</span>
        <div className="flex-1">
          <div className="font-semibold text-sm">{config.title}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{config.body}</div>

          {trip.status === 'destination_vote' && destOptions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {destOptions.map((d, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'var(--card-border)' }}
                >
                  {d.emoji} {d.name}
                </span>
              ))}
            </div>
          )}

          {config.cta && (
            <button
              onClick={() => router.push(config.cta!.href)}
              className="mt-3 text-sm font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              {config.cta.label}
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

// ── Itinerary Plans Card (itinerary_vote stage) ───────────────────────────────
const PLAN_META: Record<string, { emoji: string }> = {
  Chill:    { emoji: '🏖' },
  Party:    { emoji: '🍻' },
  Balanced: { emoji: '🌿' },
}

function ItineraryPlansCard({
  trip,
  myMember,
  tripId,
}: {
  trip: Trip
  myMember: Member | null
  tripId: string
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [voted, setVoted] = useState<string | null>(null)
  const [voting, setVoting] = useState(false)
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const router = useRouter()

  const plans = trip.itinerary_options
  if (!plans || plans.length === 0) return null

  useEffect(() => {
    fetch(`/api/trip/${tripId}/votes?voteType=itinerary`)
      .then(r => r.json())
      .then((data: { value: string }[]) => {
        const counts: Record<string, number> = {}
        for (const v of data ?? []) counts[v.value] = (counts[v.value] ?? 0) + 1
        setVoteCounts(counts)
        // Pre-fill if myMember already voted
        const myVote = myMember
          ? data.find((v: { member_id?: string; value: string }) =>
              (v as { member_id?: string }).member_id === myMember.id
            )
          : null
        if (myVote) setVoted(myVote.value)
      })
      .catch(() => {})
  }, [tripId, myMember])

  async function handleVote(label: string) {
    if (!myMember || voting || voted) return
    setVoting(true)
    await fetch('/api/trip/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, memberId: myMember.id, voteType: 'itinerary', value: label }),
    })
    // Optimistic update
    setVoted(label)
    setVoteCounts(prev => ({ ...prev, [label]: (prev[label] ?? 0) + 1 }))
    setVoting(false)
    setExpanded(null)  // collapse after voting — the 🔥 badge is now the confirmation
  }

  return (
    <Card title="🗺 Sample plans">
      <div className="space-y-3">
        {plans.map(plan => {
          const meta = PLAN_META[plan.label] ?? { emoji: '📋' }
          const isExpanded = expanded === plan.label
          const isVoted = voted === plan.label

          return (
            <div
              key={plan.label}
              className={`rounded-xl border transition-all ${isVoted ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200' : 'border-gray-100 bg-gray-50'}`}
            >
              <button
                className="w-full flex items-center justify-between px-3 py-3"
                onClick={() => setExpanded(isExpanded ? null : plan.label)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meta.emoji}</span>
                  <span className={`text-sm font-semibold ${isVoted ? 'text-indigo-600' : ''}`}>{plan.label}</span>
                  {isVoted && <span className="text-xs text-indigo-400">✓ Your vote</span>}
                </div>
                <div className="flex items-center gap-2">
                  {(voteCounts[plan.label] ?? 0) > 0 && (
                    <span className="text-xs text-orange-500 font-medium">
                      🔥 {voteCounts[plan.label]}
                    </span>
                  )}
                  <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2">
                  {plan.days.map(day => {
                    const dayCost = day.activities.reduce((s, a) => s + (a.cost_per_person ?? 0), 0)
                    return (
                      <div key={day.day}>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Day {day.day} — {day.title}</p>
                        <ul className="space-y-0.5 mb-1">
                          {day.activities.map((a, i) => (
                            <li key={i} className="text-xs text-gray-600">• {a.title}</li>
                          ))}
                        </ul>
                        <p className="text-xs text-gray-400">💸 ₹{dayCost.toLocaleString('en-IN')}/person</p>
                      </div>
                    )
                  })}

                  {myMember && !voted && (
                    <button
                      onClick={() => handleVote(plan.label)}
                      disabled={voting}
                      className="mt-3 w-full py-2 rounded-xl text-xs font-semibold text-white bg-indigo-500 disabled:opacity-50"
                    >
                      {voting ? 'Voting…' : `Vote for ${plan.label}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Social Proof Card (voting stage) ──────────────────────────────────────────
function SocialProofCard({ members }: { members: Member[] }) {
  const eligible = members.filter(m => !['declined', 'dropped'].includes(m.status))
  const voted = eligible.filter(m => m.status === 'active')
  const waiting = eligible.filter(m => m.status !== 'active')

  return (
    <Card title="Who's voted">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--muted)' }}>Squad progress</span>
          <span className="font-semibold" style={{ color: voted.length === eligible.length ? 'var(--success)' : 'var(--accent)' }}>
            {voted.length}/{eligible.length} voted
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {eligible.map(m => {
            const meta = m.avatar ? AVATAR_META[m.avatar] : null
            const hasVoted = m.status === 'active'
            return (
              <div key={m.id} className="flex flex-col items-center gap-1">
                <div className="relative">
                  <span className="text-2xl">{meta?.icon ?? '👤'}</span>
                  <span className="absolute -bottom-0.5 -right-0.5 text-xs">
                    {hasVoted ? '✅' : '⏳'}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {meta?.label.replace('The ', '') ?? 'Member'}
                </span>
              </div>
            )
          })}
        </div>

        {waiting.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            ⏳ Waiting on {waiting.length} member{waiting.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </Card>
  )
}

// ── Next Move Card (preferences stage) ───────────────────────────────────────
function NextMoveCard({
  trip,
  myMember,
  tripId,
  members,
}: {
  trip: Trip
  myMember: Member | null
  tripId: string
  members: Member[]
}) {
  const router = useRouter()

  const stateConfig: Record<string, { primary: string; supporting: string; linkLabel?: string; linkHref?: string }> = {
    inviting: {
      primary: `Invite your squad (${members.filter(m => m.status !== 'invited').length}/${members.length} joined)`,
      supporting: 'Share the link to get everyone in before the vote opens.',
    },
    avatar_collection: {
      primary: 'Squad is picking roles',
      supporting: 'Everyone is choosing their travel avatar. Check back soon.',
    },
    budget_collection: {
      primary: 'Set your budget',
      supporting: "Helps calculate the group zone once everyone's in.",
    },
    destination_vote: {
      primary: 'Cast your destination vote',
      supporting: 'Vote before the window closes — the majority pick wins.',
    },
    destination_vote_pending: {
      primary: 'Destination vote coming soon',
      supporting: 'Your organizer is finalising the options. Hold tight.',
    },
    destination_tiebreaker: {
      primary: "It's a tie — organizer decides",
      supporting: "Two destinations are neck and neck. Your organizer's breaking the tie.",
    },
    hotel_vote: {
      primary: 'Pick your hotel',
      supporting: 'AI shortlisted 3 options. Your squad votes and the top pick wins.',
      linkLabel: 'See hotels & vote →',
      linkHref: `/hotels/${tripId}`,
    },
    hotel_tiebreaker: {
      primary: 'Hotel tied — organizer decides',
      supporting: "Two hotels are equal. Your organizer's picking the winner.",
    },
    itinerary_preferences: {
      primary: 'Complete preferences (2 min)',
      supporting: 'Helps finalize destination faster',
      linkLabel: 'Fill in your vibe →',
      linkHref: myMember ? `/preferences/${tripId}/${myMember.id}` : undefined,
    },
    itinerary_vote: {
      primary: 'Vote on the itinerary',
      supporting: 'AI built the full plan. Approve it to lock in the trip.',
    },
  }

  const config = stateConfig[trip.status]
  if (!config) return null

  return (
    <Card>
      <p className="text-xs font-medium text-gray-400 mb-2">YOUR NEXT MOVE</p>
      <p className="text-sm font-semibold">👉 {config.primary}</p>
      <p className="text-xs text-gray-400 mt-1 leading-snug">{config.supporting}</p>
      {config.linkHref && (
        <button
          onClick={() => router.push(config.linkHref!)}
          className="mt-3 text-sm font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          {config.linkLabel}
        </button>
      )}
    </Card>
  )
}

// ── Momentum Card ─────────────────────────────────────────────────────────────
const BAR_BLOCKS = 10

function formatTimeLeft(deadlineIso: string | null): string {
  if (!deadlineIso) return ''
  const ms = new Date(deadlineIso).getTime() - Date.now()
  if (ms <= 0) return 'Closed'
  const totalMins = Math.floor(ms / 60000)
  if (totalMins < 60) return `${totalMins}m left`
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h < 24) return m > 0 ? `${h}h ${m}m left` : `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

function MomentumCard({
  trip,
  members,
}: {
  trip: Trip
  members: Member[]
  hypeScore: number
  tripId: string
}) {
  const eligible = members.filter(m => !['declined', 'dropped'].includes(m.status))
  const completed = eligible.filter(m => m.budget_tier !== null).length
  const total = eligible.length

  const filled = total > 0 ? Math.round((completed / total) * BAR_BLOCKS) : 0
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_BLOCKS - filled)

  const timeLeft = formatTimeLeft(trip.questionnaire_deadline_at)

  return (
    <Card>
      <div className="space-y-3">
        <p className="text-base font-semibold">⚡ {completed}/{total}</p>
        <p className="font-mono text-lg tracking-widest text-indigo-500">{bar}</p>
        {timeLeft && (
          <p className="text-xs text-gray-400">⏳ {timeLeft}</p>
        )}
      </div>
    </Card>
  )
}

// ── Budget Split Card ─────────────────────────────────────────────────────────
const TIER_DAILY_COMPACT: Record<BudgetTier, string> = {
  backpacker: '₹1–3k/day',
  comfortable: '₹3–6k/day',
  premium: '₹6–15k/day',
  luxury: '₹15k+/day',
}

const TIER_ORDER: BudgetTier[] = ['backpacker', 'comfortable', 'premium', 'luxury']

function BudgetSplitCard({ trip, members, myMember }: { trip: Trip; members: Member[]; myMember: Member | null }) {
  const eligible = members.filter(m => !['declined', 'dropped'].includes(m.status))
  const stats = getBudgetStats(eligible)
  if (stats.total === 0) return null

  // Rows sorted by tier order (not count) so the display is consistent
  const rows = TIER_ORDER.filter(t => stats.counts[t] > 0)
  // Outlier only when there's a true majority (>50%) — otherwise group just isn't aligned yet
  const isOutlier = myMember?.budget_tier
    && stats.majority
    && myMember.budget_tier !== stats.majority

  return (
    <Card title="💸 Budget split">
      <div className="space-y-2.5">

        {rows.map(tier => {
          const count = stats.counts[tier]
          const isPlurality = tier === stats.plurality && rows.length > 1
          return (
            <div key={tier} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{TIER_DAILY_COMPACT[tier]}</span>
                {isPlurality && <span className="text-sm">🔥</span>}
              </div>
              <span className="text-sm text-gray-400">{count}</span>
            </div>
          )
        })}

        {isOutlier && (
          <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl text-xs bg-amber-50 border border-amber-200">
            <span className="font-medium text-amber-600">
              👀 Most people are in {TIER_DAILY_COMPACT[stats.majority!]}
            </span>
            <span className="text-gray-400">You&apos;re outside this range</span>
          </div>
        )}

        {stats.is_aligned ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
            <span className="text-sm">✅</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-green-700">Budget aligned</p>
              <p className="text-xs text-green-600">⚡ Suggested: {TIER_DAILY_COMPACT[stats.majority!]}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-sm">⚠️</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-700">Budget not aligned yet</p>
              {stats.plurality && (
                <p className="text-xs text-amber-600">⚡ Suggested: {TIER_DAILY_COMPACT[stats.plurality]}</p>
              )}
            </div>
          </div>
        )}
        {trip.group_budget_zone && (
          <LockedBanner label="Budget" />
        )}
      </div>
    </Card>
  )
}

// ── Leaderboard Card ──────────────────────────────────────────────────────────
const RANK_MEDALS = ['🥇', '🥈', '🥉']

function LeaderboardCard({ members, myMember }: { members: Member[]; myMember: Member | null }) {
  const eligible = members.filter(m => !['declined', 'dropped'].includes(m.status))
  const sorted = [...eligible].sort((a, b) => (b.brownie_points ?? 0) - (a.brownie_points ?? 0))

  // "late" = myMember hasn't submitted budget while at least one other person has
  const anySubmitted = eligible.some(m => m.id !== myMember?.id && m.budget_tier !== null)
  const isLate = !!myMember && myMember.budget_tier === null && anySubmitted

  return (
    <Card title="🏆 Leaderboard">
      <div className="-mx-4 -mb-4 overflow-hidden">
        {sorted.map((m, i) => {
          const meta = m.avatar ? AVATAR_META[m.avatar] : null
          const isMe = m.id === myMember?.id
          const rank = RANK_MEDALS[i] ?? `${i + 1}`

          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-indigo-50' : ''}`}
              style={{ borderBottom: i < sorted.length - 1 ? '1px solid #f3f4f6' : undefined }}
            >
              <span className="text-sm font-bold w-5 text-center text-gray-400">{rank}</span>
              <span className="text-xl">{meta?.icon ?? '👤'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-medium truncate ${isMe ? 'text-indigo-600' : ''}`}>
                    {isMe ? 'You' : (meta?.label ?? 'Member')}
                  </span>
                  {isMe && isLate && (
                    <span className="text-xs text-amber-500 shrink-0">(late 😬)</span>
                  )}
                </div>
              </div>
              <span className={`font-bold text-sm shrink-0 ${isMe ? 'text-indigo-500' : 'text-gray-400'}`}>
                {m.brownie_points ?? 0} pts
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Tasks Card ────────────────────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  trip_accepted: 'Said yes to the trip',
  avatar_selected: 'Picked your travel style',
  questionnaire_completed: 'Shared your vibe',
  destination_voted: 'Voted on destination',
  hotel_voted: 'Picked a hotel',
  itinerary_voted: 'Approved the plan',
}

function TasksCard({
  tasks,
  members,
  brownieEvents,
}: {
  tasks: MissionTask[]
  members: Member[]
  brownieEvents: { event_type: string; points_earned: number }[]
}) {
  const statusOrder = { pending: 0, overdue: 1, done: 2, reassigned: 3 }
  const sorted = [...tasks].sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
  const totalBrownie = brownieEvents.reduce((s, e) => s + e.points_earned, 0)

  const avatarSummary = members
    .filter(m => m.avatar)
    .map(m => ({
      avatar: m.avatar!,
      label: AVATAR_META[m.avatar!].label.replace('The ', ''),
      icon: AVATAR_META[m.avatar!].icon,
      isInactive: m.status === 'invited',
    }))

  return (
    <Card title="Your tasks">
      <div className="space-y-4">

        {avatarSummary.length > 0 && (
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>SQUAD STATUS</p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {avatarSummary.map((a, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span className={`text-xl ${a.isInactive ? 'grayscale opacity-40' : ''}`}>{a.icon}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{a.label}</span>
                  {a.isInactive && <span className="text-xs">Zzz</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>
            Tasks unlock when the trip is locked.
          </p>
        ) : (
          <div className="space-y-2">
            {sorted.map(task => <TaskCard key={task.id} task={task} />)}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--accent)' }}>
            🍫 BROWNIE POINTS — {totalBrownie} pts
          </div>
          <div className="space-y-1.5">
            {Object.entries(EVENT_LABELS).map(([type, label]) => {
              const evt = brownieEvents.find(e => e.event_type === type)
              return (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span style={{ color: evt ? 'var(--foreground)' : 'var(--muted)' }}>
                    {evt ? '✅' : '⏳'} {label}
                  </span>
                  <span style={{ color: evt ? 'var(--accent)' : 'var(--muted)' }}>
                    {evt ? `+${evt.points_earned}` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

function TaskCard({ task }: { task: MissionTask }) {
  const statusColors: Record<string, string> = {
    pending: 'var(--accent)',
    done: 'var(--success)',
    overdue: '#ef4444',
    reassigned: 'var(--muted)',
  }
  const statusLabels: Record<string, string> = {
    pending: 'To do',
    done: 'Done ✓',
    overdue: 'Overdue',
    reassigned: 'Reassigned',
  }
  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-semibold text-sm">{task.title}</div>
          <div className="text-xs mt-1 leading-snug" style={{ color: 'var(--muted)' }}>{task.description}</div>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
          style={{ background: `${statusColors[task.status]}20`, color: statusColors[task.status] }}
        >
          {statusLabels[task.status]}
        </span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Due {task.deadline} · +{task.points} pts</span>
        {task.note && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--card-border)', color: 'var(--muted)' }}>
            Note added
          </span>
        )}
      </div>
    </div>
  )
}

// ── Task Assignment Card (locked stage) ───────────────────────────────────────
function TaskAssignmentCard({ members, myMember }: { members: Member[]; myMember: Member | null }) {
  const eligible = members.filter(m => !['declined', 'dropped'].includes(m.status))
  const assignments = assignTasks(eligible)
  if (assignments.length === 0) return null

  return (
    <Card title="🧍 Who's doing what">
      <div className="space-y-2">
        {assignments.map(({ memberId, domain }) => {
          const member = eligible.find(m => m.id === memberId)
          if (!member) return null
          const avatarMeta = member.avatar ? AVATAR_META[member.avatar] : null
          const domainMeta = DOMAIN_META[domain]
          const isMe = member.id === myMember?.id

          return (
            <div
              key={memberId}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${isMe ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{avatarMeta?.icon ?? '👤'}</span>
                <span className={`text-sm font-medium ${isMe ? 'text-indigo-600' : 'text-gray-700'}`}>
                  {isMe ? 'You' : (avatarMeta?.label.replace('The ', '') ?? 'Member')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-300">→</span>
                <span className="text-sm">{domainMeta.emoji}</span>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${isMe ? 'text-indigo-500' : 'text-gray-500'}`}>{domainMeta.label}</p>
                  <p className="text-xs text-gray-400 leading-none">{domainMeta.description}</p>
                </div>
              </div>
            </div>
          )
        })}

        {myMember && (
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-900 text-white mt-1">
            <span className="text-lg flex-shrink-0">👀</span>
            <div>
              <p className="text-xs font-semibold">Locked in — no backing out</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">Your squad is counting on you to own this.</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Sticky CTA ────────────────────────────────────────────────────────────────
function StickyCTA({ label, href }: { label: string; href: string }) {
  const isExternal = href.startsWith('http')
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="flex items-center justify-center w-full py-3.5 rounded-2xl font-semibold text-sm text-white bg-indigo-500"
      >
        {label}
      </a>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function TripDashboard({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [myMember, setMyMember] = useState<Member | null>(null)
  const [tasks, setTasks] = useState<MissionTask[]>([])
  const [forYou, setForYou] = useState<ForYouCallout[]>([])
  const [brownieEvents, setBrownieEvents] = useState<{ event_type: string; points_earned: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(`ts_member_${tripId}`)
    loadData(stored ?? null)
  }, [tripId])

  async function loadData(memberId: string | null) {
    const res = await fetch(`/api/trip/${tripId}/dashboard-info`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()

    const myMemberData = (data.members ?? []).find((m: { id: string }) => m.id === memberId) ?? null
    setTrip(data.trip)
    setMembers(data.members ?? [])
    setMyMember(myMemberData)
    setTasks((data.tasks ?? []).filter((t: { member_id: string }) => t.member_id === memberId))
    setForYou((data.forYou ?? []).filter((f: { member_id: string }) => f.member_id === memberId))
    setBrownieEvents((data.brownieEvents ?? []).filter((e: { member_id: string }) => e.member_id === memberId))
    setLoading(false)
  }

  useEffect(() => {
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
        payload => setTrip(payload.new as Trip))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `trip_id=eq.${tripId}` },
        () => loadData(myMember?.id ?? null))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId, myMember?.id])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-pulse">✈️</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading your trip...</p>
        </div>
      </div>
    )
  }

  if (!trip) return <div className="min-h-dvh flex items-center justify-center"><p>Trip not found</p></div>

  const activeCount = members.filter(m => m.status === 'active').length
  const totalCount = members.filter(m => !['declined', 'dropped'].includes(m.status)).length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const hypeScore = Math.round(
    (activeCount / Math.max(totalCount, 1)) * 50 +
    (doneTasks / Math.max(tasks.length, 1)) * 50
  )

  const stage = getStage(trip.status)

  const ctaConfig = (() => {
    if (!myMember) return null
    switch (trip.status) {
      case 'avatar_collection':
        return ['consented', 'invited'].includes(myMember.status)
          ? { label: 'Pick your role', href: `/avatar/${tripId}/${myMember.id}` }
          : null
      case 'budget_collection':
        return myMember.status === 'avatar_selected'
          ? { label: 'Set your budget', href: `/preferences/${tripId}/${myMember.id}` }
          : null
      case 'hotel_vote':
      case 'hotel_tiebreaker':
        return { label: 'Pick your hotel', href: `/hotels/${tripId}` }
      case 'itinerary_preferences':
        return { label: 'Complete preferences (2 min)', href: `/preferences/${tripId}/${myMember.id}` }
      case 'locked':
        return trip.confirmed_hotel ? { label: 'Book hotel', href: trip.confirmed_hotel.booking_url } : null
      default:
        return null
    }
  })()

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
      <StickyHeader
        trip={trip}
        myMember={myMember}
        members={members}
        hypeScore={hypeScore}
        brownieEvents={brownieEvents}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-4" style={{ paddingBottom: ctaConfig ? 96 : 32 }}>
        {stage === 'preferences' && (
          <>
            <NextMoveCard trip={trip} myMember={myMember} tripId={tripId} members={members} />
            <MomentumCard trip={trip} members={members} hypeScore={hypeScore} tripId={tripId} />
            <BudgetSplitCard trip={trip} members={members} myMember={myMember} />
            <LeaderboardCard members={members} myMember={myMember} />
          </>
        )}

        {stage === 'voting' && (
          <>
            {trip.confirmed_destination && (
              <LockedBanner label={trip.confirmed_destination} />
            )}
            {trip.status === 'itinerary_vote'
              ? <ItineraryPlansCard trip={trip} myMember={myMember} tripId={tripId} />
              : <VotingCard trip={trip} tripId={tripId} />
            }
            <SocialProofCard members={members} />
          </>
        )}

        {stage === 'locked' && (
          <>
            <div className="flex flex-col gap-2 mb-4">
              {trip.confirmed_destination && <LockedBanner label={trip.confirmed_destination} />}
              {trip.confirmed_hotel && <LockedBanner label={(trip.confirmed_hotel as { name: string }).name} />}
            </div>
            <ItineraryCard trip={trip} myMember={myMember} forYou={forYou} />
            <TaskAssignmentCard members={members} myMember={myMember} />
            <TasksCard tasks={tasks} members={members} brownieEvents={brownieEvents} />
          </>
        )}
      </div>

      {ctaConfig && <StickyCTA label={ctaConfig.label} href={ctaConfig.href} />}
    </div>
  )
}
