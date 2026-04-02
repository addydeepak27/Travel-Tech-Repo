export type AvatarType =
  | 'planner'
  | 'navigator'
  | 'budgeteer'
  | 'foodie'
  | 'adventure_seeker'
  | 'photographer'
  | 'spontaneous_one'

export type BudgetTier = 'backpacker' | 'comfortable' | 'premium' | 'luxury'

export type TripStatus =
  | 'draft'
  | 'inviting'
  | 'avatar_collection'
  | 'budget_collection'
  | 'destination_vote'
  | 'hotel_vote'
  | 'itinerary_preferences'
  | 'itinerary_vote'
  | 'locked'
  | 'cancelled'
  | 'destination_vote_pending'
  | 'destination_tiebreaker'
  | 'hotel_tiebreaker'

export type MemberStatus =
  | 'invited'
  | 'consented'
  | 'avatar_selected'
  | 'budget_submitted'
  | 'active'
  | 'declined'
  | 'dropped'
  | 'avatar_selection'
  | 'pref_q1'
  | 'pref_q2'
  | 'pref_q3'
  | 'pref_q4'

export type TaskStatus = 'pending' | 'done' | 'overdue' | 'reassigned'

export type VotePace = 'easy_chill' | 'balanced_mix' | 'packed_schedule'

export type VoteSpend = 'low' | 'mid' | 'high'

export interface Trip {
  id: string
  name: string
  status: TripStatus
  organizer_id: string
  destination_options: string[]
  confirmed_destination: string | null
  confirmed_hotel: Hotel | null
  itinerary: ItineraryDay[] | null
  departure_date: string | null
  return_date: string | null
  group_budget_zone: { min: number; max: number } | null
  weighted_median_tier: BudgetTier | null
  gamification_enabled: boolean
  created_at: string
  travel_code: string | null
  status_updated_at: string | null
  destination_vote_scheduled_at: string | null
  used_fallback: boolean
  itinerary_cost_alert: boolean
}

export interface Member {
  id: string
  trip_id: string
  phone: string | null
  name: string | null
  avatar: AvatarType | null
  avatar_suffix: string | null
  budget_tier: BudgetTier | null
  status: MemberStatus
  pace_vote: VotePace | null
  spend_vote: VoteSpend | null
  points: number
  opt_out: boolean
  joined_at: string | null
  email: string
  activity_pref: string | null
  trip_priority: string | null
  special_requests: string | null
  brownie_points: number
  budget_assumed: boolean
  avatar_auto_assigned: boolean
}

export interface Hotel {
  name: string
  neighbourhood: string
  stars: number
  price_per_night: number
  total_per_person: number
  highlights: string[]
  caveat: string
  booking_url: string
  map_image_url: string | null
  lat: number | null
  lng: number | null
}

export interface ItineraryDay {
  day: number
  date: string
  title: string
  activities: Activity[]
}

export interface Activity {
  time: string
  title: string
  description: string
  cost_per_person: number | null
  type: 'food' | 'activity' | 'transport' | 'free' | 'photo'
}

export interface MissionTask {
  id: string
  trip_id: string
  member_id: string
  avatar: AvatarType
  title: string
  description: string
  deadline: string
  points: number
  status: TaskStatus
  note: string | null
  completed_at: string | null
}

export interface ForYouCallout {
  member_id: string
  trip_id: string
  day: number
  callout: string
}

export interface Vote {
  trip_id: string
  member_id: string
  vote_type: 'destination' | 'hotel' | 'itinerary'
  value: string
  created_at: string
}

export const AVATAR_META: Record<AvatarType, {
  label: string
  icon: string
  description: string
  tasks_removed: string
  key_tasks: { title: string; deadline: string }[]
  pace_default: VotePace
  hotel_preference: string
}> = {
  planner: {
    label: 'The Planner',
    icon: '📋',
    description: 'You own the trip skeleton — timeline, itinerary, and keeping the group on track.',
    tasks_removed: '3 tasks off the organiser',
    key_tasks: [
      { title: 'Finalise itinerary after group vote', deadline: 'T-10' },
      { title: 'Share final trip summary to group', deadline: 'T-2' },
    ],
    pace_default: 'balanced_mix',
    hotel_preference: 'Central location with easy access to multiple areas',
  },
  navigator: {
    label: 'The Navigator',
    icon: '🧭',
    description: 'You own all transport — every pickup, every transfer, every leg.',
    tasks_removed: '4 tasks off the organiser',
    key_tasks: [
      { title: 'Coordinate airport pickup for all members', deadline: 'T-7' },
      { title: 'Confirm Day 1 local transport plan', deadline: 'T-1' },
    ],
    pace_default: 'balanced_mix',
    hotel_preference: 'Near transport hub for easy movement',
  },
  budgeteer: {
    label: 'The Budgeteer',
    icon: '💰',
    description: 'You own pre-trip costs — contributions, splits, and per-person estimates.',
    tasks_removed: '3 tasks off the organiser',
    key_tasks: [
      { title: 'Remind all members to contribute to trip kitty', deadline: 'T-14' },
      { title: 'Share estimated per-person trip total', deadline: 'T-5' },
    ],
    pace_default: 'easy_chill',
    hotel_preference: 'Best value-for-money within budget zone',
  },
  foodie: {
    label: 'The Foodie',
    icon: '🍜',
    description: 'You own all meals — restaurant shortlist, reservations, dietary needs.',
    tasks_removed: '3 tasks off the organiser',
    key_tasks: [
      { title: 'Shortlist 3 restaurant options per day', deadline: 'T-7' },
      { title: 'Confirm dinner reservations Day 1 + 2', deadline: 'T-5' },
    ],
    pace_default: 'easy_chill',
    hotel_preference: 'Walking distance from restaurant clusters and food streets',
  },
  adventure_seeker: {
    label: 'The Adventure Seeker',
    icon: '🏄',
    description: 'You own all activities — research, permits, and group briefings.',
    tasks_removed: '3 tasks off the organiser',
    key_tasks: [
      { title: 'Research and share activity options', deadline: 'T-10' },
      { title: 'Confirm activity plans and share with group', deadline: 'T-7' },
    ],
    pace_default: 'packed_schedule',
    hotel_preference: 'Proximity to beaches, trek entry points, activity hubs',
  },
  photographer: {
    label: 'The Photographer',
    icon: '📷',
    description: 'You own the memories — photo spots, golden hour windows, and the perfect shot.',
    tasks_removed: '2 tasks off the organiser',
    key_tasks: [
      { title: 'Research and share best photo spots', deadline: 'T-7' },
      { title: 'Add golden hour windows to itinerary', deadline: 'T-5' },
    ],
    pace_default: 'balanced_mix',
    hotel_preference: 'Scenic setting or rooftop access near sunrise/sunset spots',
  },
  spontaneous_one: {
    label: 'The Spontaneous One',
    icon: '✨',
    description: 'You own the surprises — hidden gems, backup plans, and the unexpected moments.',
    tasks_removed: '2 tasks off the organiser',
    key_tasks: [
      { title: 'Find and share 2 hidden gems at destination', deadline: 'T-5' },
      { title: 'Prepare and share 1 backup plan per day', deadline: 'T-3' },
    ],
    pace_default: 'packed_schedule',
    hotel_preference: 'Characterful neighbourhood, boutique or hidden-gem properties',
  },
}

export const BUDGET_TIER_META: Record<BudgetTier, {
  label: string
  description: string
  range: string
  daily_spend_ranges: [string, string, string]
}> = {
  backpacker: {
    label: 'Backpacker',
    description: 'Keep it lean',
    range: '< ₹5,000',
    daily_spend_ranges: ['Under ₹200', '₹200–₹600', '₹600–₹1,000'],
  },
  comfortable: {
    label: 'Comfortable',
    description: 'Balanced and easy',
    range: '₹5,000–₹10,000',
    daily_spend_ranges: ['Under ₹500', '₹500–₹1,200', '₹1,200–₹2,500'],
  },
  premium: {
    label: 'Premium',
    description: 'Treat ourselves',
    range: '₹10,000–₹20,000',
    daily_spend_ranges: ['Under ₹800', '₹800–₹2,000', '₹2,000–₹4,000'],
  },
  luxury: {
    label: 'Luxury',
    description: 'No limits',
    range: '₹20,000+',
    daily_spend_ranges: ['Under ₹1,500', '₹1,500–₹3,500', '₹3,500+'],
  },
}

export const TRENDING_DESTINATIONS = [
  { name: 'Goa', emoji: '🏖' },
  { name: 'Manali', emoji: '🏔' },
  { name: 'Pondicherry', emoji: '🌿' },
  { name: 'Jaipur', emoji: '🏰' },
  { name: 'Coorg', emoji: '☕' },
  { name: 'Kedarkantha', emoji: '❄️' },
  { name: 'Udaipur', emoji: '💧' },
  { name: 'Spiti', emoji: '🗻' },
  { name: 'Kerala', emoji: '🌴' },
  { name: 'Kasol', emoji: '🌲' },
]

export const INDIAN_DESTINATIONS = [
  { name: 'Goa', state: 'Goa', emoji: '🏖' },
  { name: 'Manali', state: 'Himachal Pradesh', emoji: '🏔' },
  { name: 'Pondicherry', state: 'Puducherry', emoji: '🌿' },
  { name: 'Jaipur', state: 'Rajasthan', emoji: '🏰' },
  { name: 'Udaipur', state: 'Rajasthan', emoji: '💧' },
  { name: 'Jodhpur', state: 'Rajasthan', emoji: '🔵' },
  { name: 'Jaisalmer', state: 'Rajasthan', emoji: '🏜' },
  { name: 'Pushkar', state: 'Rajasthan', emoji: '🐪' },
  { name: 'Coorg', state: 'Karnataka', emoji: '☕' },
  { name: 'Hampi', state: 'Karnataka', emoji: '🗿' },
  { name: 'Mysuru', state: 'Karnataka', emoji: '🏯' },
  { name: 'Chikmagalur', state: 'Karnataka', emoji: '🌱' },
  { name: 'Munnar', state: 'Kerala', emoji: '🍵' },
  { name: 'Alleppey', state: 'Kerala', emoji: '🚣' },
  { name: 'Varkala', state: 'Kerala', emoji: '🌊' },
  { name: 'Wayanad', state: 'Kerala', emoji: '🌿' },
  { name: 'Kochi', state: 'Kerala', emoji: '⛵' },
  { name: 'Kovalam', state: 'Kerala', emoji: '🏄' },
  { name: 'Spiti', state: 'Himachal Pradesh', emoji: '🗻' },
  { name: 'Kasol', state: 'Himachal Pradesh', emoji: '🌲' },
  { name: 'Dharamshala', state: 'Himachal Pradesh', emoji: '🙏' },
  { name: 'Bir Billing', state: 'Himachal Pradesh', emoji: '🪂' },
  { name: 'Mussoorie', state: 'Uttarakhand', emoji: '🌁' },
  { name: 'Rishikesh', state: 'Uttarakhand', emoji: '🧘' },
  { name: 'Nainital', state: 'Uttarakhand', emoji: '🏞' },
  { name: 'Kedarkantha', state: 'Uttarakhand', emoji: '❄️' },
  { name: 'Chopta', state: 'Uttarakhand', emoji: '⛺' },
  { name: 'Auli', state: 'Uttarakhand', emoji: '⛷' },
  { name: 'Leh', state: 'Ladakh', emoji: '🏔' },
  { name: 'Pangong', state: 'Ladakh', emoji: '💙' },
  { name: 'Zanskar', state: 'Ladakh', emoji: '🏞' },
  { name: 'Darjeeling', state: 'West Bengal', emoji: '🍵' },
  { name: 'Sikkim', state: 'Sikkim', emoji: '🌸' },
  { name: 'Shillong', state: 'Meghalaya', emoji: '🌧' },
  { name: 'Varanasi', state: 'Uttar Pradesh', emoji: '🪔' },
  { name: 'Agra', state: 'Uttar Pradesh', emoji: '🕌' },
  { name: 'Khajuraho', state: 'Madhya Pradesh', emoji: '🗿' },
  { name: 'Orchha', state: 'Madhya Pradesh', emoji: '🏰' },
  { name: 'Jim Corbett', state: 'Uttarakhand', emoji: '🐯' },
  { name: 'Ranthambore', state: 'Rajasthan', emoji: '🐆' },
  { name: 'Andaman', state: 'Andaman & Nicobar', emoji: '🏝' },
  { name: 'Diu', state: 'Dadra & Nagar Haveli', emoji: '🌅' },
  { name: 'Tarkarli', state: 'Maharashtra', emoji: '🤿' },
  { name: 'Mumbai', state: 'Maharashtra', emoji: '🌆' },
  { name: 'Kolkata', state: 'West Bengal', emoji: '🌉' },
  { name: 'Hyderabad', state: 'Telangana', emoji: '🍛' },
  { name: 'Ooty', state: 'Tamil Nadu', emoji: '🚂' },
  { name: 'Majuli', state: 'Assam', emoji: '🏞' },
  { name: 'Kaziranga', state: 'Assam', emoji: '🦏' },
  { name: 'Valley of Flowers', state: 'Uttarakhand', emoji: '🌺' },
] as const
