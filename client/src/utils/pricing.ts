import type { PricingTier } from 'src/config/organization'

/**
 * Splitting registration fees into base rates and per-extra-wrestler rates.
 *
 * A tier declares this about itself via `additional` and `appliesTo`. Before
 * those fields existed the relationship lived only in the wording of the
 * labels, so there is a fallback for settings saved back then — see
 * `inferLegacy` below. Once an admin saves the pricing section again the
 * declared values take over and the fallback stops being consulted.
 */

/** Matches labels like "Additional Wrestler-Late 10/19/26 or Later". */
const LEGACY_LABEL = /^\s*additional\b/i

/** True when any tier has been explicitly marked, i.e. settings are current. */
function hasDeclared(tiers: PricingTier[]): boolean {
  return tiers.some((t) => t.additional === true)
}

function inferLegacy(tier: PricingTier): boolean {
  return LEGACY_LABEL.test(tier.label)
}

function isAdditional(tier: PricingTier, declared: boolean): boolean {
  return declared ? tier.additional === true : inferLegacy(tier)
}

/** Tiers a registrant may choose as their primary fee. */
export function baseTiers(tiers: PricingTier[]): PricingTier[] {
  const declared = hasDeclared(tiers)
  return tiers.filter((t) => !isAdditional(t, declared))
}

/** Tiers that price extra wrestlers. */
export function additionalTiers(tiers: PricingTier[]): PricingTier[] {
  const declared = hasDeclared(tiers)
  return tiers.filter((t) => isAdditional(t, declared))
}

/**
 * The per-extra-wrestler rate that goes with a chosen base tier, or null when
 * the club has not defined one.
 *
 * With declared pairing this is an exact lookup. Without it, base and
 * additional tiers are paired by position, which is how they were listed when
 * the relationship was implicit: first base with first additional, and so on.
 * Positional matching is a guess, which is precisely why `appliesTo` exists.
 */
export function additionalRateFor(
  tiers: PricingTier[],
  baseTierId: string,
): PricingTier | null {
  if (!baseTierId) return null

  const declared = hasDeclared(tiers)
  const extras = additionalTiers(tiers)
  if (extras.length === 0) return null

  if (declared) {
    return extras.find((t) => t.appliesTo === baseTierId) ?? null
  }

  const bases = baseTiers(tiers)
  const index = bases.findIndex((t) => t.id === baseTierId)
  if (index < 0) return null
  // Falls back to the first extra rate when there are fewer extras than bases,
  // which is better than charging nothing for a sibling.
  return extras[index] ?? extras[0] ?? null
}

/**
 * Total owed for a family: the base fee once, plus the matching additional
 * rate for every wrestler after the first.
 */
export function totalDue(
  tiers: PricingTier[],
  baseTierId: string,
  wrestlerCount: number,
): number {
  const base = tiers.find((t) => t.id === baseTierId)
  const extra = additionalRateFor(tiers, baseTierId)
  const extras = Math.max(0, wrestlerCount - 1)

  return (base?.amount ?? 0) + extras * (extra?.amount ?? 0)
}
