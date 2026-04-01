'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TRENDING_DESTINATIONS, AVATAR_META } from '@/types'
import type { AvatarType } from '@/types'

export default function CreateTrip() {
  const router = useRouter()
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([])
  const [customDestination, setCustomDestination] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType | null>(null)
  const [phone, setPhone] = useState('')
  const [memberPhones, setMemberPhones] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const avatars = Object.entries(AVATAR_META) as [AvatarType, typeof AVATAR_META[AvatarType]][]
  const canProceed = selectedDestinations.length > 0 && selectedAvatar && phone

  function toggleDestination(name: string) {
    setSelectedDestinations(prev =>
      prev.includes(name)
        ? prev.filter(d => d !== name)
        : prev.length < 3 ? [...prev, name] : prev
    )
  }

  function addCustomDestination() {
    const d = customDestination.trim().slice(0, 40) // max 40 chars — prevents prompt injection and UI overflow
    if (d && !selectedDestinations.includes(d) && selectedDestinations.length < 3) {
      setSelectedDestinations(prev => [...prev, d])
      setCustomDestination('')
    }
  }

  async function handleShare() {
    if (!canProceed || loading) return
    setLoading(true)
    setError('')

    const phones = memberPhones
      .split(/[\n,]+/)
      .map(p => p.trim())
      .filter(Boolean)

    try {
      const res = await fetch('/api/trip/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinations: selectedDestinations,
          organizerAvatar: selectedAvatar,
          organizerPhone: phone,
          memberPhones: phones,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Store organizer member ID for this trip (used by organizer dashboard)
      if (data.organizerId) {
        localStorage.setItem(`ts_member_${data.tripId}`, data.organizerId)
      }
      router.push(`/organizer/${data.tripId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="safe-top px-5 pt-6 pb-4">
        <div className="text-2xl font-bold tracking-tight">Toh Chale</div>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          From &quot;let&apos;s go somewhere&quot; to a locked plan — without the group chat chaos.
        </p>
      </div>

      <div className="flex-1 px-5 pb-4 space-y-8 overflow-y-auto">

        {/* Step 1 — Destinations */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base">Where are you thinking?</h2>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {selectedDestinations.length}/3 picked
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TRENDING_DESTINATIONS.map(d => {
              const selected = selectedDestinations.includes(d.name)
              return (
                <button
                  key={d.name}
                  onClick={() => toggleDestination(d.name)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: selected ? 'var(--accent)' : 'var(--card)',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--card-border)'}`,
                    color: selected ? '#fff' : 'var(--foreground)',
                    transform: selected ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  {d.emoji} {d.name}
                </button>
              )
            })}
          </div>
          {/* Custom destination */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              placeholder="Add another destination..."
              value={customDestination}
              onChange={e => setCustomDestination(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomDestination()}
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            />
            <button
              onClick={addCustomDestination}
              disabled={!customDestination.trim() || selectedDestinations.length >= 3}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Add
            </button>
          </div>
          {selectedDestinations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedDestinations.map(d => (
                <span
                  key={d}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                >
                  {d}
                  <button
                    onClick={() => setSelectedDestinations(p => p.filter(x => x !== d))}
                    className="ml-0.5 opacity-70 hover:opacity-100"
                    style={{ minHeight: 'auto', minWidth: 'auto' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Step 2 — Avatar */}
        <section>
          <h2 className="font-semibold text-base mb-1">Pick your role</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            Your role determines what you own in the planning. Mandatory.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {avatars.map(([key, meta]) => {
              const selected = selectedAvatar === key
              return (
                <button
                  key={key}
                  onClick={() => setSelectedAvatar(key)}
                  className="flex flex-col items-start p-3 rounded-2xl text-left transition-all"
                  style={{
                    background: selected ? 'var(--accent-muted)' : 'var(--card)',
                    border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--card-border)'}`,
                  }}
                >
                  <span className="text-2xl mb-1.5">{meta.icon}</span>
                  <span className="font-semibold text-sm leading-tight">{meta.label}</span>
                  <span className="text-xs mt-1 leading-snug" style={{ color: 'var(--muted)' }}>
                    {meta.description.split('.')[0]}.
                  </span>
                  <div className="mt-2 space-y-1">
                    {meta.key_tasks.map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                        <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                  </div>
                  {selected && (
                    <span className="mt-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                      ✓ Selected
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Step 3 — Your phone */}
        <section>
          <h2 className="font-semibold text-base mb-1">Your WhatsApp number</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            You&apos;ll get trip updates and your organiser dashboard here.
          </p>
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
        </section>

        {/* Step 4 — Member phones */}
        <section>
          <h2 className="font-semibold text-base mb-1">Who&apos;s coming?</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            Add WhatsApp numbers — one per line or comma-separated. They&apos;ll get an invite now.
          </p>
          <textarea
            placeholder={`+91 98765 43211\n+91 87654 32100\n+91 76543 21000`}
            value={memberPhones}
            onChange={e => setMemberPhones(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
        </section>

        {error && (
          <p className="text-sm px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {error}
          </p>
        )}
      </div>

      {/* CTA — fixed bottom */}
      <div className="px-5 pt-3 safe-bottom" style={{ borderTop: '1px solid var(--card-border)', background: 'var(--background)' }}>
        <button
          onClick={handleShare}
          disabled={!canProceed || loading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base transition-all disabled:opacity-40"
          style={{ background: canProceed ? 'var(--accent)' : 'var(--card)', color: '#fff' }}
        >
          {loading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>
              <span>Share to WhatsApp</span>
              <span>→</span>
            </>
          )}
        </button>
        {!canProceed && (
          <p className="text-center text-xs mt-2" style={{ color: 'var(--muted)' }}>
            {!selectedDestinations.length ? 'Pick at least 1 destination' : !selectedAvatar ? 'Pick your role to continue' : 'Add your WhatsApp number'}
          </p>
        )}
      </div>
    </div>
  )
}
