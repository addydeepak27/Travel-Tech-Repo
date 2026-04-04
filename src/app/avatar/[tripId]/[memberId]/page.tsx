'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'

const AVATAR_TAGLINES: Record<AvatarType, string> = {
  planner:        'Someone has to be the adult. Congrats, it\'s you. 😅',
  navigator:      'Getting everyone from A to B without losing anyone. No pressure. 🗺️',
  budgeteer:      'You\'ll be everyone\'s favorite person… until the bill arrives. 💸',
  foodie:         'The most important job on any trip. Don\'t let the group eat badly. 🙏',
  adventure_seeker: 'Your job is to make sure everyone has a story to tell. 🤙',
  photographer:   'You\'ll miss the moment, but the group will have the perfect photo of it. 📸',
  spontaneous_one: 'Plan? What plan? You ARE the plan. ✨',
}

const NON_PLANNER_AVATARS: AvatarType[] = [
  'navigator', 'budgeteer', 'foodie', 'adventure_seeker', 'photographer', 'spontaneous_one',
]

const AVATAR_COLORS: Record<AvatarType, { bg: string; border: string; accent: string }> = {
  planner:          { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)', accent: '#7c3aed' },
  navigator:        { bg: 'rgba(5,150,105,0.08)',  border: 'rgba(5,150,105,0.2)',  accent: '#059669' },
  budgeteer:        { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', accent: '#f97316' },
  foodie:           { bg: 'rgba(219,39,119,0.08)', border: 'rgba(219,39,119,0.2)', accent: '#db2777' },
  adventure_seeker: { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)', accent: '#0ea5e9' },
  photographer:     { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)',  accent: '#a855f7' },
  spontaneous_one:  { bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.2)',   accent: '#eab308' },
}

export default function AvatarPage({ params }: { params: Promise<{ tripId: string; memberId: string }> }) {
  const { tripId, memberId } = use(params)
  const router = useRouter()

  const [avatarCounts, setAvatarCounts] = useState<Partial<Record<AvatarType, number>>>({})
  const [selected, setSelected] = useState<AvatarType | null>(null)
  const [tripName, setTripName] = useState('')
  const [organizerAvatar, setOrganizerAvatar] = useState<AvatarType | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
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

        const counts: Partial<Record<AvatarType, number>> = {}
        ;(trip.members ?? [])
          .filter((m: { avatar: string | null; id: string }) => m.avatar && m.id !== memberId)
          .forEach((m: { avatar: string }) => {
            const a = m.avatar as AvatarType
            counts[a] = (counts[a] ?? 0) + 1
          })
        setAvatarCounts(counts)

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

  const availableCount = showAvatars.length

  async function handleSelect(avatar: AvatarType) {
    if (saving) return

    // Expand card on first tap — confirm on second tap of same card
    if (expandedAvatar !== avatar) {
      setExpandedAvatar(avatar)
      return
    }

    setSaving(true)
    setSelected(avatar)
    setSaveError(false)

    try {
      const res = await fetch('/api/member/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, avatar }),
      })
      if (!res.ok) throw new Error('save failed')
      setTimeout(() => router.push(`/preferences/${tripId}/${memberId}`), 500)
    } catch {
      setSaving(false)
      setSelected(null)
      setExpandedAvatar(null)
      setSaveError(true)
    }
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
      <div className="safe-top px-5 pt-8 pb-5 text-center relative overflow-hidden" style={{ background: 'var(--hero-gradient)' }}>
        <div className="absolute top-0 left-1/3 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: '#a78bfa' }} />
        <div className="text-4xl mb-2 relative">🎭</div>
        <h1 className="text-2xl font-black text-white relative">Pick your role</h1>
        <p className="text-sm mt-1.5 relative" style={{ color: 'rgba(255,255,255,0.75)' }}>
          Every person owns a slice of the planning.{' '}
          <span style={{ color: '#fde68a' }}>Roles can be shared.</span>
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
          const count = avatarCounts[key] ?? 0
          const isSelected = selected === key
          const isExpanded = expandedAvatar === key
          const colors = AVATAR_COLORS[key]

          return (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              disabled={saving}
              className="w-full text-left rounded-2xl transition-all overflow-hidden card-elevated"
              style={{
                background: isSelected ? colors.accent : isExpanded ? colors.bg : 'var(--card)',
                border: `1.5px solid ${isSelected || isExpanded ? colors.border : 'var(--card-border)'}`,
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
                    {count > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                      >
                        {count} member{count !== 1 ? 's' : ''}
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
                <span
                  className="text-lg flex-shrink-0 transition-transform"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', color: 'var(--muted)' }}
                >
                  ›
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div
                  className="px-4 pb-4 space-y-3"
                  style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '12px' }}
                >
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                    {meta.description}
                  </p>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.accent }}>
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
                    style={{ background: colors.accent, color: '#fff' }}
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
        {saveError && (
          <p className="text-xs mb-1.5 font-medium" style={{ color: '#ef4444' }}>
            Couldn&apos;t save — check your connection and try again.
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Tap a role to preview → tap again to claim it. Roles can be shared.
        </p>
      </div>
    </div>
  )
}
