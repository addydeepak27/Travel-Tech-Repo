'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { AVATAR_META } from '@/types'
import type { Trip, Member, MissionTask, ForYouCallout, ItineraryDay } from '@/types'

type Tab = 'plan' | 'tasks' | 'squad' | 'you'

export default function TripDashboard({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params)
  const [tab, setTab] = useState<Tab>('plan')
  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [myMember, setMyMember] = useState<Member | null>(null)
  const [tasks, setTasks] = useState<MissionTask[]>([])
  const [forYou, setForYou] = useState<ForYouCallout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(`ts_member_${tripId}`)
    if (stored) loadData(stored)
    else loadData(null)
  }, [tripId])

  async function loadData(memberId: string | null) {
    const { data: tripData } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    const { data: membersData } = await supabase
      .from('members')
      .select('*')
      .eq('trip_id', tripId)

    const { data: tasksData } = await supabase
      .from('mission_tasks')
      .select('*')
      .eq('trip_id', tripId)
      .eq('member_id', memberId ?? '')

    const { data: forYouData } = await supabase
      .from('for_you_callouts')
      .select('*')
      .eq('trip_id', tripId)
      .eq('member_id', memberId ?? '')

    setTrip(tripData)
    setMembers(membersData ?? [])
    setMyMember(membersData?.find(m => m.id === memberId) ?? null)
    setTasks(tasksData ?? [])
    setForYou(forYouData ?? [])
    setLoading(false)
  }

  // Real-time updates
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

  const isLocked = trip.status === 'locked'
  const myAvatar = myMember?.avatar
  const myAvatarMeta = myAvatar ? AVATAR_META[myAvatar] : null

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)', paddingBottom: 80 }}>
      {/* Trip header */}
      <div className="safe-top px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{trip.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              {trip.confirmed_destination ?? 'Destination TBD'} · {trip.departure_date ?? 'Dates TBD'}
            </p>
          </div>
          {myAvatarMeta && (
            <div className="flex flex-col items-center">
              <span className="text-2xl">{myAvatarMeta.icon}</span>
              <span className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{myAvatarMeta.label.replace('The ', '')}</span>
            </div>
          )}
        </div>

        {/* Hype score */}
        {isLocked && (
          <HypeScore members={members} tasks={tasks} />
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'plan' && <PlanTab trip={trip} forYou={forYou} myMember={myMember} />}
        {tab === 'tasks' && <TasksTab tasks={tasks} members={members} />}
        {tab === 'squad' && <SquadTab members={members} />}
        {tab === 'you' && <YouTab member={myMember} tasks={tasks} />}
      </div>

      {/* Bottom tab nav */}
      <div
        className="fixed bottom-0 left-0 right-0 safe-bottom"
        style={{ background: 'var(--background)', borderTop: '1px solid var(--card-border)' }}
      >
        <div className="grid grid-cols-4">
          {(['plan', 'tasks', 'squad', 'you'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex flex-col items-center justify-center py-3 gap-1 text-xs font-medium transition-colors"
              style={{ color: tab === t ? 'var(--accent)' : 'var(--muted)' }}
            >
              <span className="text-lg">
                {t === 'plan' ? '🗺' : t === 'tasks' ? '✅' : t === 'squad' ? '👥' : '👤'}
              </span>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function HypeScore({ members, tasks }: { members: Member[]; tasks: MissionTask[] }) {
  const active = members.filter(m => m.status === 'active').length
  const total = members.filter(m => m.status !== 'declined').length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalTasks = tasks.length || 1
  const score = Math.round(((active / Math.max(total, 1)) * 50) + ((doneTasks / totalTasks) * 50))

  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: 'var(--accent)' }} />
      </div>
      <span className="text-sm font-bold" style={{ color: score > 70 ? 'var(--success)' : 'var(--accent)' }}>
        {score}% 🔥
      </span>
    </div>
  )
}

function PlanTab({ trip, forYou, myMember }: { trip: Trip; forYou: ForYouCallout[]; myMember: Member | null }) {
  const [expandedDay, setExpandedDay] = useState<number | null>(0)

  return (
    <div className="px-5 space-y-4 pt-2 pb-4">
      {/* Hotel card */}
      {trip.confirmed_hotel && (
        <div className="p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>WHERE YOU&apos;RE STAYING</div>
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
        </div>
      )}

      {/* Budget zone */}
      {trip.group_budget_zone && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <span className="text-sm font-medium">Group budget</span>
          <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
            ₹{trip.group_budget_zone.min.toLocaleString('en-IN')}–₹{trip.group_budget_zone.max.toLocaleString('en-IN')}/person
          </span>
        </div>
      )}

      {/* Itinerary — locked or blurred */}
      {trip.itinerary ? (
        <div>
          <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--muted)' }}>DAY-BY-DAY PLAN</h2>
          <div className="space-y-2">
            {(trip.itinerary as ItineraryDay[]).map(day => {
              const dayCallout = forYou.find(f => f.day === day.day)
              const isExpanded = expandedDay === day.day

              return (
                <div key={day.day} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                    style={{ background: 'var(--card)' }}
                  >
                    <div>
                      <span className="font-semibold text-sm">Day {day.day}</span>
                      <span className="text-sm ml-2" style={{ color: 'var(--muted)' }}>{day.title}</span>
                    </div>
                    <span style={{ color: 'var(--muted)' }}>{isExpanded ? '↑' : '↓'}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3" style={{ background: 'var(--card)' }}>
                      {/* For You callout */}
                      {dayCallout && (
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--accent-muted)' }}>
                          <span className="text-sm flex-shrink-0">
                            {myMember?.avatar ? AVATAR_META[myMember.avatar].icon : '👤'}
                          </span>
                          <p className="text-xs leading-snug" style={{ color: 'var(--accent)' }}>{dayCallout.callout}</p>
                        </div>
                      )}

                      {/* Activities */}
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
        </div>
      ) : (
        <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="text-3xl mb-3">🗺</div>
          <p className="font-semibold text-sm">Itinerary coming soon</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Unlocks once hotel is confirmed and preferences are in.
          </p>
        </div>
      )}
    </div>
  )
}

function TasksTab({ tasks, members }: { tasks: MissionTask[]; members: Member[] }) {
  const statusOrder = { pending: 0, overdue: 1, done: 2, reassigned: 3 }
  const sorted = [...tasks].sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  // Other avatars' completion summary
  const avatarSummary = members
    .filter(m => m.avatar)
    .map(m => ({
      avatar: m.avatar!,
      label: AVATAR_META[m.avatar!].label.replace('The ', ''),
      icon: AVATAR_META[m.avatar!].icon,
      isInactive: m.status === 'invited',
    }))

  return (
    <div className="px-5 pt-2 pb-4 space-y-4">
      {/* Other avatars' status row */}
      {avatarSummary.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>SQUAD STATUS</p>
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

      {/* My tasks */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>YOUR TASKS</p>
        {sorted.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Tasks unlock when the trip is locked.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
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
    <div className="p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
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
      <div className="flex items-center justify-between mt-3">
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

function SquadTab({ members }: { members: Member[] }) {
  const active = members.filter(m => !['declined', 'dropped'].includes(m.status))
  const sorted = [...active].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))

  return (
    <div className="px-5 pt-2 pb-4 space-y-4">
      {/* Leaderboard */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>LEADERBOARD</p>
        <div className="space-y-2">
          {sorted.map((m, i) => {
            const meta = m.avatar ? AVATAR_META[m.avatar] : null
            const isInactive = m.status === 'invited'

            return (
              <div
                key={m.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)', opacity: isInactive ? 0.5 : 1 }}
              >
                <span className="text-sm font-bold w-5 text-center" style={{ color: 'var(--muted)' }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>
                <span className="text-xl">{meta?.icon ?? '👤'}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{meta?.label ?? 'Member'}</div>
                  {isInactive && <div className="text-xs" style={{ color: 'var(--muted)' }}>Zzz — not responded</div>}
                </div>
                <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{m.points ?? 0} pts</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function YouTab({ member, tasks }: { member: Member | null; tasks: MissionTask[] }) {
  if (!member) return (
    <div className="px-5 pt-6 text-center">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Open this link from the WhatsApp invite to see your profile.</p>
    </div>
  )

  const meta = member.avatar ? AVATAR_META[member.avatar] : null
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalTasks = tasks.length

  return (
    <div className="px-5 pt-2 pb-4 space-y-4">
      {/* Avatar card */}
      <div className="p-5 rounded-2xl text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="text-5xl mb-3">{meta?.icon ?? '👤'}</div>
        <h2 className="font-bold text-lg">{meta?.label ?? 'Member'}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{meta?.description}</p>
        <div className="flex justify-center gap-6 mt-4">
          <div className="text-center">
            <div className="font-bold text-xl" style={{ color: 'var(--accent)' }}>{member.points ?? 0}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>points</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-xl" style={{ color: 'var(--accent)' }}>{doneTasks}/{totalTasks}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>tasks done</div>
          </div>
        </div>
      </div>

      {/* Budget tier */}
      {member.budget_tier && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <span className="text-sm">Your budget tier</span>
          <span className="text-sm font-semibold capitalize">{member.budget_tier}</span>
        </div>
      )}
    </div>
  )
}
