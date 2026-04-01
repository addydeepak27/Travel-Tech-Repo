'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'

export default function AvatarPage({ params }: { params: Promise<{ tripId: string; memberId: string }> }) {
  const { tripId, memberId } = use(params)
  const router = useRouter()
  const [takenAvatars, setTakenAvatars] = useState<AvatarType[]>([])
  const [selected, setSelected] = useState<AvatarType | null>(null)
  const [tripName, setTripName] = useState('')
  const [organizerAvatar, setOrganizerAvatar] = useState<AvatarType | null>(null)
  const [saving, setSaving] = useState(false)
  const [groupSize, setGroupSize] = useState(0)
  const [isOrganizer, setIsOrganizer] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: trip } = await supabase
        .from('trips')
        .select('name, organizer_id, members(avatar, status, id)')
        .eq('id', tripId)
        .single()

      if (!trip) return

      setTripName(trip.name)
      setGroupSize(trip.members?.length ?? 0)

      const taken = (trip.members ?? [])
        .filter((m: { avatar: string | null; id: string }) => m.avatar && m.id !== memberId)
        .map((m: { avatar: string }) => m.avatar as AvatarType)

      setTakenAvatars(taken)

      const org = (trip.members ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
      if (org?.avatar) setOrganizerAvatar(org.avatar as AvatarType)
      if (trip.organizer_id === memberId) setIsOrganizer(true)
    }
    load()
  }, [tripId, memberId])

  const NON_PLANNER_AVATARS: AvatarType[] = ['navigator', 'budgeteer', 'foodie', 'adventure_seeker', 'photographer', 'spontaneous_one']

  const showAvatars = isOrganizer
    ? (Object.keys(AVATAR_META) as AvatarType[])
    : (groupSize <= 3
        ? (['navigator', 'budgeteer', 'foodie'] as AvatarType[])
        : NON_PLANNER_AVATARS)

  async function handleSelect(avatar: AvatarType) {
    if (saving || takenAvatars.includes(avatar)) return
    setSaving(true)
    setSelected(avatar)

    // Conditional update: only succeeds if no other member in this trip has claimed this avatar
    // (for groups > 7 where shared avatars are allowed, the overflow suffix is appended server-side)
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('trip_id', tripId)
      .eq('avatar', avatar)
      .neq('id', memberId)
      .limit(1)

    if (existing && existing.length > 0) {
      // Someone grabbed it just now — refresh taken list and let user pick again
      setTakenAvatars(prev => [...prev, avatar])
      setSelected(null)
      setSaving(false)
      return
    }

    await supabase
      .from('members')
      .update({ avatar, status: 'avatar_selected' })
      .eq('id', memberId)

    setTimeout(() => router.push(`/preferences/${tripId}/${memberId}`), 600)
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="safe-top px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">{tripName}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Pick your role. Each role owns a slice of the planning — tap to see your tasks before committing.
        </p>
        {organizerAvatar && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <span>{AVATAR_META[organizerAvatar].icon}</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {AVATAR_META[organizerAvatar].label} is organising this trip
            </span>
          </div>
        )}
      </div>

      {/* Avatar grid */}
      <div className="flex-1 px-5 pb-6 grid grid-cols-2 gap-3 content-start overflow-y-auto">
        {showAvatars.map(key => {
          const meta = AVATAR_META[key]
          const taken = takenAvatars.includes(key)
          const isSelected = selected === key

          return (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              disabled={taken || saving}
              className="flex flex-col items-start p-3.5 rounded-2xl text-left transition-all relative"
              style={{
                background: taken ? 'var(--card)' : isSelected ? 'var(--accent-muted)' : 'var(--card)',
                border: `1.5px solid ${taken ? 'var(--card-border)' : isSelected ? 'var(--accent)' : 'var(--card-border)'}`,
                opacity: taken ? 0.45 : 1,
              }}
            >
              {taken && (
                <span
                  className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--card-border)', color: 'var(--muted)' }}
                >
                  Taken
                </span>
              )}
              <span className="text-2xl mb-2">{meta.icon}</span>
              <span className="font-semibold text-sm leading-tight">{meta.label}</span>
              <span className="text-xs mt-1 leading-snug" style={{ color: 'var(--muted)' }}>
                {meta.description.split('.')[0]}.
              </span>
              <div className="mt-2.5 space-y-1.5 w-full">
                {meta.key_tasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs" style={{ color: taken ? 'var(--muted)' : 'var(--muted)' }}>
                    <span className="text-xs mt-0.5 flex-shrink-0">•</span>
                    <span className="leading-snug">{t.title}</span>
                    <span className="ml-auto flex-shrink-0 text-xs font-mono" style={{ color: 'var(--accent)' }}>{t.deadline}</span>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <div className="px-5 py-3 safe-bottom text-center">
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Tap a role to confirm. No submit button needed.
          {takenAvatars.length > 0 && ` ${takenAvatars.length} role${takenAvatars.length > 1 ? 's' : ''} already taken.`}
        </p>
      </div>
    </div>
  )
}
