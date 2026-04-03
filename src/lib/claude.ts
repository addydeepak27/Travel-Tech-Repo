import Anthropic from '@anthropic-ai/sdk'
import type { AvatarType, BudgetTier, Hotel, ItineraryDay, ItineraryPlan, ForYouCallout, VotePace, Member } from '@/types'
import { AVATAR_META, BUDGET_TIER_META } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Destination suggestions ────────────────────────────────────────────────

export async function generateDestinations(
  avatarDistribution: Record<AvatarType, number>,
  budgetTier: BudgetTier,
  tripDurationDays: number
): Promise<{ name: string; emoji: string; estimated_cost: string; reason: string; hotel_range: string }[]> {
  const avatarSummary = Object.entries(avatarDistribution)
    .filter(([, count]) => count > 0)
    .map(([avatar, count]) => `${count}× ${AVATAR_META[avatar as AvatarType].label}`)
    .join(', ')

  const prompt = `You are a travel expert for Indian domestic travel. Suggest exactly 3 destinations for a group trip.

Group profile:
- Avatar mix: ${avatarSummary}
- Budget tier: ${BUDGET_TIER_META[budgetTier].label} (${BUDGET_TIER_META[budgetTier].range} per person total)
- Trip duration: ${tripDurationDays} days

Rules:
1. All 3 destinations must be achievable within the budget tier
2. Each destination must serve at least 2 avatar types in the group
3. Destinations must be distinct (no two similar vibes)
4. Include estimated total cost per person in INR
5. Include a realistic hotel nightly rate range (per room) for this budget tier at this destination
6. Return ONLY valid JSON, no markdown

Return this exact JSON structure:
[
  { "name": "Destination name", "emoji": "single emoji", "estimated_cost": "₹X,XXX–₹X,XXX", "reason": "One sentence why this fits this group's avatar mix and budget", "hotel_range": "₹X,XXX–₹X,XXX/night" },
  ...
]`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (response.content[0] as { type: string; text: string }).text
    return JSON.parse(text)
  } catch {
    // Fallback destinations if Claude fails
    return [
      { name: 'Goa', emoji: '🏖', estimated_cost: '₹7,000–₹12,000', reason: 'Beaches, food, and nightlife for mixed groups on a comfortable budget.', hotel_range: '₹2,000–₹4,000/night' },
      { name: 'Manali', emoji: '🏔', estimated_cost: '₹9,000–₹14,000', reason: 'Adventure activities and scenic landscapes for active groups.', hotel_range: '₹2,500–₹5,000/night' },
      { name: 'Pondicherry', emoji: '🌿', estimated_cost: '₹6,000–₹10,000', reason: 'Relaxed French Quarter, beaches, and food for a chill group escape.', hotel_range: '₹1,800–₹3,500/night' },
    ]
  }
}

// ── Hotel shortlist ────────────────────────────────────────────────────────

export async function generateHotels(
  destination: string,
  avatarDistribution: Record<AvatarType, number>,
  budgetTier: BudgetTier,
  groupSize: number,
  tripDurationDays: number
): Promise<Hotel[]> {
  const topAvatars = Object.entries(avatarDistribution)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([avatar]) => ({
      avatar,
      preference: AVATAR_META[avatar as AvatarType].hotel_preference,
    }))

  const tierMeta = BUDGET_TIER_META[budgetTier]
  const rangeParts = tierMeta.range.replace(/[₹,+]/g, '').trim().split('–')
  const maxBudget = rangeParts[1] ? parseInt(rangeParts[1]) : parseInt(rangeParts[0]) * 2

  const prompt = `You are a hotel expert for Indian domestic travel. Suggest exactly 3 hotels in ${destination}.

Group profile:
- Size: ${groupSize} people
- Trip duration: ${tripDurationDays} nights
- Budget tier: ${tierMeta.label} (${tierMeta.range}/person total trip)
- Max per-person accommodation budget: ₹${Math.round(maxBudget * 0.4).toLocaleString('en-IN')} (40% of trip budget)
- Top avatar preferences:
${topAvatars.map((a, i) => `  ${i + 1}. ${AVATAR_META[a.avatar as AvatarType].label}: ${a.preference}`).join('\n')}

Rules:
1. Hotel 1: Slightly below the budget midpoint (budget-friendly option)
2. Hotel 2: At the budget midpoint (recommended pick — mark as recommended: true)
3. Hotel 3: Slightly above the midpoint (premium stretch option)
4. Together, the 3 hotels must cover the top 3 avatar preferences above
5. Each hotel must have 1 honest caveat (not a selling point — a real trade-off)
6. Per-person cost = (room rate × nights) / 2 (assuming 2 per room)
7. Return ONLY valid JSON, no markdown

Return this exact JSON structure:
[
  {
    "name": "Hotel name",
    "neighbourhood": "Area name",
    "stars": 3,
    "price_per_night": 3000,
    "total_per_person": 6000,
    "highlights": ["Highlight 1", "Highlight 2"],
    "caveat": "One honest trade-off",
    "booking_url": "https://www.makemytrip.com/hotels/",
    "recommended": false,
    "lat": 15.2993,
    "lng": 74.1240
  }
]`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (response.content[0] as { type: string; text: string }).text
    const hotels = JSON.parse(text)
    return hotels.map((h: Hotel & { recommended?: boolean }) => ({
      ...h,
      map_image_url: null, // populated separately
    }))
  } catch {
    // Fallback hotel list
    return [
      {
        name: 'Zostel ' + destination,
        neighbourhood: 'City Centre',
        stars: 2,
        price_per_night: 800,
        total_per_person: 1600,
        highlights: ['Social common areas', 'Walking distance to main attractions'],
        caveat: 'Shared dormitories in the standard tier — book private rooms for more privacy.',
        booking_url: 'https://www.zostel.com',
        map_image_url: null,
        lat: null,
        lng: null,
      },
    ]
  }
}

// ── Itinerary + For You callouts ───────────────────────────────────────────

export async function generateItinerary(
  destination: string,
  hotel: Hotel,
  avatarDistribution: Record<AvatarType, number>,
  budgetTier: BudgetTier,
  paceDistribution: Record<VotePace, number>,
  tripDurationDays: number,
  members: Pick<Member, 'id' | 'avatar' | 'budget_tier' | 'spend_vote'>[],
  tripId: string,
  paceOverride?: VotePace
): Promise<{ plans: ItineraryPlan[]; itinerary: ItineraryDay[]; for_you: ForYouCallout[] }> {
  const topAvatars = Object.entries(avatarDistribution)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([avatar, count]) => `${count}× ${AVATAR_META[avatar as AvatarType].label}`)

  const dominantPace = paceOverride ?? Object.entries(paceDistribution)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'balanced_mix'

  const tierMeta = BUDGET_TIER_META[budgetTier]

  const prompt = `You are a travel itinerary expert for Indian domestic travel. Create 3 distinct 3-day itinerary plans for ${destination}.

Hotel: ${hotel.name}, ${hotel.neighbourhood}
Budget tier: ${tierMeta.label} (${tierMeta.range}/person total)
Daily spend ceiling: ${tierMeta.daily_spend_ranges[1]} per person
Group avatar mix: ${topAvatars.join(', ')}
Group pace preference hint: ${dominantPace.replace(/_/g, ' ')}

STRICT RULES — violating any rule makes the response invalid:
1. Return ONLY valid JSON. No markdown, no commentary, no code fences.
2. Exactly 3 plans in the plans array.
3. Plan labels must be exactly: "Chill", "Party", "Balanced".
4. Exactly 3 days per plan, exactly 3 activities per day.
5. Each activity title: 6 words or fewer.
6. Activities clustered near the hotel — minimise travel.
7. No activity costs more than the daily spend ceiling.
8. Top 2 avatars by count drive the day structure across all plans.
9. Foodie present → all meal activities are named venues (not "grab food").
10. Adventure Seeker present → 1 outdoor activity per day in Packed & Active plan.
11. Photographer present → 1 golden hour slot per day with exact time in title.

Return this exact JSON structure:
{
  "plans": [
    {
      "label": "Chill Mode",
      "days": [
        {
          "day": 1,
          "date": "Day 1",
          "title": "Arrival & unwind",
          "activities": [
            { "time": "09:00", "title": "Six words max here", "description": "1-2 sentences", "cost_per_person": 500, "type": "activity" }
          ]
        }
      ]
    }
  ]
}`

  let plans: ItineraryPlan[] = []

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (response.content[0] as { type: string; text: string }).text
    const parsed = JSON.parse(text)
    plans = parsed.plans
  } catch {
    // Minimal fallback — 3 identical plans with different labels
    const fallbackDays: ItineraryDay[] = Array.from({ length: 3 }, (_, i) => ({
      day: i + 1,
      date: `Day ${i + 1}`,
      title: i === 0 ? 'Arrival & exploration' : i === 2 ? 'Final day & departure' : `Day ${i + 1} — ${destination}`,
      activities: [
        { time: '10:00', title: 'Explore the area', description: `Discover ${destination} at your own pace.`, cost_per_person: 0, type: 'free' as const },
        { time: '13:00', title: 'Lunch spot nearby', description: 'Local restaurant near the hotel.', cost_per_person: 300, type: 'food' as const },
        { time: '19:00', title: 'Group dinner out', description: 'Group dinner at a recommended spot.', cost_per_person: 500, type: 'food' as const },
      ],
    }))
    plans = [
      { label: 'Chill', days: fallbackDays },
      { label: 'Party', days: fallbackDays },
      { label: 'Balanced', days: fallbackDays },
    ]
  }

  // Use the Balanced Mix plan (index 1) as the primary for For You callouts
  const itinerary: ItineraryDay[] = plans[1]?.days ?? plans[0]?.days ?? []

  // Generate For You callouts per member per day
  const for_you: ForYouCallout[] = []

  for (const member of members) {
    if (!member.avatar) continue
    const avatarMeta = AVATAR_META[member.avatar]

    for (const day of itinerary) {
      let callout = ''

      switch (member.avatar) {
        case 'navigator':
          callout = `Day ${day.day}: Check travel times between activities — build in 15–20 min buffers for local transport.`
          break
        case 'budgeteer': {
          const dayCost = day.activities.reduce((sum, a) => sum + (a.cost_per_person ?? 0), 0)
          callout = `Day ${day.day} total: ~₹${dayCost.toLocaleString('en-IN')}/person based on listed activities.`
          break
        }
        case 'foodie': {
          const mealActivity = day.activities.find(a => a.type === 'food')
          callout = mealActivity
            ? `Day ${day.day}: ${mealActivity.title} — call ahead or book online before arrival.`
            : `Day ${day.day}: Shortlist 2–3 backup restaurants in case the primary option is full.`
          break
        }
        case 'photographer': {
          const photoActivity = day.activities.find(a => a.type === 'photo' || a.title.toLowerCase().includes('golden'))
          callout = photoActivity
            ? `Day ${day.day}: ${photoActivity.title} at ${photoActivity.time} — arrive 15 min early for the best light.`
            : `Day ${day.day}: Golden hour is typically around 6:00–6:30pm. Scout a rooftop or open spot.`
          break
        }
        case 'adventure_seeker': {
          const adventure = day.activities.find(a => a.type === 'activity')
          callout = adventure
            ? `Day ${day.day}: ${adventure.title} — check if permits or advance booking are required.`
            : `Day ${day.day}: Look for a local activity or water sport that fits the group's energy.`
          break
        }
        case 'spontaneous_one': {
          const freeSlot = day.activities.find(a => a.type === 'free')
          callout = freeSlot
            ? `Day ${day.day}: Free slot at ${freeSlot.time} is yours. The group doesn't know what's coming — keep it that way.`
            : `Day ${day.day}: Keep 1–2 hours unplanned. That's where the best moments happen.`
          break
        }
        case 'planner':
          callout = `Day ${day.day}: ${day.activities.length} activities planned. Flag anything that needs advance confirmation.`
          break
        default:
          callout = `Day ${day.day}: ${day.title}`
      }

      for_you.push({ member_id: member.id, trip_id: tripId, day: day.day, callout })
    }

    // Suppress unused variable warning
    void avatarMeta
  }

  return { plans, itinerary, for_you }
}

// ── Organiser cost tips ────────────────────────────────────────────────────

export async function generateCostTips(
  destination: string,
  budgetZone: { min: number; max: number },
  groupSize: number,
  tripDurationDays: number
): Promise<{ title: string; tip: string }[]> {
  const prompt = `You are a budget travel expert for Indian domestic travel. Give 3 practical cost-saving tips for a group trip.

Destination: ${destination}
Group size: ${groupSize} people
Trip duration: ${tripDurationDays} days
Budget zone: ₹${budgetZone.min.toLocaleString('en-IN')}–₹${budgetZone.max.toLocaleString('en-IN')}/person total

Rules:
1. Tips must be specific to ${destination} and actionable before the trip
2. Each tip must include a real INR saving estimate
3. Tips should cover different categories (accommodation, transport, food/activities)
4. 2–3 sentences max per tip
5. Return ONLY valid JSON, no markdown

Return this exact JSON:
[
  { "title": "Short title (5 words max)", "tip": "Actionable tip with specific saving in INR." }
]`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (response.content[0] as { type: string; text: string }).text
    return JSON.parse(text)
  } catch {
    return [
      { title: 'Book mid-week travel', tip: `${destination} flights and hotels run 20–35% cheaper on Tuesday–Thursday. A 2-day date shift can save ₹1,500–₹2,500/person.` },
      { title: 'Share one cab from airport', tip: `A Tempo Traveller fits ${groupSize} people at ₹2,500 flat. Individual Ubers cost 80–100% more.` },
      { title: 'Villa over hotel rooms', tip: `For ${groupSize} people, a private villa costs less per person than individual hotel rooms and keeps the group together.` },
    ]
  }
}
