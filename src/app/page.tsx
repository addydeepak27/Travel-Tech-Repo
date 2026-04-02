'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { INDIAN_DESTINATIONS, TRENDING_DESTINATIONS } from '@/types'

type Step = 'identity' | 'intent' | 'destination' | 'join_code' | 'share'
type DestMode = 'group_vote' | 'organizer_pick'

export default function HomePage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('identity')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [destMode, setDestMode] = useState<DestMode>('group_vote')
  const [selectedDests, setSelectedDests] = useState<string[]>([])
  const [destSearch, setDestSearch] = useState('')
  const [destDropdownOpen, setDestDropdownOpen] = useState(false)
  const [memberEmails, setMemberEmails] = useState('')
  const [travelMonth, setTravelMonth] = useState('')
  const destSearchRef = useRef<HTMLInputElement>(null)
  const destDropdownRef = useRef<HTMLDivElement>(null)

  const [travelCode, setTravelCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [lookingUp, setLookingUp] = useState('')

  const [tripId, setTripId] = useState('')
  const [tripName, setTripName] = useState('')
  const [tripCode, setTripCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [copied, setCopied] = useState(false)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const canProceedIdentity = name.trim().length >= 1 && emailValid
  const canProceedDestination = (destMode === 'group_vote'
    ? selectedDests.length >= 2
    : selectedDests.length >= 1) && travelMonth.length > 0

  const filteredDests = destSearch.length >= 1
    ? INDIAN_DESTINATIONS.filter(d =>
        d.name.toLowerCase().includes(destSearch.toLowerCase()) ||
        d.state.toLowerCase().includes(destSearch.toLowerCase())
      )
    : INDIAN_DESTINATIONS

  function toggleDest(name: string) {
    setSelectedDests(prev => {
      if (prev.includes(name)) return prev.filter(d => d !== name)
      const max = destMode === 'group_vote' ? 3 : 1
      if (prev.length >= max) return [...prev.slice(1), name]
      return [...prev, name]
    })
  }

  async function createTrip() {
    if (!canProceedDestination || creating) return
    setCreating(true)
    setCreateError('')

    const destObjects = selectedDests.map(name => {
      const found = INDIAN_DESTINATIONS.find(d => d.name === name) ??
        TRENDING_DESTINATIONS.find(d => d.name === name)
      return found ? { name: found.name, emoji: (found as { emoji?: string }).emoji ?? '📍' } : { name }
    })

    const rawEmails = memberEmails.split(/[\n,]+/).map(e => e.trim()).filter(e => e.includes('@'))

    const res = await fetch('/api/trip/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinations: destObjects,
        organizerName: name,
        organizerEmail: email,
        memberEmails: rawEmails,
        destinationMode: destMode,
        travelMonth: travelMonth || null,
      }),
    })

    if (!res.ok) {
      setCreateError('Something went wrong. Try again.')
      setCreating(false)
      return
    }

    const data = await res.json()
    setTripId(data.tripId)
    setTripName(data.tripName)
    setTripCode(data.travelCode)
    if (data.organizerId) {
      localStorage.setItem(`ts_member_${data.tripId}`, data.organizerId)
    }
    setStep('share')
    setCreating(false)
  }

  async function lookupCode() {
    const code = travelCode.toUpperCase().trim()
    if (code.length !== 6) return
    setLookingUp('loading')
    setCodeError('')

    const res = await fetch(`/api/trip/lookup?code=${code}`)
    if (res.status === 404) {
      setCodeError('Code not found — check for typos.')
      setLookingUp('')
      return
    }
    if (res.status === 410) {
      setCodeError('This trip has been cancelled.')
      setLookingUp('')
      return
    }
    if (!res.ok) {
      setCodeError('Something went wrong. Try again.')
      setLookingUp('')
      return
    }

    const { tripId: foundId } = await res.json()
    router.push(`/join/${foundId}`)
  }

  function copyLink() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    navigator.clipboard.writeText(`${appUrl}/join/${tripId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (step === 'identity') {
    return (
      <div className="min-h-dvh flex flex-col px-5 safe-top" style={{ background: 'var(--background)' }}>
        <div className="flex-1 overflow-y-auto">
          {/* Hero — full-bleed gradient banner like Booking.com */}
          <div className="-mx-5 px-5 pt-10 pb-7 mb-5 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #1e1b4b 0%, #0f172a 40%, #0c1a2e 70%, #0f2027 100%)' }}>
            {/* Ambient glow orbs */}
            <div className="absolute top-0 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: '#6366f1' }} />
            <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ background: '#06b6d4' }} />

            {/* Floating destination chips */}
            <div className="flex flex-wrap justify-center gap-2 mb-5">
              {['🏖 Goa', '🏔 Manali', '🌿 Coorg', '🏙 Jaipur', '🗻 Kedarkantha', '🌊 Pondicherry'].map(d => (
                <span key={d} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>{d}</span>
              ))}
            </div>

            <div className="text-center relative">
              <div className="text-4xl mb-2">🌊</div>
              <h1 className="text-3xl font-black tracking-tight text-white">Toh Chale</h1>
              <p className="text-base font-semibold mt-2 text-white">Your squad. One link. Full trip planned.</p>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Votes, roles & AI itinerary — no app, no chaos.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="mb-4">
            <p className="text-xs font-bold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>HOW IT WORKS</p>
            <div className="space-y-2">
              {[
                { icon: '✉️', title: 'Invite your squad', sub: 'Send a link — they join in 2 taps, no sign-up' },
                { icon: '🗳️', title: 'Vote on the destination', sub: 'Everyone picks. Majority decides. Done.' },
                { icon: '🎭', title: 'Claim your squad role', sub: 'Foodie, Navigator, Budgeteer & more' },
                { icon: '✨', title: 'AI builds the itinerary', sub: 'Day-by-day plan built around your squad' },
              ].map(({ icon, title, sub }, i) => (
                <div key={title} className="flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-base font-black" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(6,182,212,0.25))', border: '1px solid rgba(99,102,241,0.3)' }}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</div>
                  </div>
                  <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>{i + 1}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <p className="text-xs font-bold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>LET&apos;S START</p>
          <div className="space-y-3 pb-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: 'var(--muted)' }}>YOUR NAME</label>
              <input
                type="text"
                placeholder="Aditya"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
                style={{ background: 'var(--card)', border: name ? '1px solid #6366f1' : '1px solid var(--card-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: 'var(--muted)' }}>EMAIL</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
                style={{ background: 'var(--card)', border: email && !emailValid ? '1px solid #ef4444' : email ? '1px solid #6366f1' : '1px solid var(--card-border)' }}
              />
              {email && !emailValid && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Enter a valid email address</p>
              )}
              <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>All trip updates and invites will be sent here</p>
            </div>
          </div>
        </div>

        <div className="pt-3 pb-6 safe-bottom">
          <button
            onClick={() => setStep('intent')}
            disabled={!canProceedIdentity}
            className="w-full py-4 rounded-2xl font-black text-base disabled:opacity-30 transition-all"
            style={{
              background: canProceedIdentity ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'var(--card)',
              color: '#fff',
              boxShadow: canProceedIdentity ? '0 0 24px rgba(99,102,241,0.4)' : 'none',
            }}
          >
            Let&apos;s go →
          </button>
          <p className="text-center text-xs mt-3" style={{ color: 'var(--muted)' }}>
            By continuing you agree to receive trip updates via email. Unsubscribe anytime.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'intent') {
    return (
      <div className="min-h-dvh flex flex-col px-5 safe-top safe-bottom" style={{ background: 'var(--background)' }}>
        <div className="pt-10 pb-8">
          <button onClick={() => setStep('identity')} className="text-sm mb-6" style={{ color: 'var(--muted)' }}>← Back</button>
          <h1 className="text-2xl font-bold">What do you want to do?</h1>
        </div>

        <div className="flex-1 space-y-3">
          <button
            onClick={() => setStep('destination')}
            className="w-full p-5 rounded-2xl text-left flex items-start gap-4"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            <span className="text-3xl">🗺</span>
            <div>
              <div className="font-bold text-base">Plan a new trip</div>
              <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                Pick a destination, invite the squad, let everyone vote
              </div>
            </div>
          </button>

          <button
            onClick={() => setStep('join_code')}
            className="w-full p-5 rounded-2xl text-left flex items-start gap-4"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            <span className="text-3xl">🎟</span>
            <div>
              <div className="font-bold text-base">Join with a travel code</div>
              <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                Enter the 6-letter code your organiser shared
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  if (step === 'join_code') {
    return (
      <div className="min-h-dvh flex flex-col px-5 safe-top safe-bottom" style={{ background: 'var(--background)' }}>
        <div className="pt-10 pb-8">
          <button onClick={() => { setStep('intent'); setTravelCode(''); setCodeError('') }} className="text-sm mb-6" style={{ color: 'var(--muted)' }}>← Back</button>
          <h1 className="text-2xl font-bold">Enter travel code</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>6-letter code from your organiser</p>
        </div>

        <div className="flex-1 space-y-4">
          <input
            type="text"
            placeholder="GOA7K2"
            value={travelCode}
            onChange={e => { setTravelCode(e.target.value.toUpperCase().slice(0, 6)); setCodeError('') }}
            className="w-full px-4 py-4 rounded-2xl text-2xl font-mono font-bold text-center tracking-widest outline-none"
            style={{ background: 'var(--card)', border: `1px solid ${codeError ? '#ef4444' : 'var(--card-border)'}` }}
            maxLength={6}
            autoCapitalize="characters"
          />
          {codeError && <p className="text-sm text-center" style={{ color: '#ef4444' }}>{codeError}</p>}
        </div>

        <div className="pt-4 pb-2">
          <button
            onClick={lookupCode}
            disabled={travelCode.length !== 6 || lookingUp === 'loading'}
            className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {lookingUp === 'loading' ? '⏳ Looking up...' : 'Find Trip →'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'destination') {
    const today = new Date().toISOString().split('T')[0]
    const maxDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    return (
      <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
        {/* Header */}
        <div className="px-5 pt-10 pb-4 flex-shrink-0">
          <button
            onClick={() => { setStep('intent'); setSelectedDests([]); setDestSearch(''); setDestDropdownOpen(false) }}
            className="text-sm mb-5 flex items-center gap-1"
            style={{ color: 'var(--muted)' }}
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold">Plan your trip</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {destMode === 'group_vote' ? 'Pick 2–3 destinations for the group to vote on' : 'Pick where you\'re headed'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-36 space-y-6">

          {/* Mode toggle */}
          <div
            className="flex rounded-2xl p-1"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            {(['group_vote', 'organizer_pick'] as DestMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setDestMode(m); setSelectedDests([]) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: destMode === m ? 'var(--accent)' : 'transparent',
                  color: destMode === m ? '#fff' : 'var(--muted)',
                }}
              >
                {m === 'group_vote' ? '🗳 Group votes' : '📍 I\'ll pick'}
              </button>
            ))}
          </div>

          {/* Trending chips */}
          <div>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--muted)' }}>TRENDING</p>
            <div className="flex flex-wrap gap-2">
              {TRENDING_DESTINATIONS.map(d => {
                const selected = selectedDests.includes(d.name)
                return (
                  <button
                    key={d.name}
                    onClick={() => toggleDest(d.name)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                    style={{
                      background: selected ? 'var(--accent)' : 'var(--card)',
                      color: selected ? '#fff' : 'var(--foreground)',
                      border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--card-border)'}`,
                    }}
                  >
                    {d.emoji} {d.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Destination dropdown */}
          <div ref={destDropdownRef}>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--muted)' }}>
              {destMode === 'group_vote' ? 'ADD MORE DESTINATIONS' : 'ALL DESTINATIONS'}
            </p>
            <div style={{ position: 'relative' }}>
              <input
                ref={destSearchRef}
                type="text"
                placeholder="Search 50+ cities & states..."
                value={destSearch}
                onChange={e => { setDestSearch(e.target.value); setDestDropdownOpen(true) }}
                onFocus={() => setDestDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDestDropdownOpen(false), 150)}
                className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none"
                style={{
                  background: 'var(--card)',
                  border: `1.5px solid ${destDropdownOpen ? 'var(--accent)' : 'var(--card-border)'}`,
                  color: 'var(--foreground)',
                }}
              />
              <span
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted)', fontSize: 13, pointerEvents: 'none',
                }}
              >
                🔍
              </span>

              {destDropdownOpen && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                    background: 'var(--card)', border: '1.5px solid var(--card-border)',
                    zIndex: 50, maxHeight: 260, overflowY: 'auto',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {filteredDests.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-center" style={{ color: 'var(--muted)' }}>
                      No destinations found
                    </div>
                  ) : (
                    filteredDests.map(d => {
                      const selected = selectedDests.includes(d.name)
                      return (
                        <button
                          key={d.name}
                          onMouseDown={() => { toggleDest(d.name); setDestSearch(''); setDestDropdownOpen(false) }}
                          className="w-full px-4 py-3 text-left text-sm flex items-center justify-between"
                          style={{
                            background: selected ? 'rgba(99,102,241,0.15)' : 'transparent',
                            borderBottom: '1px solid var(--card-border)',
                          }}
                        >
                          <span style={{ color: 'var(--foreground)' }}>
                            {d.emoji}&nbsp;&nbsp;{d.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>{d.state}</span>
                            {selected && <span style={{ color: 'var(--accent)', fontSize: 16 }}>✓</span>}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected destinations */}
          {selectedDests.length > 0 && (
            <div
              className="p-4 rounded-2xl"
              style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted)' }}>
                SELECTED · {selectedDests.length}{destMode === 'group_vote' ? '/3' : '/1'}
              </p>
              <div className="space-y-2">
                {selectedDests.map((d, i) => {
                  const dest = INDIAN_DESTINATIONS.find(x => x.name === d) ?? TRENDING_DESTINATIONS.find(x => x.name === d)
                  return (
                    <div
                      key={d}
                      className="flex items-center justify-between py-2 px-3 rounded-xl"
                      style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
                    >
                      <span className="text-sm font-medium">
                        {dest?.emoji ?? '📍'} {d}
                        {destMode === 'group_vote' && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--accent)' }}>
                            Option {i + 1}
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => setSelectedDests(prev => prev.filter(x => x !== d))}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                        style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--muted)' }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Travel Month */}
          <div>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--muted)' }}>WHEN ARE YOU TRAVELLING? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>*</span></p>
            <input
              type="month"
              value={travelMonth}
              min={new Date().toISOString().slice(0, 7)}
              onChange={e => setTravelMonth(e.target.value)}
              className="w-full px-3 py-3 rounded-xl text-sm outline-none appearance-none"
              style={{
                background: 'var(--card)',
                border: `1.5px solid ${travelMonth ? 'var(--accent)' : 'var(--card-border)'}`,
                color: travelMonth ? 'var(--foreground)' : 'var(--muted)',
                colorScheme: 'dark',
              }}
            />
            {travelMonth && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--accent)' }}>
                Squad members will pick their available dates in {new Date(travelMonth + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Squad emails */}
          <div>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--muted)' }}>INVITE SQUAD</p>
            <textarea
              value={memberEmails}
              onChange={e => setMemberEmails(e.target.value)}
              placeholder={'rahul@gmail.com\npriya@gmail.com\nkaran@gmail.com'}
              rows={4}
              className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none resize-none"
              style={{
                background: 'var(--card)',
                border: '1.5px solid var(--card-border)',
                color: 'var(--foreground)',
                lineHeight: 1.7,
              }}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>One email per line — they'll get an invite with a direct link</p>
          </div>
        </div>

        {/* Sticky CTA */}
        <div
          className="fixed bottom-0 left-0 right-0 px-5 py-4"
          style={{ background: 'var(--background)', borderTop: '1px solid var(--card-border)' }}
        >
          {createError && <p className="text-sm text-center mb-2" style={{ color: '#ef4444' }}>{createError}</p>}
          <button
            onClick={createTrip}
            disabled={!canProceedDestination || creating}
            className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {creating ? '⏳ Creating trip...' : 'Create Trip →'}
          </button>
          {!canProceedDestination && (
            <p className="text-center text-xs mt-2" style={{ color: 'var(--muted)' }}>
              {destMode === 'group_vote' ? `Select ${2 - selectedDests.length} more destination${2 - selectedDests.length > 1 ? 's' : ''}` : 'Select a destination'}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (step === 'share') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    return (
      <div className="min-h-dvh flex flex-col px-5 safe-top safe-bottom" style={{ background: 'var(--background)' }}>
        <div className="pt-12 pb-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold">
            {destMode === 'group_vote' ? `${tripName} — squad, it's time to vote!` : `${tripName} is live!`}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {destMode === 'group_vote'
              ? 'Invites sent via email. Once everyone joins, the squad votes on the final destination.'
              : 'Invites sent via email. Share the code below to add more people.'}
          </p>
        </div>

        <div
          className="p-5 rounded-2xl mb-6 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>TRAVEL CODE</p>
          <p className="text-4xl font-bold font-mono tracking-widest mb-1">{tripCode}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Anyone can join at {appUrl} using this code</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
              const joinUrl = `${appUrl}/join/${tripId}`
              const text = destMode === 'group_vote'
                ? `${name} is cooking up ${tripName} on Toh Chale 🌊\n\nDon't be the one friend who finds out about this trip from their Instagram stories 😬\n\nJoin to vote on the final destination 🗳️\n\n${joinUrl}`
                : `${name} is planning ${tripName} on Toh Chale 🌊\n\nDon't be the one friend who finds out about this trip from their Instagram stories 😬\n\n${joinUrl}`
              if (navigator.share) {
                navigator.share({ title: tripName, text, url: joinUrl }).catch(() => {})
              } else {
                navigator.clipboard.writeText(`${text}`)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }
            }}
            className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', color: '#fff', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}
          >
            <span>✉️</span> Share invite link
          </button>
          <button
            onClick={copyLink}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            {copied ? '✅ Copied!' : '🔗 Copy link'}
          </button>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => router.push(`/organizer/${tripId}`)}
          className="w-full py-3 text-sm font-medium mb-4"
          style={{ color: 'var(--muted)' }}
        >
          Go to dashboard →
        </button>
      </div>
    )
  }

  return null
}
