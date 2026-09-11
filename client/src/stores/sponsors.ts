import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import {
  describeChange,
  planTierChanges,
  sortSponsors,
  type SplitInput,
  type TierChange,
} from 'src/utils/sponsors'
import type { Sponsor, SponsorPrivate, SponsorFormPayload } from 'src/types'

/**
 * Sponsors, stored across two documents per sponsor.
 *
 *   sponsors/{id}                  public read
 *   sponsors/{id}/private/details  admin only
 *
 * The split exists because security rules grant access per document, not per
 * field: contact details and donation figures cannot be hidden inside a
 * publicly readable document, only in a separate one.
 *
 * Everything here is written through `writeBatch`, which is what makes the two
 * halves stay consistent with each other and with the derived tiers.
 */

/** Fixed id: there is exactly one commercial record per sponsor. */
const PRIVATE_DOC = 'details'

function privateRef(sponsorId: string) {
  return doc(db, 'sponsors', sponsorId, 'private', PRIVATE_DOC)
}

export const useSponsorsStore = defineStore('sponsors', () => {
  const sponsors = ref<Sponsor[]>([])
  const loading = ref(false)
  const saving = ref(false)
  let unsubscribe: (() => void) | null = null

  /**
   * Private records, keyed by sponsor id. Admin-only and populated on demand.
   *
   * Never fetched by the public page, which is the point: the figures do not
   * merely go unrendered, they are never requested, so they cannot be read out
   * of the network traffic either.
   */
  const details = ref<Map<string, SponsorPrivate>>(new Map())

  /** Public list, always in display order. */
  const ordered = computed(() => sortSponsors(sponsors.value))

  function subscribe() {
    if (unsubscribe) return

    loading.value = true
    // No orderBy: the sort is tier, then order, then name, which Firestore
    // cannot express without a composite index for a handful of documents.
    unsubscribe = onSnapshot(
      collection(db, 'sponsors'),
      (snapshot) => {
        sponsors.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Sponsor, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Sponsors listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load sponsors' })
        loading.value = false
      },
    )
  }

  function unsubscribeFromSponsors() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    // Dropped rather than retained: no reason to keep contact details and
    // donation figures in memory once the dashboard is closed.
    details.value = new Map()
  }

  // -------------------------------------------------------------------------
  // Private records
  // -------------------------------------------------------------------------

  async function loadDetail(sponsorId: string): Promise<SponsorPrivate> {
    const snap = await getDoc(privateRef(sponsorId))
    const data = snap.exists() ? (snap.data() as SponsorPrivate) : {}
    details.value = new Map(details.value).set(sponsorId, data)
    return data
  }

  /**
   * Loads every private record.
   *
   * Individual reads rather than a collection group query on purpose. A
   * collection group query would need a `match /{path=**}/private/{doc}` rule,
   * which grants far more than this feature needs; a dozen direct reads keeps
   * the rule scoped to `sponsors/{id}/private` and nothing else.
   */
  async function loadAllDetails(): Promise<Map<string, SponsorPrivate>> {
    const entries = await Promise.all(
      sponsors.value.map(async (sponsor) => {
        const snap = await getDoc(privateRef(sponsor.id))
        const data: SponsorPrivate = snap.exists() ? snap.data() : {}
        return [sponsor.id, data] as [string, SponsorPrivate]
      }),
    )
    const map = new Map(entries)
    details.value = map
    return map
  }

  // -------------------------------------------------------------------------
  // Tier recompute
  // -------------------------------------------------------------------------

  /**
   * The split inputs, with one sponsor's values optionally overridden.
   *
   * The override is what lets a save be evaluated against the state it is
   * about to create rather than the state on screen — otherwise an edit that
   * raises a donation would not move anybody until the *next* save.
   */
  function splitInputs(
    detailMap: Map<string, SponsorPrivate>,
    override?: { id: string; name: string; tier: Sponsor['tier']; detail: SponsorPrivate },
    removedId?: string,
  ): SplitInput[] {
    const inputs: SplitInput[] = sponsors.value
      .filter((s) => s.id !== removedId && s.id !== override?.id)
      .map((s) => {
        const detail = detailMap.get(s.id) ?? {}
        return {
          id: s.id,
          name: s.name,
          tier: s.tier,
          amount: detail.amount,
          inKindValue: detail.inKindValue,
          tierLocked: detail.tierLocked,
        }
      })

    if (override) {
      inputs.push({
        id: override.id,
        name: override.name,
        tier: override.tier,
        amount: override.detail.amount,
        inKindValue: override.detail.inKindValue,
        tierLocked: override.detail.tierLocked,
      })
    }

    return inputs
  }

  function reportChanges(changes: TierChange[]) {
    if (changes.length === 0) return
    Notify.create({
      type: 'info',
      timeout: 8000,
      multiLine: true,
      message: `Tiers updated \u2014 ${changes.map(describeChange).join(', ')}`,
    })
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  /**
   * Creates both halves and rebalances the tiers in a single batch.
   *
   * Batched rather than written in sequence: a parent that succeeded while the
   * private write failed would leave a sponsor whose commercial record silently
   * does not exist, with nothing in the UI to say so.
   */
  async function create(payload: SponsorFormPayload) {
    saving.value = true
    try {
      const detailMap = await loadAllDetails()
      // Generated client-side so the new document can take part in the batch
      // and in the tier calculation before it exists.
      const ref = doc(collection(db, 'sponsors'))

      const inputs = splitInputs(detailMap, {
        id: ref.id,
        name: payload.public.name,
        tier: payload.public.tier,
        detail: payload.private,
      })
      const changes = planTierChanges(inputs)
      const finalTier = changes.find((c) => c.id === ref.id)?.to ?? payload.public.tier

      const batch = writeBatch(db)
      batch.set(ref, {
        ...payload.public,
        tier: finalTier,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      batch.set(privateRef(ref.id), {
        ...payload.private,
        updatedAt: serverTimestamp(),
      })
      applyTierChanges(batch, changes, ref.id)
      await batch.commit()

      Notify.create({ type: 'positive', message: 'Sponsor added' })
      reportChanges(changes.filter((c) => c.id !== ref.id))
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to add sponsor'),
      })
      return false
    } finally {
      saving.value = false
    }
  }

  async function update(id: string, payload: SponsorFormPayload) {
    saving.value = true
    try {
      const detailMap = await loadAllDetails()
      const inputs = splitInputs(detailMap, {
        id,
        name: payload.public.name,
        tier: payload.public.tier,
        detail: payload.private,
      })
      const changes = planTierChanges(inputs)
      const finalTier = changes.find((c) => c.id === id)?.to ?? payload.public.tier

      const batch = writeBatch(db)
      batch.update(doc(db, 'sponsors', id), {
        ...payload.public,
        tier: finalTier,
        updatedAt: serverTimestamp(),
      })
      // set() rather than update(): a sponsor created before this feature, or
      // one whose private write was lost, has no document to update.
      batch.set(privateRef(id), { ...payload.private, updatedAt: serverTimestamp() })
      applyTierChanges(batch, changes, id)
      await batch.commit()

      Notify.create({ type: 'positive', message: 'Sponsor updated' })
      reportChanges(changes.filter((c) => c.id !== id))
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to update sponsor'),
      })
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Deletes both documents and rebalances what is left.
   *
   * The private document must be deleted explicitly. Firestore does not remove
   * subcollections when a parent is deleted, so deleting only the sponsor would
   * strand its contact details and donation figure in the database: invisible
   * to every screen in this app, and still there.
   */
  async function remove(id: string) {
    saving.value = true
    try {
      const detailMap = await loadAllDetails()
      const changes = planTierChanges(splitInputs(detailMap, undefined, id))

      const batch = writeBatch(db)
      batch.delete(privateRef(id))
      batch.delete(doc(db, 'sponsors', id))
      applyTierChanges(batch, changes, id)
      await batch.commit()

      Notify.create({ type: 'positive', message: 'Sponsor removed' })
      reportChanges(changes)
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to remove sponsor'),
      })
      return false
    } finally {
      saving.value = false
    }
  }

  function applyTierChanges(
    batch: ReturnType<typeof writeBatch>,
    changes: TierChange[],
    skipId?: string,
  ) {
    for (const change of changes) {
      // The subject of the mutation is written by the caller, with its tier
      // already folded in; writing it twice in one batch is an error.
      if (change.id === skipId) continue
      batch.update(doc(db, 'sponsors', change.id), {
        tier: change.to,
        updatedAt: serverTimestamp(),
      })
    }
  }

  /** What a forced recompute would change, for previewing before it is applied. */
  async function previewRecalculation(): Promise<TierChange[]> {
    const detailMap = await loadAllDetails()
    return planTierChanges(splitInputs(detailMap))
  }

  async function applyRecalculation(changes: TierChange[]) {
    if (changes.length === 0) return true
    saving.value = true
    try {
      const batch = writeBatch(db)
      applyTierChanges(batch, changes)
      await batch.commit()
      Notify.create({
        type: 'positive',
        message: `Updated ${changes.length} tier${changes.length === 1 ? '' : 's'}`,
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to update tiers'),
      })
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    sponsors,
    ordered,
    details,
    loading,
    saving,
    subscribe,
    unsubscribeFromSponsors,
    loadDetail,
    loadAllDetails,
    create,
    update,
    remove,
    previewRecalculation,
    applyRecalculation,
  }
})
