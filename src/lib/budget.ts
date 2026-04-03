import type { BudgetTier } from '@/types'

const TIER_ORDER: BudgetTier[] = ['backpacker', 'comfortable', 'premium', 'luxury']

export interface BudgetStats {
  counts: Record<BudgetTier, number>
  total: number
  majority: BudgetTier | null   // tier with >50% of responses, else null
  plurality: BudgetTier | null  // tier with the most responses (may not be majority)
  is_aligned: boolean           // true when majority exists (>50% in one tier)
  outlier_tiers: BudgetTier[]  // tiers with exactly 1 response when group has ≥3
}

export function getBudgetStats(
  responses: { budget_tier: BudgetTier | null }[]
): BudgetStats {
  const counts: Record<BudgetTier, number> = {
    backpacker: 0,
    comfortable: 0,
    premium: 0,
    luxury: 0,
  }

  const valid = responses.filter(r => r.budget_tier !== null)
  for (const r of valid) {
    counts[r.budget_tier!]++
  }

  const total = valid.length

  // Plurality: highest count tier (first one wins ties, following tier order)
  let plurality: BudgetTier | null = null
  let maxCount = 0
  for (const tier of TIER_ORDER) {
    if (counts[tier] > maxCount) {
      maxCount = counts[tier]
      plurality = tier
    }
  }

  // Majority: plurality tier only if it represents >50% of responses
  const majority = plurality && counts[plurality] > total / 2 ? plurality : null

  const is_aligned = majority !== null

  // Outlier: single-response tiers when group is large enough to matter
  const outlier_tiers: BudgetTier[] = total >= 3
    ? TIER_ORDER.filter(t => counts[t] === 1 && t !== plurality)
    : []

  return { counts, total, majority, plurality, is_aligned, outlier_tiers }
}
