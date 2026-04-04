'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'

export default function JoinPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params)
  const searchParams = useSearchParams()
  const memberId = searchParams.get('m')
  const router = useRouter()

  const [tripName, setTripName] = useState('')
  const [destinations, setDestinations] = useState<{ name: string; emoji?: string }[]>([])
  const [organizerAvatar, setOrganizerAvatar] = useState<AvatarType | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [alreadyResponded, setAlreadyResponded] = useState<'in' | 'out' | null>(null)
  const [selfEmail, setSelfEmail] = useState('')
  const [selfEmailLookingUp, setSelfEmailLookingUp] = useState(false)
  const [selfEmailError, setSelfEmailError] = useState('')

  useEffect(() => {
    async function load(attempt = 0) {
      try {
        const res = await fetch(`/api/trip/${tripId}/join-info`)
        if (!res.ok) {
          if (attempt < 2) { setTimeout(() => load(attempt + 1), 800); return }
          setLoadError(true); setLoading(false); return
        }
        const data = await res.json()

        setTripName(data.name)

        // destination_options is JSONB: array of { name, emoji } objects or plain strings
        const dests = (data.destination_options ?? []).map((d: { name?: string; emoji?: string } | string) =>
          typeof d === 'string' ? { name: d } : { name: d.name ?? '', emoji: d.emoji }
        )
        setDestinations(dests)
        setMemberCount((data.members ?? []).filter((m: { status: string }) => !['declined', 'dropped'].includes(m.status)).length)

        const org = data.members?.find((m: { id: string }) => m.id === data.organizer_id)
        if (org?.avatar) setOrganizerAvatar(org.avatar as AvatarType)

        // Check if this member already responded
        if (memberId) {
          const me = data.members?.find((m: { id: string }) => m.id === memberId)
          if (me?.opt_out) {
            setAlreadyResponded('out')
            setLoading(false)
            return
          }
          if (me?.status === 'consented' || me?.status === 'avatar_selected' || me?.status === 'budget_submitted' || me?.status === 'active') {
            setAlreadyResponded('in')
          } else if (me?.status === 'declined') {
            setAlreadyResponded('out')
          }
        }
      } catch {
        if (attempt < 2) { setTimeout(() => load(attempt + 1), 800); return }
        setLoadError(true)
      }
      setLoading(false)
    }
    load(0)
  }, [tripId, memberId, retryCount])

  const selfEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selfEmail)

  async function handleSelfJoin() {
    if (!selfEmailValid || selfEmailLookingUp) return
    setSelfEmailLookingUp(true)
    setSelfEmailError('')
    try {
      const res = await fetch(`/api/trip/${tripId}/self-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selfEmail }),
      })
      if (res.status === 403) {
        setSelfEmailError("You've declined this trip. Ask the organiser to re-invite you.")
        setSelfEmailLookingUp(false)
        return
      }
      if (!res.ok) {
        setSelfEmailError('Something went wrong — try again.')
        setSelfEmailLookingUp(false)
        return
      }
      const { memberId: mid } = await res.json()
      // Redirect to personalised link — this re-renders the page with ?m= param
      window.location.href = `/join/${tripId}?m=${mid}`
    } catch {
      setSelfEmailError('Network error — check your connection and try again.')
      setSelfEmailLookingUp(false)
    }
  }

  async function handleConsent(choice: 'in' | 'out') {
    if (responding || !memberId) return
    setResponding(true)

    try {
      const res = await fetch(`/api/trip/${tripId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, choice }),
      })

      if (!res.ok) {
        setResponding(false)
        return
      }

      if (choice === 'in') {
        try { localStorage.setItem(`ts_member_${tripId}`, memberId) } catch { /* quota/private mode */ }
        router.push(`/avatar/${tripId}/${memberId}`)
      } else {
        setAlreadyResponded('out')
        setResponding(false)
      }
    } catch {
      setResponding(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-3xl animate-pulse">✈️</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading trip details...</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-5 text-center safe-top safe-bottom">
        <div className="text-4xl mb-4">🔍</div>
        <h1 className="text-xl font-bold mb-2">Trip not found</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
          This invite link may be invalid or expired. Ask the organiser to share a fresh link.
        </p>
        <button
          onClick={() => { setLoadError(false); setLoading(true); setRetryCount(c => c + 1) }}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          Try again
        </button>
      </div>
    )
  }

  if (alreadyResponded === 'out') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-5 text-center safe-top safe-bottom">
        <div className="text-4xl mb-4">👋</div>
        <h1 className="text-xl font-bold mb-2">No worries</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          You&apos;ve declined the invite for <strong>{tripName}</strong>. The group will miss you.
        </p>
        <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>
          Changed your mind? Ask the organiser to re-invite you.
        </p>
      </div>
    )
  }

  if (alreadyResponded === 'in') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-5 text-center safe-top safe-bottom">
        <div className="text-4xl mb-4">🙌</div>
        <h1 className="text-xl font-bold mb-2">You&apos;re already in!</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          You&apos;ve already joined <strong>{tripName}</strong>.
        </p>
        <button
          onClick={() => router.push(`/trip/${tripId}`)}
          className="px-6 py-3 rounded-2xl font-semibold text-sm"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          View Trip Dashboard →
        </button>
      </div>
    )
  }

  const orgMeta = organizerAvatar ? AVATAR_META[organizerAvatar] : null

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="safe-top px-5 pt-8 pb-8 text-center relative overflow-hidden" style={{ background: 'var(--hero-gradient)' }}>
        <div className="absolute top-0 left-1/4 w-40 h-40 rounded-full blur-3xl opacity-25 pointer-events-none" style={{ background: '#a78bfa' }} />
        <div className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: '#f472b6' }} />
        <div className="text-5xl mb-3 relative">🌊</div>
        <h1 className="text-2xl font-black text-white relative">{tripName}</h1>
        {orgMeta && (
          <p className="text-sm mt-1.5 relative" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {orgMeta.icon} {orgMeta.label} is organising this trip
          </p>
        )}
        <div className="mt-4 flex justify-center gap-2 flex-wrap relative">
          {destinations.slice(0, 4).map(d => (
            <span key={d.name} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
              {d.emoji ? `${d.emoji} ` : ''}{d.name}
            </span>
          ))}
        </div>
      </div>

      {/* Trip details */}
      <div className="flex-1 px-5 space-y-4 pb-8">
        {/* Group */}
        <div
          className="p-4 rounded-2xl card-elevated"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--accent)' }}>
            THE GROUP
          </div>
          <div className="flex items-center gap-3">
            <div className="text-2xl">👥</div>
            <div>
              <div className="font-semibold">{memberCount} people invited</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Everyone picks a role and owns part of the planning
              </div>
            </div>
          </div>
        </div>

        {/* Brownie points — gamification FOMO hook */}
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(219,39,119,0.08))', border: '1.5px solid rgba(124,58,237,0.2)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🍫</span>
            <p className="text-sm font-black">First = more brownie points</p>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            Every action earns points — but early movers earn <span style={{ color: '#db2777', fontWeight: 700 }}>way more</span>. The squad leaderboard is live.
          </p>
          <div className="space-y-2">
            {[
              { emoji: '⚡', action: 'Accept invite now', pts: `${memberCount} pts`, hot: true },
              { emoji: '🎭', action: 'Pick your role early', pts: `${Math.max(1, memberCount - 1)} pts`, hot: false },
              { emoji: '🗳️', action: 'Vote before deadline', pts: 'decays each hour', hot: false },
              { emoji: '✅', action: 'Fill your preferences', pts: 'bonus pts', hot: false },
            ].map(({ emoji, action, pts, hot }) => (
              <div key={action} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{emoji}</span>
                  <span className="text-xs font-medium">{action}</span>
                </div>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: hot ? 'rgba(124,58,237,0.15)' : 'rgba(0,0,0,0.05)',
                    color: hot ? '#7c3aed' : 'var(--muted)',
                  }}
                >
                  +{pts}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 text-xs font-semibold" style={{ borderTop: '1px solid rgba(124,58,237,0.15)', color: '#db2777' }}>
            ⏰ Whoever joins last gets 1 pt. First in = full squad size. Don&apos;t be last.
          </div>
        </div>

        {/* What happens next */}
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          <div className="text-xs font-medium mb-3" style={{ color: 'var(--accent)' }}>
            WHAT HAPPENS NEXT
          </div>
          <div className="space-y-3">
            {[
              { icon: '🎭', step: 'Pick your role', detail: 'Each role owns a slice of the planning — 2 taps, no forms.' },
              { icon: '💰', step: 'Share your budget', detail: 'Anonymous. Group budget zone revealed when everyone submits.' },
              { icon: '🗺', step: 'Vote on destination', detail: 'Majority wins. 1 tap in your browser.' },
            ].map(({ icon, step, detail }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div>
                  <div className="text-sm font-medium">{step}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!memberId && (
          <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <p className="text-sm font-semibold mb-1">Enter your email to join</p>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              We&apos;ll match you to your invite or create a spot for you.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={selfEmail}
              onChange={e => setSelfEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSelfJoin()}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-2"
              style={{ background: 'var(--card)', border: selfEmail && !selfEmailValid ? '1.5px solid #ef4444' : `1.5px solid ${selfEmail ? 'var(--accent)' : 'var(--input-border)'}` }}
            />
            {selfEmailError && <p className="text-xs mb-2" style={{ color: '#ef4444' }}>{selfEmailError}</p>}
            <button
              onClick={handleSelfJoin}
              disabled={!selfEmailValid || selfEmailLookingUp}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}
            >
              {selfEmailLookingUp ? '⏳ Looking you up...' : 'Join this trip →'}
            </button>
          </div>
        )}
      </div>

      {/* CTAs */}
      {memberId && (
        <div
          className="px-5 pt-3 safe-bottom space-y-2"
          style={{ background: 'var(--background)', borderTop: '1px solid var(--card-border)' }}
        >
          <button
            onClick={() => handleConsent('in')}
            disabled={responding}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}
          >
            {responding ? '⏳' : "I'm In 🙌"}
          </button>
          <button
            onClick={() => handleConsent('out')}
            disabled={responding}
            className="w-full py-3 rounded-2xl text-sm font-medium transition-all disabled:opacity-40"
            style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
          >
            Can&apos;t Make It
          </button>
          <p className="text-center text-xs pb-1" style={{ color: 'var(--muted)' }}>
            Unsubscribe from trip emails anytime.
          </p>
        </div>
      )}
    </div>
  )
}
