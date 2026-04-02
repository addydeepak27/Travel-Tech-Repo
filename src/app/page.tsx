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
  const [departureDate, setDepartureDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
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
  const canProceedDestination = destMode === 'group_vote'
    ? selectedDests.length >= 2
    : selectedDests.length >= 1

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
        departureDate: departureDate || null,
        returnDate: returnDate || null,
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
          {/* Hero */}
          <div className="pt-10 pb-6 text-center">
            {/* Gradient glow blob behind emoji */}
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 blur-2xl opacity-40 rounded-full" style={{ background: 'radial-gradient(circle, #6366f1 0%, #06b6d4 100%)', transform: 'scale(1.8)' }} />
              <div className="relative text-5xl">🌊</div>
            </div>

            <h1 className="text-3xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #fff 30%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Toh Chale
            </h1>

            <p className="text-lg font-bold mt-2">
              Planning should be half the fun.
            </p>

            {/* Social proof pill */}
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc' }}>
              <span>✉️</span> Email-native · No app needed
            </div>

            {/* Value props */}
            <div className="grid grid-cols-3 gap-3 mt-6 text-center">
              {[
                { icon: '🗺️', label: 'Vote on where to go' },
                { icon: '🎭', label: 'Own your squad role' },
                { icon: '📅', label: 'AI builds the plan' },
              ].map(({ icon, label }) => (
                <div key={label} className="rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className="text-xs leading-tight" style={{ color: 'var(--muted)' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
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

          {/* Dates */}
          <div>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--muted)' }}>TRAVEL DATES <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--muted)' }}>Departure</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={departureDate}
                    min={today}
                    max={maxDate}
                    onChange={e => {
                      setDepartureDate(e.target.value)
                      if (returnDate && e.target.value > returnDate) setReturnDate('')
                    }}
                    className="w-full px-3 py-3 rounded-xl text-sm outline-none appearance-none"
                    style={{
                      background: 'var(--card)',
                      border: `1.5px solid ${departureDate ? 'var(--accent)' : 'var(--card-border)'}`,
                      color: departureDate ? 'var(--foreground)' : 'var(--muted)',
                      colorScheme: 'dark',
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--muted)' }}>Return</label>
                <input
                  type="date"
                  value={returnDate}
                  min={departureDate || today}
                  max={maxDate}
                  onChange={e => setReturnDate(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none appearance-none"
                  style={{
                    background: 'var(--card)',
                    border: `1.5px solid ${returnDate ? 'var(--accent)' : 'var(--card-border)'}`,
                    color: returnDate ? 'var(--foreground)' : 'var(--muted)',
                    colorScheme: 'dark',
                  }}
                />
              </div>
            </div>
            {departureDate && returnDate && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--accent)' }}>
                {Math.ceil((new Date(returnDate).getTime() - new Date(departureDate).getTime()) / 86400000)} day trip
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
