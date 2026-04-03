export const LOCK_THRESHOLD = 0.70  // 70% completion triggers an early lock

/**
 * Returns true if a decision should be locked.
 * Locks when >= 70% have responded, OR the hard deadline has passed.
 */
export function shouldLockDecision(
  completed: number,
  total: number,
  deadline: Date | null
): boolean {
  if (total === 0) return false
  if (completed / total >= LOCK_THRESHOLD) return true
  if (deadline && Date.now() >= deadline.getTime()) return true
  return false
}
