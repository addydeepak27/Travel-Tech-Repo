import type { AvatarType, MissionTask } from '@/types'

export type TaskDomain =
  | 'activities'   // planner, adventure_seeker
  | 'budget'       // budgeteer
  | 'transport'    // navigator
  | 'food'         // foodie
  | 'photos'       // photographer
  | 'surprises'    // spontaneous_one

/** Canonical avatar → task domain mapping */
export const AVATAR_TASK_DOMAIN: Record<AvatarType, TaskDomain> = {
  planner:          'activities',
  adventure_seeker: 'activities',
  budgeteer:        'budget',
  navigator:        'transport',
  foodie:           'food',
  photographer:     'photos',
  spontaneous_one:  'surprises',
}

export const DOMAIN_META: Record<TaskDomain, { label: string; emoji: string; description: string }> = {
  activities: { label: 'Activity Planner', emoji: '🗓', description: 'Plan + confirm group activities' },
  budget:     { label: 'Money Manager',    emoji: '💸', description: 'Track costs + coordinate payments' },
  transport:  { label: 'Route Master',     emoji: '🚗', description: 'Book + coordinate all transport' },
  food:       { label: 'Food Scout',       emoji: '🍜', description: 'Shortlist restaurants + handle bookings' },
  photos:     { label: 'Memory Keeper',    emoji: '📷', description: 'Capture moments + own the camera roll' },
  surprises:  { label: 'Wildcard',         emoji: '✨', description: 'Hidden gems + surprise moments' },
}

/** All avatars that own a given domain */
export function avatarsForDomain(domain: TaskDomain): AvatarType[] {
  return (Object.entries(AVATAR_TASK_DOMAIN) as [AvatarType, TaskDomain][])
    .filter(([, d]) => d === domain)
    .map(([a]) => a)
}

/** Domain for a given avatar */
export function domainForAvatar(avatar: AvatarType): TaskDomain {
  return AVATAR_TASK_DOMAIN[avatar]
}

/**
 * Assign one task domain per member.
 * Conflict resolution: earlier joined_at wins (response speed proxy).
 * Unmatched members fill unclaimed domains.
 */
export function assignTasks(
  members: Array<{ id: string; avatar: AvatarType | null; joined_at: string | null }>
): Array<{ memberId: string; domain: TaskDomain }> {
  const allDomains = Object.keys(DOMAIN_META) as TaskDomain[]

  // Sort by joined_at ascending — faster responders get domain priority
  const sorted = [...members].sort((a, b) => {
    const ta = a.joined_at ? new Date(a.joined_at).getTime() : Infinity
    const tb = b.joined_at ? new Date(b.joined_at).getTime() : Infinity
    return ta - tb
  })

  const claimedDomains = new Set<TaskDomain>()
  const assignments: Array<{ memberId: string; domain: TaskDomain }> = []
  const unmatched: string[] = []

  // First pass: assign by avatar (first responder wins conflicts)
  for (const member of sorted) {
    if (member.avatar && member.avatar in AVATAR_TASK_DOMAIN) {
      const domain = AVATAR_TASK_DOMAIN[member.avatar]
      if (!claimedDomains.has(domain)) {
        claimedDomains.add(domain)
        assignments.push({ memberId: member.id, domain })
      } else {
        unmatched.push(member.id)
      }
    } else {
      unmatched.push(member.id)
    }
  }

  // Second pass: assign unmatched members to unclaimed domains
  const remainingDomains = allDomains.filter(d => !claimedDomains.has(d))
  for (let i = 0; i < unmatched.length; i++) {
    if (i < remainingDomains.length) {
      assignments.push({ memberId: unmatched[i], domain: remainingDomains[i] })
    } else {
      // More members than domains — cycle through all domains
      assignments.push({ memberId: unmatched[i], domain: allDomains[i % allDomains.length] })
    }
  }

  return assignments
}
