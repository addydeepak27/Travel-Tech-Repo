'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'

const QUESTIONS = [
  {
    id: 'budget_tier',
    q: 'How much can you spend on this trip?',
    options: [
      { label: 'Under ₹5k', emoji: '🎒', value: 'backpacker' },
      { label: '₹5–10k', emoji: '😊', value: 'comfortable' },
      { label: '₹10–20k', emoji: '✨', value: 'premium' },
      { label: '₹20k+', emoji: '👑', value: 'luxury' },
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
  const [specialRequests, setSpecialRequests] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const isQ5 = step === QUESTIONS.length
  const progress = Math.round(((step) / (QUESTIONS.length + 1)) * 100)

  async function handleAnswer(questionId: string, value: string) {
    const newAnswers = { ...answers, [questionId]: value }
    setAnswers(newAnswers)
    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1)
    } else {
      setStep(QUESTIONS.length)
    }
  }

  async function handleSubmit(skipSpecial = false) {
    if (submitting) return
    setSubmitting(true)

    await fetch('/api/member/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId,
        memberId,
        budget_tier: answers.budget_tier,
        pace_vote: answers.pace_vote,
        activity_pref: answers.activity_pref,
        trip_priority: answers.trip_priority,
        special_requests: skipSpecial ? null : specialRequests || null,
      }),
    })

    setDone(true)
    setSubmitting(false)
  }

  if (done) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-5 text-center safe-top safe-bottom">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-2">You're all set!</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Your preferences have been added to the group. We'll email you as the plan comes together.
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

  if (isQ5) {
    return (
      <div className="min-h-dvh flex flex-col px-5 safe-top safe-bottom" style={{ background: 'var(--background)' }}>
        <div className="pt-8 pb-6">
          <div className="h-1.5 rounded-full mb-6" style={{ background: 'var(--card-border)' }}>
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
          </div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>Q5 OF 5 — OPTIONAL</p>
          <h2 className="text-xl font-bold leading-snug">Anything else we should know?</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            e.g. I'm vegetarian, I don't do heights, I want a beach day...
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
        <div className="mt-4 space-y-2">
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {submitting ? '⏳' : 'Submit →'}
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
      </div>
    )
  }

  const q = QUESTIONS[step]

  return (
    <div className="min-h-dvh flex flex-col px-5 safe-top safe-bottom" style={{ background: 'var(--background)' }}>
      <div className="pt-8 pb-6">
        <div className="h-1.5 rounded-full mb-6" style={{ background: 'var(--card-border)' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
        </div>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>Q{step + 1} OF {QUESTIONS.length + 1}</p>
        <h2 className="text-xl font-bold leading-snug">{q.q}</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Tap to answer — no submit button needed</p>
      </div>

      <div className="flex flex-col gap-3">
        {q.options.map(opt => (
          <button
            key={opt.value + opt.label}
            onClick={() => handleAnswer(q.id, opt.value)}
            className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <span className="font-medium text-sm">{opt.label}</span>
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
