'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

const QUESTIONS = [
  {
    id: 'budget_tier',
    q: 'How much can you spend on this trip?',
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
    options: [
      { label: 'Making memories with the squad', emoji: '👥', value: 'memories' },
      { label: 'Exploring hidden gems', emoji: '🗺', value: 'exploring' },
      { label: 'Epic food & drinks', emoji: '🥂', value: 'food_drinks' },
      { label: 'Thrills & new experiences', emoji: '⚡', value: 'thrills' },
    ],
  },
]

export default function PreferencesPage({
  params,
}: {
  params: Promise<{ tripId: string; memberId: string }>
}) {
  const { tripId, memberId } = use(params)
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [specialRequests, setSpecialRequests] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [done, setDone] = useState(false)
  const [travelMonth, setTravelMonth] = useState<string | null>(null)
  const [monthError, setMonthError] = useState(false)

  // Fetch trip travel month
  useEffect(() => {
    fetch(`/api/trip/${tripId}/dashboard-info`)
      .then(r => r.json())
      .then(d => {
        const dep = d?.trip?.departure_date
        if (dep) {
          setTravelMonth(dep.slice(0, 7)) // YYYY-MM
        } else {
          setMonthError(true) // no departure_date set — skip date step gracefully
        }
      })
      .catch(() => setMonthError(true))
  }, [tripId])

  // Total steps: QUESTIONS + dates + special_requests
  const TOTAL_STEPS = QUESTIONS.length + 2
  const isDateStep = step === QUESTIONS.length
  const isSpecialStep = step === QUESTIONS.length + 1
  const progress = Math.round((step / TOTAL_STEPS) * 100)

  // Build date chips for travel month
  const dateChips: { date: string; label: string; dayName: string }[] = []
  if (travelMonth) {
    const [year, month] = travelMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${travelMonth}-${String(d).padStart(2, '0')}`
      const dateObj = new Date(year, month - 1, d)
      const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'short' })
      const label = `${d} ${dateObj.toLocaleDateString('en-IN', { month: 'short' })}`
      dateChips.push({ date: dateStr, label, dayName })
    }
  }

  function toggleDate(date: string) {
    setAvailableDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    )
  }

  async function handleAnswer(questionId: string, value: string) {
    const newAnswers = { ...answers, [questionId]: value }
    setAnswers(newAnswers)
    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1)
    } else {
      setStep(QUESTIONS.length) // go to date step
    }
  }

  async function handleSubmit(skipSpecial = false) {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(false)

    const specialRequestsValue = skipSpecial ? null : specialRequests || null
    const storedSpecial = availableDates.length > 0
      ? JSON.stringify({ available_dates: availableDates, notes: specialRequestsValue })
      : specialRequestsValue

    try {
      const res = await fetch('/api/member/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          memberId,
          budget_tier: answers.budget_tier,
          pace_vote: answers.pace_vote,
          activity_pref: answers.activity_pref,
          trip_priority: answers.trip_priority,
          special_requests: storedSpecial,
        }),
      })
      if (!res.ok) throw new Error('submit failed')
      setDone(true)
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-5 text-center safe-top safe-bottom">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re all set!</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Your preferences have been added to the group. We&apos;ll email you as the plan comes together.
        </p>
        <button
          onClick={() => router.push(`/trip/${tripId}`)}
          className="px-6 py-3 rounded-2xl font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}
        >
          View Trip Dashboard →
        </button>
      </div>
    )
  }

  // Date availability step (Q5) — skip entirely if no travel month set
  if (isDateStep && monthError) {
    // Auto-advance to special requests step
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center px-5 space-y-3">
          <div className="text-3xl">📅</div>
          <p className="text-sm font-medium">No travel month set</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Skipping date step — the organizer hasn&apos;t set a travel month yet.</p>
          <button
            onClick={() => setStep(s => s + 1)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >Continue →</button>
        </div>
      </div>
    )
  }

  // Date availability step (Q5)
  if (isDateStep) {
    const monthLabel = travelMonth
      ? new Date(travelMonth + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      : 'your travel month'

    return (
      <div className="min-h-dvh flex flex-col px-5 safe-top safe-bottom" style={{ background: 'var(--background)' }}>
        <div className="pt-8 pb-4">
          <div className="h-1.5 rounded-full mb-6" style={{ background: 'var(--card-border)' }}>
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #db2777)' }} />
          </div>
          <p className="gradient-text text-xs font-medium mb-1">Q5 OF {TOTAL_STEPS}</p>
          <h2 className="text-xl font-bold leading-snug">Which dates work for you?</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Pick your available dates in {monthLabel}
          </p>
        </div>

        {dateChips.length > 0 ? (
          <div className="flex flex-wrap gap-2 pb-4">
            {dateChips.map(({ date, label, dayName }) => {
              const selected = availableDates.includes(date)
              const isWeekend = dayName === 'Sat' || dayName === 'Sun'
              return (
                <button
                  key={date}
                  onClick={() => toggleDate(date)}
                  className="flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: selected ? 'var(--accent)' : isWeekend ? 'var(--accent-muted)' : 'var(--card)',
                    border: `1.5px solid ${selected ? 'var(--accent)' : isWeekend ? 'var(--accent)' : 'var(--input-border)'}`,
                    color: selected ? '#fff' : isWeekend ? 'var(--accent)' : 'var(--foreground)',
                    minWidth: '52px',
                    boxShadow: selected ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>{dayName}</span>
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading dates…</p>
            <button
              onClick={() => setStep(s => s + 1)}
              className="text-xs underline"
              style={{ color: 'var(--muted)', minHeight: 'unset' }}
            >Skip this step</button>
          </div>
        )}

        {availableDates.length > 0 && (
          <p className="text-xs mb-3" style={{ color: 'var(--accent)' }}>
            {availableDates.length} date{availableDates.length !== 1 ? 's' : ''} selected
          </p>
        )}

        <div className="space-y-2 mt-auto pb-2">
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={availableDates.length === 0}
            className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}
          >
            Next →
          </button>
          <button
            onClick={() => setStep(s => s + 1)}
            className="w-full py-3 rounded-2xl text-sm font-medium"
            style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
          >
            Skip
          </button>
        </div>

        <button
          onClick={() => setStep(s => s - 1)}
          className="mt-3 mb-4 text-sm"
          style={{ color: 'var(--muted)' }}
        >
          ← Back
        </button>
      </div>
    )
  }

  // Special requests step (Q6 — optional)
  if (isSpecialStep) {
    return (
      <div className="min-h-dvh flex flex-col px-5 safe-top safe-bottom" style={{ background: 'var(--background)' }}>
        <div className="pt-8 pb-6">
          <div className="h-1.5 rounded-full mb-6" style={{ background: 'var(--card-border)' }}>
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #db2777)' }} />
          </div>
          <p className="gradient-text text-xs font-medium mb-1">Q6 OF {TOTAL_STEPS} — OPTIONAL</p>
          <h2 className="text-xl font-bold leading-snug">Anything else we should know?</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            e.g. I&apos;m vegetarian, I don&apos;t do heights, I want a beach day...
          </p>
        </div>
        <textarea
          value={specialRequests}
          onChange={e => setSpecialRequests(e.target.value)}
          placeholder="Type anything here, or tap Skip..."
          rows={4}
          className="w-full p-4 rounded-2xl text-sm resize-none outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
        />
        {submitError && (
          <p className="mt-2 text-xs font-medium" style={{ color: '#ef4444' }}>
            Couldn&apos;t save — check your connection and try again.
          </p>
        )}
        <div className="mt-4 space-y-2">
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}
          >
            {submitting ? '⏳' : submitError ? 'Try Again →' : 'Submit →'}
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="w-full py-3 rounded-2xl text-sm font-medium disabled:opacity-40"
            style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}
          >
            Skip
          </button>
        </div>
        <button
          onClick={() => setStep(s => s - 1)}
          className="mt-4 text-sm"
          style={{ color: 'var(--muted)' }}
        >
          ← Back
        </button>
      </div>
    )
  }

  const q = QUESTIONS[step]

  return (
    <div className="min-h-dvh flex flex-col px-5 safe-top safe-bottom" style={{ background: 'var(--background)' }}>
      <div className="pt-8 pb-6">
        <div className="h-1.5 rounded-full mb-6" style={{ background: 'var(--card-border)' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #db2777)' }} />
        </div>
        <p className="gradient-text text-xs font-medium mb-1">Q{step + 1} OF {TOTAL_STEPS}</p>
        <h2 className="text-xl font-bold leading-snug">{q.q}</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Tap to answer — no submit button needed</p>
      </div>

      <div className="flex flex-col gap-3">
        {q.options.map(opt => (
          <button
            key={opt.value + opt.label}
            onClick={() => handleAnswer(q.id, opt.value)}
            className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-95"
            style={{ background: 'var(--card)', border: '1.5px solid var(--input-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
            <span className="font-semibold text-sm flex-1">{opt.label}</span>
            <span className="text-lg text-gray-300 flex-shrink-0">›</span>
          </button>
        ))}
      </div>

      {step > 0 && (
        <button
          onClick={() => setStep(s => s - 1)}
          className="mt-6 text-sm"
          style={{ color: 'var(--muted)' }}
        >
          ← Back
        </button>
      )}
    </div>
  )
}
