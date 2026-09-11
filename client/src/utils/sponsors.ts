import type { Sponsor, SponsorSocials, SponsorTier } from 'src/types'

/**
 * Sponsor presentation rules.
 *
 * Kept as pure functions so the ordering, grouping and URL filtering can be
 * exercised without pulling in Firebase, and so the public page and the admin
 * list cannot drift apart on what "Gold" means.
 */

/** Highest first. Also the display order on the public page. */
export const SPONSOR_TIERS: SponsorTier[] = ['gold', 'silver', 'bronze']

const TIER_LABELS: Record<SponsorTier, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
}

export function tierLabel(tier: SponsorTier): string {
  return TIER_LABELS[tier] ?? tier
}

const TIER_RANK: Record<SponsorTier, number> = { gold: 0, silver: 1, bronze: 2 }

/**
 * Only http(s) URLs are ever rendered.
 *
 * These are admin-entered and go into an href or an img src. Filtering here
 * rather than trusting the input keeps a `javascript:` or `data:` URL harmless
 * even if an admin account is compromised. Same guard as the resources page.
 */
export function isSafeUrl(url: string | undefined | null): boolean {
  return /^https?:\/\//i.test((url ?? '').trim())
}

/** Socials reduced to the entries that are actually safe to link. */
export function safeSocials(socials: SponsorSocials | undefined): {
  key: keyof SponsorSocials
  url: string
}[] {
  if (!socials) return []
  const keys: (keyof SponsorSocials)[] = ['facebook', 'instagram', 'x', 'linkedin']
  return keys
    .filter((key) => isSafeUrl(socials[key]))
    .map((key) => ({ key, url: socials[key]!.trim() }))
}

/** Tier first, then the manual order, then name so the result is stable. */
export function sortSponsors(sponsors: Sponsor[]): Sponsor[] {
  return [...sponsors].sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier]
      || a.order - b.order
      || a.name.localeCompare(b.name),
  )
}

export interface SponsorGroup {
  tier: SponsorTier
  label: string
  sponsors: Sponsor[]
}

/**
 * Groups into tiers, dropping empty ones.
 *
 * An empty tier must never render: the club is launching with a single sponsor
 * and two blank "Silver" and "Bronze" headings would read as a broken page
 * rather than an aspirational one.
 */
export function groupByTier(sponsors: Sponsor[]): SponsorGroup[] {
  const sorted = sortSponsors(sponsors)
  return SPONSOR_TIERS
    .map((tier) => ({
      tier,
      label: tierLabel(tier),
      sponsors: sorted.filter((s) => s.tier === tier),
    }))
    .filter((group) => group.sponsors.length > 0)
}

/**
 * Whether the public page should print tier headings at all.
 *
 * With every sponsor in one tier the headings say nothing — a lone "Gold"
 * banner over a single logo looks like a placeholder. They start earning their
 * space once there is a distinction to draw.
 */
export function showTierHeadings(groups: SponsorGroup[]): boolean {
  return groups.length > 1
}

export function activeSponsors(sponsors: Sponsor[]): Sponsor[] {
  return sponsors.filter((s) => s.active)
}

// ---------------------------------------------------------------------------
// Admin-only: the thirds split
// ---------------------------------------------------------------------------
//
// Runs in the dashboard, never on the public page: the input is the donation
// figure, which is private. Its output — the tier — is written to the public
// document, which is why that field is stored rather than computed at render.

/** What the split is scored on. Cash plus the estimated worth of donated goods. */
export function effectiveValue(
  entry: { amount?: number | undefined; inKindValue?: number | undefined },
): number {
  return (entry.amount ?? 0) + (entry.inKindValue ?? 0)
}

export interface SplitInput {
  id: string
  name: string
  tier: SponsorTier
  amount?: number | undefined
  inKindValue?: number | undefined
  tierLocked?: boolean | undefined
}

export interface TierChange {
  id: string
  name: string
  from: SponsorTier
  to: SponsorTier
}

/**
 * Splits sponsors into thirds by effective value: top third Gold, middle
 * Silver, bottom Bronze.
 *
 * Thirds rather than a fixed top three so the split scales with however many
 * sponsors there turn out to be — top three of four is not a tier system.
 *
 * Two groups are excluded and keep whatever tier they already have:
 *
 *   - Locked sponsors, which is the escape hatch for what money cannot express.
 *     They are removed before the thirds are measured, so an in-kind partner
 *     pinned to Gold does not consume a Gold slot the paying sponsors are
 *     competing for.
 *   - Sponsors with no figure at all. A missing amount is not evidence of a
 *     small donation, and defaulting them to Bronze would assert exactly that.
 *
 * Ties break by name so a recompute is stable rather than reshuffling equal
 * sponsors on every write.
 */
export function splitIntoTiers(entries: SplitInput[]): Map<string, SponsorTier> {
  const ranked = entries
    .filter((e) => !e.tierLocked && effectiveValue(e) > 0)
    .sort((a, b) => effectiveValue(b) - effectiveValue(a) || a.name.localeCompare(b.name))

  const result = new Map<string, SponsorTier>()
  const n = ranked.length
  if (n === 0) return result

  // Ceiling on the top group so a single sponsor lands in Gold rather than
  // rounding away to nothing.
  const goldCount = Math.ceil(n / 3)
  const silverCount = Math.ceil((n - goldCount) / 2)

  ranked.forEach((entry, index) => {
    const tier: SponsorTier = index < goldCount
      ? 'gold'
      : index < goldCount + silverCount ? 'silver' : 'bronze'
    result.set(entry.id, tier)
  })

  return result
}

/**
 * What a recompute would change, so it can be shown before it is written.
 *
 * A demotion is invisible to the sponsor by nature. It should not also be
 * invisible to the admin who caused it.
 */
export function planTierChanges(entries: SplitInput[]): TierChange[] {
  const target = splitIntoTiers(entries)
  const changes: TierChange[] = []

  for (const entry of entries) {
    const to = target.get(entry.id)
    if (to && to !== entry.tier) {
      changes.push({ id: entry.id, name: entry.name, from: entry.tier, to })
    }
  }

  return changes
}

/** "Acme Co: Gold → Silver" */
export function describeChange(change: TierChange): string {
  return `${change.name}: ${tierLabel(change.from)} \u2192 ${tierLabel(change.to)}`
}

/** Sponsors the split cannot place, so the dashboard can say so out loud. */
export function unrankedSponsors(entries: SplitInput[]): SplitInput[] {
  return entries.filter((e) => !e.tierLocked && effectiveValue(e) <= 0)
}
