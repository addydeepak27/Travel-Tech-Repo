'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'

const AVATAR_TAGLINES: Record<AvatarType, string> = {
  planner:        'Someone has to be the adult. Congrats, it\'s you. 😅',
  navigator:      'Getting everyone from A to B without losing anyone. No pressure. 🗺️',
  budgeteer:      'You\'ll be everyone\'s favourite person… until the bill arrives. 💸',
  foodie:         'The most important job on any trip. Don\'t let the group eat badly. 🙏',
  adventure_seeker: 'Your job is to make sure everyone has a story to tell. 🤙',
  photographer:   'You\'ll miss the moment, but the group will have the perfect photo of it. 📸',
  spontaneous_one: 'Plan? What plan? You ARE the plan. ✨',
}

const NON_PLANNER_AVATARS: AvatarType[] = [
  'navigator', 'budgeteer', 'foodie', 'adventure_seeker', 'photographer', 'spontaneous_one',
]

export default function AvatarPage({ params }: { params: Promise<{ tripId: string; memberId: string }> }) {
  const { tripId, memberId } = use(params)
  const router = useRouter()

  const [takenAvatars, setTakenAvatars] = useState<AvatarType[]>([])
  const [selected, setSelected] = useState<AvatarType | null>(null)
  const [tripName, setTripName] = useState('')
  const [organizerAvatar, setOrganizerAvatar] = useState<AvatarType | null>(null)
  const [saving, setSaving] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedAvatar, setExpandedAvatar] = useState<AvatarType | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/trip/${tripId}/avatar-info`)
        if (!res.ok) { setLoading(false); return }
        const trip = await res.json()

        setTripName(trip.name)

        const taken = (trip.members ?? [])
          .filter((m: { avatar: string | null; id: string }) => m.avatar && m.id !== memberId)
          .map((m: { avatar: string }) => m.avatar as AvatarType)
        setTakenAvatars(taken)

        const org = (trip.members ?? []).find((m: { id: string }) => m.id === trip.organizer_id)
        if (org?.avatar) setOrganizerAvatar(org.avatar as AvatarType)
        if (trip.organizer_id === memberId) setIsOrganizer(true)
      } catch { /* show page anyway */ }
      setLoading(false)
    }
    load()
  }, [tripId, memberId])

  const showAvatars: AvatarType[] = isOrganizer
    ? (Object.keys(AVATAR_META) as AvatarType[])
    : NON_PLANNER_AVATARS

  const availableCount = showAvatars.filter(a => !takenAvatars.includes(a)).length

  async function handleSelect(avatar: AvatarType) {
    if (saving || takenAvatars.includes(avatar)) return

    // Expand card on first tap — confirm on second tap of same card
    if (expandedAvatar !== avatar) {
      setExpandedAvatar(avatar)
      return
    }

    setSaving(true)
    setSelected(avatar)

    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('trip_id', tripId)
      .eq('avatar', avatar)
      .neq('id', memberId)
      .limit(1)

    if (existing && existing.length > 0) {
      setTakenAvatars(prev => [...prev, avatar])
      setSelected(null)
      setSaving(false)
      setExpandedAvatar(null)
      return
    }

    await supabase
      .from('members')
      .update({ avatar, status: 'avatar_selected' })
      .eq('id', memberId)

    setTimeout(() => router.push(`/preferences/${tripId}/${memberId}`), 500)
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-3xl animate-pulse">🎭</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading your options...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>

      {/* Header */}
      <div className="safe-top px-5 pt-8 pb-4 text-center">
        <div className="text-3xl mb-2">🎭</div>
        <h1 className="text-2xl font-bold">Pick your role</h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
          Every person on this trip owns a slice of the planning.{' '}
          <span style={{ color: 'var(--accent)' }}>
            {availableCount} role{availableCount !== 1 ? 's' : ''} still up for grabs.
          </span>
        </p>
        {organizerAvatar && organizerAvatar !== 'planner' && (
          <div
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
          >
            {AVATAR_META[organizerAvatar].icon} {AVATAR_META[organizerAvatar].label} is already organising this trip
          </div>
        )}
      </div>

      {/* Avatar list */}
      <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto">
        {showAvatars.map(key => {
          const meta = AVATAR_META[key]
          const taken = takenAvatars.includes(key)
          const isSelected = selected === key
          const isExpanded = expandedAvatar === key

          return (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              disabled={taken || saving}
              className="w-full text-left rounded-2xl transition-all overflow-hidden"
              style={{
                background: isSelected
                  ? 'var(--accent)'
                  : isExpanded
                    ? 'var(--accent-muted)'
                    : 'var(--card)',
                border: `1.5px solid ${isSelected || isExpanded ? 'var(--accent)' : taken ? 'var(--card-border)' : 'var(--card-border)'}`,
                opacity: taken ? 0.45 : 1,
              }}
            >
              {/* Always-visible row */}
              <div className="flex items-center gap-3 p-4">
                <span className="text-3xl flex-shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold text-base leading-tight"
                      style={{ color: isSelected ? '#fff' : undefined }}
                    >
                      {meta.label}
                    </span>
                    {taken && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: 'var(--card-border)', color: 'var(--muted)' }}
                      >
                        Taken
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs mt-0.5 leading-snug"
                    style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--muted)' }}
                  >
                    {AVATAR_TAGLINES[key]}
                  </p>
                </div>
                {!taken && (
                  <span
                    className="text-lg flex-shrink-0 transition-transform"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', color: 'var(--muted)' }}
                  >
                    ›
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && !taken && (
                <div
                  className="px-4 pb-4 space-y-3"
                  style={{ borderTop: '1px solid var(--accent)', paddingTop: '12px' }}
                >
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                    {meta.description}
                  </p>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                      Your missions
                    </p>
                    {meta.key_tasks.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span style={{ color: 'var(--accent)' }}>→</span>
                        <span className="flex-1 leading-snug" style={{ color: 'var(--foreground)' }}>{t.title}</span>
                        <span
                          className="flex-shrink-0 text-xs font-mono px-1.5 py-0.5 rounded-md"
                          style={{ background: 'var(--card-border)', color: 'var(--muted)' }}
                        >
                          {t.deadline}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div
                    className="w-full py-3 rounded-xl font-bold text-sm text-center"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {isSelected ? '⏳ Locking you in…' : `I'm the ${meta.label} 🙋`}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="px-5 py-3 safe-bottom text-center">
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Tap a role to preview → tap again to claim it.
          {takenAvatars.length > 0 && ` ${takenAvatars.length} role${takenAvatars.length > 1 ? 's' : ''} already claimed.`}
        </p>
      </div>
    </div>
  )
}
