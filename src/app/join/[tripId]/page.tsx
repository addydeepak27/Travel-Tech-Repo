'use client'

import { useState, useEffect, useMemo, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'

const QUESTIONS = [
  {
    id: 'budget_tier',
    q: 'How much can you spend on this trip?',
    sub: 'Anonymous — your number is only used to find the group sweet spot.',
    options: [
      { label: '₹0 – ₹50k', emoji: '🎒', value: 'backpacker' },
      { label: '₹50k – ₹1 Lac', emoji: '😊', value: 'comfortable' },
      { label: '₹1 Lac – ₹5 Lac', emoji: '✨', value: 'premium' },
      { label: 'No limit, I\'m the king', emoji: '👑', value: 'luxury' },
    ],
  },
  {
    id: 'pace_vote',
    q: 'How do you like your days?',
    sub: 'Helps the AI plan a pace the whole squad can agree on.',
    options: [
      { label: 'Easy & Chill', emoji: '🌴', value: 'easy_chill' },
      { label: 'Balanced Mix', emoji: '🎯', value: 'balanced_mix' },
      { label: 'Packed Schedule', emoji: '🔥', value: 'packed_schedule' },
      { label: 'Surprise me', emoji: '✨', value: 'balanced_mix' },
    ],
  },
  {
    id: 'activity_pref',
    q: 'What do you enjoy most on a trip?',
    sub: 'Your top pick shapes the itinerary activities.',
    options: [
      { label: 'Adventure & outdoors', emoji: '🏄', value: 'adventure' },
      { label: 'Food & culture', emoji: '🍜', value: 'food_culture' },
      { label: 'Relaxation & wellness', emoji: '🧘', value: 'relaxation' },
      { label: 'Nightlife & vibes', emoji: '🎉', value: 'nightlife' },
    ],
  },
  {
    id: 'trip_priority',
    q: 'What matters most to you?',
    sub: 'One answer. No wrong choice.',
    options: [
      { label: 'Making memories with the squad', emoji: '👥', value: 'memories' },
      { label: 'Exploring hidden gems', emoji: '🗺', value: 'exploring' },
      { label: 'Epic food & drinks', emoji: '🥂', value: 'food_drinks' },
      { label: 'Thrills & new experiences', emoji: '⚡', value: 'thrills' },
    ],
  },
]

const NON_PLANNER_AVATARS: AvatarType[] = [
  'navigator', 'budgeteer', 'foodie', 'adventure_seeker', 'photographer', 'spontaneous_one',
]

const AVATAR_TAGLINES: Record<AvatarType, string> = {
  planner:          'Keeps the whole thing moving.',
  navigator:        'Gets everyone from A to B without losing anyone.',
  budgeteer:        'Favourite person… until the bill arrives.',
  foodie:           'The most important job on any trip.',
  adventure_seeker: 'Makes sure everyone has a story to tell.',
  photographer:     'Miss the moment, nail the photo.',
  spontaneous_one:  'You ARE the plan.',
}

export default function JoinPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params)
  const searchParams = useSearchParams()
  const urlMemberId = searchParams.get('m')
  const router = useRouter()

  // Trip info
  const [tripName, setTripName] = useState('')
  const [destinations, setDestinations] = useState<{ name: string; emoji?: string }[]>([])
  const [organizerAvatar, setOrganizerAvatar] = useState<AvatarType | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [alreadyResponded, setAlreadyResponded] = useState<'in' | 'out' | null>(null)

  // Self-join (generic link, no ?m=)
  const [selfEmail, setSelfEmail] = useState('')
  const [selfEmailLookingUp, setSelfEmailLookingUp] = useState(false)
  const [selfEmailError, setSelfEmailError] = useState('')

  // Flow
  const [step, setStep] = useState<'landing' | 'avatar' | 'questions' | 'done'>('landing')
  const [resolvedMemberId, setResolvedMemberId] = useState<string | null>(urlMemberId)
  const [responding, setResponding] = useState(false)

  // Avatar step
  const [memberName, setMemberName] = useState('')
  const [takenAvatars, setTakenAvatars] = useState<Set<AvatarType>>(new Set())
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<'generic' | 'taken' | null>(null)

  // Questions step
  const [questionStep, setQuestionStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [preferenceError, setPreferenceError] = useState(false)

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
        const dests = (data.destination_options ?? []).map((d: { name?: string; emoji?: string } | string) =>
          typeof d === 'string' ? { name: d } : { name: d.name ?? '', emoji: d.emoji }
        )
        setDestinations(dests)
        const activeMembers = (data.members ?? []).filter((m: { status: string }) => !['declined', 'dropped'].includes(m.status))
        setMemberCount(activeMembers.length)
        const org = data.members?.find((m: { id: string }) => m.id === data.organizer_id)
        if (org?.avatar) setOrganizerAvatar(org.avatar as AvatarType)
        // Track which avatars are already taken (excluding the current user's own avatar)
        const taken = new Set<AvatarType>(
          activeMembers
            .filter((m: { id: string; avatar: string | null }) => m.id !== urlMemberId && m.avatar)
            .map((m: { avatar: string }) => m.avatar as AvatarType)
        )
        setTakenAvatars(taken)
        if (urlMemberId) {
          const me = data.members?.find((m: { id: string }) => m.id === urlMemberId)
          if (me?.opt_out || me?.status === 'declined') {
            setAlreadyResponded('out')
          } else if (me?.status === 'consented') {
            setStep('avatar')
          } else if (['avatar_selected', 'avatar_selection'].includes(me?.status ?? '')) {
            setStep('questions')
          } else if (['pref_q1', 'pref_q2', 'pref_q3', 'pref_q4', 'budget_submitted', 'active'].includes(me?.status ?? '')) {
            setAlreadyResponded('in')
          }
          // 'invited' → show landing (default)
        }
      } catch {
        if (attempt < 2) { setTimeout(() => load(attempt + 1), 800); return }
        setLoadError(true)
      }
      setLoading(false)
    }
    load(0)
  }, [tripId, urlMemberId, retryCount])

  const selfEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selfEmail)

  async function handleSelfJoin() {
    if (!selfEmailValid || selfEmailLookingUp) return
    setSelfEmailLookingUp(true)
    setSelfEmailError('')
    try {
      const res = await fetch(`/api/trip/${tripId}/self-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selfEmail.toLowerCase().trim() }),
      })
      if (res.status === 403) { setSelfEmailError("You've declined this trip. Ask the organizer to re-invite you."); setSelfEmailLookingUp(false); return }
      if (!res.ok) { setSelfEmailError('Something went wrong — try again.'); setSelfEmailLookingUp(false); return }
      const { memberId: mid, status: memberStatus } = await res.json()
      setResolvedMemberId(mid)
      try { localStorage.setItem(`ts_member_${tripId}`, mid) } catch { /* quota/private */ }
      // Route based on existing progress — never regress users who already completed steps
      if (['avatar_selected', 'avatar_selection'].includes(memberStatus ?? '')) {
        setStep('questions')
        setSelfEmailLookingUp(false)
      } else if (['pref_q1', 'pref_q2', 'pref_q3', 'pref_q4', 'budget_submitted', 'active'].includes(memberStatus ?? '')) {
        setAlreadyResponded('in')
        setSelfEmailLookingUp(false)
      } else if (memberStatus === 'consented') {
        // Already accepted — skip consent API call, go straight to avatar
        setStep('avatar')
        setSelfEmailLookingUp(false)
      } else {
        await doConsent(mid) // 'invited' or brand-new member
      }
    } catch {
      setSelfEmailError('Network error — check your connection.')
      setSelfEmailLookingUp(false)
    }
  }

  async function doConsent(mid: string) {
    const res = await fetch(`/api/trip/${tripId}/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: mid, choice: 'in' }),
    })
    if (!res.ok) { setResponding(false); setSelfEmailLookingUp(false); return }
    setStep('avatar')
    setResponding(false)
    setSelfEmailLookingUp(false)
  }

  async function handleConsent(choice: 'in' | 'out') {
    if (responding || !urlMemberId) return
    setResponding(true)
    try {
      const res = await fetch(`/api/trip/${tripId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: urlMemberId, choice }),
      })
      if (!res.ok) { setResponding(false); return }
      if (choice === 'in') {
        try { localStorage.setItem(`ts_member_${tripId}`, urlMemberId) } catch { /* quota/private */ }
        setResolvedMemberId(urlMemberId)
        setStep('avatar')
        setResponding(false)
      } else {
        setAlreadyResponded('out')
        setResponding(false)
      }
    } catch { setResponding(false) }
  }

  async function handleAvatarSelect(avatar: AvatarType) {
    if (savingAvatar || !resolvedMemberId || !memberName.trim()) return
    setSavingAvatar(true)
    setAvatarError(null)
    try {
      const res = await fetch('/api/member/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: resolvedMemberId, avatar, name: memberName.trim() }),
      })
      if (res.status === 409) {
        setTakenAvatars(prev => new Set([...prev, avatar]))
        setAvatarError('taken')
        return
      }
      if (!res.ok) { setAvatarError('generic'); return }
      setStep('questions')
    } catch {
      setAvatarError('generic')
    } finally {
      setSavingAvatar(false)
    }
  }

  const allQuestions = useMemo(() => {
    if (destinations.length > 1) {
      return [
        {
          id: 'destination_vote',
          q: 'Where should the squad go?',
          sub: 'Vote for your top pick — majority wins.',
          options: destinations.map(d => ({ label: d.name, emoji: d.emoji ?? '📍', value: d.name })),
        },
        ...QUESTIONS,
      ]
    }
    return QUESTIONS
  }, [destinations])

  async function handleAnswer(questionId: string, value: string) {
    if (questionId === 'destination_vote') {
      // Fire-and-forget vote, don't add to preference answers
      if (resolvedMemberId) {
        fetch('/api/trip/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId, memberId: resolvedMemberId, voteType: 'destination', value }),
        }).catch(() => {})
      }
      if (questionStep < allQuestions.length - 1) {
        setQuestionStep(q => q + 1)
      } else {
        await submitPreferences(answers)
      }
      return
    }
    const newAnswers = { ...answers, [questionId]: value }
    setAnswers(newAnswers)
    if (questionStep < allQuestions.length - 1) {
      setQuestionStep(q => q + 1)
    } else {
      await submitPreferences(newAnswers)
    }
  }

  async function submitPreferences(finalAnswers: Record<string, string>) {
    if (submitting || !resolvedMemberId) return
    setSubmitting(true)
    setPreferenceError(false)
    try {
      const res = await fetch('/api/member/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId, memberId: resolvedMemberId,
          budget_tier: finalAnswers.budget_tier,
          pace_vote: finalAnswers.pace_vote,
          activity_pref: finalAnswers.activity_pref,
          trip_priority: finalAnswers.trip_priority,
          special_requests: null,
        }),
      })
      if (!res.ok) throw new Error('Preferences save failed')
      setStep('done')
    } catch {
      setPreferenceError(true)
      setQuestionStep(allQuestions.length - 1)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────
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
          This invite link may be invalid or expired. Ask the organizer to share a fresh link.
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

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-5 text-center safe-top safe-bottom" style={{ background: 'var(--background)' }}>
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-black mb-2">You&apos;re in!</h1>
        <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
          Your preferences are locked in. We&apos;ll email you as the plan comes together.
        </p>
        <div
          className="mt-4 mb-6 px-4 py-3 rounded-2xl text-sm font-medium"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(219,39,119,0.1))', border: '1.5px solid rgba(124,58,237,0.2)', color: '#7c3aed' }}
        >
          🍫 Brownie points awarded — check the leaderboard
        </div>
        <button
          onClick={() => router.push(`/trip/${tripId}`)}
          className="w-full max-w-sm py-4 rounded-2xl font-bold text-base"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}
        >
          See Trip Dashboard →
        </button>
      </div>
    )
  }

  // ── QUESTIONS ─────────────────────────────────────────────────────────────
  if (step === 'questions') {
    const q = allQuestions[questionStep]
    const totalSteps = allQuestions.length
    const progress = Math.round(((questionStep) / totalSteps) * 100)

    return (
      <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
        {/* Header */}
        <div className="safe-top px-5 pt-6 pb-4">
          <div className="h-1.5 rounded-full mb-4" style={{ background: 'var(--card-border)' }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #db2777)' }}
            />
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              Q{questionStep + 1} of {totalSteps}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(219,39,119,0.1)', color: '#db2777' }}
            >
              +bonus pts per answer
            </span>
          </div>
          <h2 className="text-xl font-black leading-snug">{q.q}</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{q.sub}</p>
        </div>

        {/* Options */}
        <div className="flex-1 px-5 pb-8 flex flex-col gap-3">
          {submitting ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="text-3xl animate-pulse">⏳</div>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Saving your vibe...</p>
              </div>
            </div>
          ) : (
            q.options.map(opt => (
              <button
                key={opt.value + opt.label}
                onClick={() => handleAnswer(q.id, opt.value)}
                className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-95"
                style={{ background: 'var(--card)', border: '1.5px solid var(--input-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              >
                <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                <span className="font-semibold text-sm flex-1">{opt.label}</span>
                <span className="text-lg flex-shrink-0" style={{ color: 'var(--card-border)' }}>›</span>
              </button>
            ))
          )}

          {preferenceError && !submitting && (
            <p className="text-xs text-center mt-1" style={{ color: '#ef4444' }}>
              Something went wrong — please try again.
            </p>
          )}

          {questionStep > 0 && !submitting && (
            <button
              onClick={() => setQuestionStep(q => q - 1)}
              className="text-sm mt-2"
              style={{ color: 'var(--muted)' }}
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── AVATAR ────────────────────────────────────────────────────────────────
  if (step === 'avatar') {
    return (
      <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
        {/* Header */}
        <div className="safe-top px-5 pt-8 pb-5 text-center relative overflow-hidden" style={{ background: 'var(--hero-gradient)' }}>
          <div className="absolute top-0 left-1/3 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: '#a78bfa' }} />
          <div className="text-4xl mb-2 relative">🎭</div>
          <h1 className="text-2xl font-black text-white relative">Pick your role</h1>
          <p className="text-sm mt-1.5 relative" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Each role owns a slice of the planning.
          </p>
          <div
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fde68a', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            🍫 Pick early = more brownie points
          </div>
        </div>

        {/* Name input + Avatar list */}
        <div className="flex-1 px-4 pb-6 pt-3 space-y-3 overflow-y-auto">
          {/* Name input */}
          <div>
            <input
              type="text"
              placeholder="Your name or squad nickname"
              value={memberName}
              onChange={e => setMemberName(e.target.value)}
              maxLength={40}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
              style={{
                background: 'var(--card)',
                border: `1.5px solid ${memberName.trim() ? 'var(--accent)' : '#ef4444'}`,
              }}
            />
            <p className="text-xs mt-1 pl-1 font-medium" style={{ color: '#ef4444' }}>Required — pick a role only after entering your name</p>
          </div>

          {NON_PLANNER_AVATARS.every(k => takenAvatars.has(k)) && (
            <div className="px-3 py-2 rounded-xl text-xs font-medium text-center" style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>
              All roles filled — you can still join any role with another squad member 🤝
            </div>
          )}

          {avatarError === 'taken' && (
            <p className="text-xs text-center font-semibold px-3 py-2 rounded-xl" style={{ background: '#fef2f2', color: '#ef4444' }}>
              That role was just grabbed — pick another one!
            </p>
          )}
          {avatarError === 'generic' && (
            <p className="text-xs text-center font-medium" style={{ color: '#ef4444' }}>
              Couldn&apos;t save — check your connection and try again.
            </p>
          )}

          {(() => {
            const allRolesClaimed = NON_PLANNER_AVATARS.every(k => takenAvatars.has(k))
            return NON_PLANNER_AVATARS.map(key => {
              const meta = AVATAR_META[key]
              const isTaken = takenAvatars.has(key)
              // Once every role has been claimed at least once, sharing is allowed
              const isBlocked = isTaken && !allRolesClaimed
              return (
                <button
                  key={key}
                  onClick={() => !isBlocked && handleAvatarSelect(key)}
                  disabled={savingAvatar || isBlocked || !memberName.trim()}
                  className="w-full text-left rounded-2xl transition-all"
                  style={{
                    background: isBlocked ? '#f9fafb' : 'var(--card)',
                    border: `1.5px solid ${isBlocked ? '#e5e7eb' : isTaken ? 'rgba(124,58,237,0.35)' : 'var(--card-border)'}`,
                    opacity: isBlocked ? 0.5 : (!memberName.trim() || savingAvatar) ? 0.4 : 1,
                    cursor: isBlocked || !memberName.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div className="flex items-center gap-3 p-4">
                    <span className="text-3xl flex-shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base leading-tight">{meta.label}</span>
                        {isBlocked && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#fee2e2', color: '#ef4444' }}>
                            Taken
                          </span>
                        )}
                        {isTaken && !isBlocked && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                            +1 joining
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>
                        {AVATAR_TAGLINES[key]}
                      </p>
                    </div>
                    {!isBlocked && <span className="text-lg flex-shrink-0" style={{ color: 'var(--muted)' }}>›</span>}
                  </div>
                </button>
              )
            })
          })()}
        </div>

        <div className="px-5 pb-4 safe-bottom text-center">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Roles can be shared — tap to claim yours.
          </p>
        </div>
      </div>
    )
  }

  // ── LANDING ───────────────────────────────────────────────────────────────
  const orgMeta = organizerAvatar ? AVATAR_META[organizerAvatar] : null

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Hero */}
      <div className="safe-top px-5 pt-8 pb-8 text-center relative overflow-hidden" style={{ background: 'var(--hero-gradient)' }}>
        <div className="absolute top-0 left-1/4 w-40 h-40 rounded-full blur-3xl opacity-25 pointer-events-none" style={{ background: '#a78bfa' }} />
        <div className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: '#f472b6' }} />
        <div className="text-5xl mb-3 relative">🌊</div>
        <h1 className="text-3xl font-black text-white relative">{tripName}</h1>
        {orgMeta && (
          <p className="text-base mt-1.5 relative" style={{ color: 'rgba(255,255,255,0.85)' }}>
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

      <div className="flex-1 px-5 space-y-4 pb-8 pt-4">
        {/* Group size */}
        <div className="p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">👥</div>
            <div>
              <div className="font-semibold text-base">{memberCount} people invited</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>Everyone picks a role and owns part of the planning</div>
            </div>
          </div>
        </div>

        {/* Brownie points FOMO */}
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(219,39,119,0.08))', border: '1.5px solid rgba(124,58,237,0.2)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🍫</span>
            <p className="text-base font-black">First = more brownie points</p>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            Every action earns points — but early movers earn <span style={{ color: '#db2777', fontWeight: 700 }}>way more</span>. The squad leaderboard is live.
          </p>
          <div className="space-y-2">
            {[
              { emoji: '⚡', action: 'Accept invite now', pts: `+${memberCount} pts`, hot: true },
              { emoji: '🎭', action: 'Pick your role early', pts: `+${Math.max(1, memberCount - 1)} pts`, hot: false },
              { emoji: '✅', action: 'Fill your preferences', pts: '+bonus pts', hot: false },
              { emoji: '🗳️', action: 'Vote before deadline', pts: 'decays each hour', hot: false },
            ].map(({ emoji, action, pts, hot }) => (
              <div key={action} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{emoji}</span>
                  <span className="text-sm font-medium">{action}</span>
                </div>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: hot ? 'rgba(124,58,237,0.15)' : 'rgba(0,0,0,0.05)', color: hot ? '#7c3aed' : 'var(--muted)' }}
                >
                  {pts}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 text-sm font-semibold" style={{ borderTop: '1px solid rgba(124,58,237,0.15)', color: '#db2779' }}>
            ⏰ Whoever joins last gets 1 pt. First in = full squad size. Don&apos;t be last.
          </div>
          <div
            className="mt-3 p-3 rounded-2xl flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(219,39,119,0.12))', border: '1.5px solid rgba(219,39,119,0.3)' }}
          >
            <span className="text-2xl flex-shrink-0">🎁</span>
            <div>
              <p className="text-base font-black" style={{ color: '#db2777' }}>Brownie points = real gifts</p>
              <p className="text-sm mt-0.5 leading-snug" style={{ color: 'var(--foreground)', opacity: 0.75 }}>
                Top scorers cash in for surprises at trip end. Details dropping soon — stack those points.
              </p>
            </div>
          </div>
        </div>

        {/* What happens after you join */}
        <div className="p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="text-xs font-medium mb-3" style={{ color: 'var(--accent)' }}>WHAT HAPPENS AFTER YOU JOIN</div>
          <div className="space-y-3">
            {(destinations.length > 1
              ? [
                  { icon: '🎭', step: 'Pick your role', detail: 'Each role owns a slice of the planning — 1 tap.' },
                  { icon: '🗳️', step: 'Vote on destination', detail: `${destinations.map(d => d.name).join(' vs ')} — Q1 of 5. Your vote is anonymous.` },
                  { icon: '💰', step: 'Share your budget + vibe', detail: '4 more quick questions. Anonymous. Takes 60 seconds.' },
                ]
              : [
                  { icon: '🎭', step: 'Pick your role', detail: 'Each role owns a slice of the planning — 1 tap.' },
                  { icon: '💰', step: 'Share your budget + vibe', detail: '4 quick questions. Anonymous. Takes 60 seconds.' },
                ]
            ).map(({ icon, step, detail }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div>
                  <div className="text-base font-semibold">{step}</div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Self-join (no ?m= param) */}
        {!urlMemberId && (
          <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <p className="text-base font-semibold mb-1">Enter your email to join</p>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              We&apos;ll match you to your invite or create a spot for you.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={selfEmail}
              onChange={e => setSelfEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSelfJoin()}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-2"
              style={{
                background: 'var(--card)',
                border: selfEmail && !selfEmailValid ? '1.5px solid #ef4444' : `1.5px solid ${selfEmail ? 'var(--accent)' : 'var(--input-border)'}`,
              }}
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

      {/* Sticky CTAs for personalised link */}
      {urlMemberId && (
        <div className="px-5 pt-3 safe-bottom space-y-2" style={{ background: 'var(--background)', borderTop: '1px solid var(--card-border)' }}>
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
          <p className="text-center text-xs pb-1" style={{ color: 'var(--muted)' }}>Unsubscribe from trip emails anytime.</p>
        </div>
      )}
    </div>
  )
}
