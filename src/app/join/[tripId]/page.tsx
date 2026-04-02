'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'
import { supabase } from '@/lib/supabase'

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
        setMemberCount(data.members?.length ?? 0)

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
          if (me?.status === 'consented' || me?.status === 'avatar_selected' || me?.status === 'active') {
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

  async function handleSelfJoin() {
    if (!selfEmail.includes('@') || selfEmailLookingUp) return
    setSelfEmailLookingUp(true)
    setSelfEmailError('')
    const res = await fetch(`/api/trip/${tripId}/self-join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: selfEmail }),
    })
    if (!res.ok) {
      setSelfEmailError('Something went wrong — try again.')
      setSelfEmailLookingUp(false)
      return
    }
    const { memberId: mid } = await res.json()
    // Redirect to personalised link — this re-renders the page with ?m= param
    window.location.href = `/join/${tripId}?m=${mid}`
  }

  async function handleConsent(choice: 'in' | 'out') {
    if (responding || !memberId) return
    setResponding(true)

    if (choice === 'in') {
      await supabase
        .from('members')
        .update({ status: 'consented', joined_at: new Date().toISOString() })
        .eq('id', memberId)

      // Store member ID in localStorage for this trip
      localStorage.setItem(`ts_member_${tripId}`, memberId)

      router.push(`/avatar/${tripId}/${memberId}`)
    } else {
      await supabase
        .from('members')
        .update({ status: 'declined' })
        .eq('id', memberId)

      setAlreadyResponded('out')
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
      <div className="safe-top px-5 pt-8 pb-6 text-center">
        <div className="text-4xl mb-3">🌊</div>
        <h1 className="text-2xl font-bold">{tripName}</h1>
        {orgMeta && (
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {orgMeta.icon} {orgMeta.label} is organising this trip
          </p>
        )}
      </div>

      {/* Trip details */}
      <div className="flex-1 px-5 space-y-4 pb-8">
        {/* Destinations */}
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--accent)' }}>
            DESTINATION OPTIONS
          </div>
          <div className="flex flex-wrap gap-2">
            {destinations.map(d => (
              <span
                key={d.name}
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                {d.emoji ? `${d.emoji} ` : ''}{d.name}
              </span>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            The group votes on the final destination after everyone joins.
          </p>
        </div>

        {/* Group */}
        <div
          className="p-4 rounded-2xl"
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
              style={{ background: 'var(--background)', border: selfEmail && !selfEmail.includes('@') ? '1px solid #ef4444' : '1px solid var(--card-border)' }}
            />
            {selfEmailError && <p className="text-xs mb-2" style={{ color: '#ef4444' }}>{selfEmailError}</p>}
            <button
              onClick={handleSelfJoin}
              disabled={!selfEmail.includes('@') || selfEmailLookingUp}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
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
            style={{ background: 'var(--accent)', color: '#fff' }}
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
