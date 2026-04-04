import type { MemberStatus, AvatarType, BudgetTier } from '@/types'

export const ACTIVE_MEMBER_STATUSES: MemberStatus[] = [
  'consented', 'avatar_selected', 'avatar_selection', 'pref_q1', 'pref_q2',
  'pref_q3', 'pref_q4', 'active',
]

export function getVoteWindowHours(departureDate: string | null): number {
  if (!departureDate) return 48
  const daysUntilDeparture = Math.ceil(
    (new Date(departureDate).getTime() - Date.now()) / 86400000
  )
  return daysUntilDeparture <= 5 ? 6 : 48
}

export const AVATAR_ASSUMED_BUDGET: Record<AvatarType, BudgetTier> = {
  planner: 'comfortable',
  navigator: 'comfortable',
  budgeteer: 'backpacker',
  foodie: 'premium',
  adventure_seeker: 'comfortable',
  photographer: 'premium',
  spontaneous_one: 'comfortable',
}

export const AVATAR_MAP: Record<string, AvatarType> = {
  '1': 'navigator', '2': 'budgeteer', '3': 'foodie',
  '4': 'adventure_seeker', '5': 'photographer', '6': 'spontaneous_one',
}

export const BUDGET_MAP: Record<string, BudgetTier> = {
  '1': 'backpacker', '2': 'comfortable', '3': 'premium', '4': 'luxury',
}

export const PACE_MAP: Record<string, string> = {
  '1': 'easy_chill', '2': 'balanced_mix', '3': 'packed_schedule', '4': 'balanced_mix',
}

export const ACTIVITY_MAP: Record<string, string> = {
  '1': 'adventure', '2': 'food_culture', '3': 'relaxation', '4': 'nightlife',
}

export const PRIORITY_MAP: Record<string, string> = {
  '1': 'memories', '2': 'exploring', '3': 'food_drinks', '4': 'thrills',
}
