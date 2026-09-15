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
import type { Wrestler, WrestlerPrivate } from 'src/types'

/**
 * The roster.
 *
 *   wrestlers/{id}                  what a bio card may show
 *   wrestlers/{id}/private/details  date of birth, guardian contact
 *
 * Same shape as sponsors, for the same reason: rules grant access per document
 * and never per field, so anything that must not be published has to live in a
 * separate document rather than an unrendered key.
 */

const PRIVATE_DOC = 'details'

function privateRef(wrestlerId: string) {
  return doc(db, 'wrestlers', wrestlerId, 'private', PRIVATE_DOC)
}

export const useWrestlersStore = defineStore('wrestlers', () => {
  const wrestlers = ref<Wrestler[]>([])
  const loading = ref(false)
  const saving = ref(false)
  let unsubscribe: (() => void) | null = null

  /** Private records keyed by wrestler id, fetched only when an admin needs them. */
  const details = ref<Map<string, WrestlerPrivate>>(new Map())

  /** Surname order, which is how anyone looks for a child in a list. */
  const ordered = computed(() =>
    [...wrestlers.value].sort(
      (a, b) => a.lastName.localeCompare(b.lastName)
        || a.firstName.localeCompare(b.firstName),
    ))

  const activeRoster = computed(() => ordered.value.filter((w) => w.active))

  function subscribe() {
    if (unsubscribe) return

    loading.value = true
    unsubscribe = onSnapshot(
      collection(db, 'wrestlers'),
      (snapshot) => {
        wrestlers.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Wrestler, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Wrestlers listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load the roster' })
        loading.value = false
      },
    )
  }

  function unsubscribeFromWrestlers() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    // Dropped rather than kept: no reason to hold dates of birth in memory once
    // the dashboard is closed.
    details.value = new Map()
  }

  async function loadDetail(wrestlerId: string): Promise<WrestlerPrivate> {
    const snap = await getDoc(privateRef(wrestlerId))
    const data: WrestlerPrivate = snap.exists() ? snap.data() : {}
    details.value = new Map(details.value).set(wrestlerId, data)
    return data
  }

  /**
   * Creates both halves in one batch.
   *
   * A parent that landed without its private record would leave a wrestler with
   * no date of birth and therefore no division, silently.
   */
  async function create(
    pub: Omit<Wrestler, 'id' | 'createdAt' | 'updatedAt'>,
    priv: WrestlerPrivate,
  ) {
    saving.value = true
    try {
      const ref = doc(collection(db, 'wrestlers'))
      const batch = writeBatch(db)
      batch.set(ref, { ...pub, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      batch.set(privateRef(ref.id), { ...priv, updatedAt: serverTimestamp() })
      await batch.commit()
      Notify.create({ type: 'positive', message: `${pub.firstName} added to the roster` })
      return ref.id
    } catch (error: unknown) {
      Notify.create({ type: 'negative', message: errorMessage(error, 'Failed to add wrestler') })
      return null
    } finally {
      saving.value = false
    }
  }

  async function update(
    id: string,
    pub: Partial<Omit<Wrestler, 'id'>>,
    priv?: WrestlerPrivate,
  ) {
    saving.value = true
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'wrestlers', id), { ...pub, updatedAt: serverTimestamp() })
      // set() rather than update(): a wrestler created before the private half
      // existed, or one whose private write was lost, has nothing to update.
      if (priv) batch.set(privateRef(id), { ...priv, updatedAt: serverTimestamp() })
      await batch.commit()
      Notify.create({ type: 'positive', message: 'Wrestler updated' })
      return true
    } catch (error: unknown) {
      Notify.create({ type: 'negative', message: errorMessage(error, 'Failed to update wrestler') })
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Deletes both documents.
   *
   * The private record must go explicitly: Firestore leaves subcollections
   * behind when a parent is deleted, which would strand a minor's date of birth
   * and guardian contact in the database, invisible to every screen here.
   *
   * Note this does not remove the wrestler's matches. Deleting a roster entry
   * is rare and usually a mistake; orphaning results is recoverable, deleting
   * them is not.
   */
  async function remove(id: string) {
    saving.value = true
    try {
      const batch = writeBatch(db)
      batch.delete(privateRef(id))
      batch.delete(doc(db, 'wrestlers', id))
      await batch.commit()
      Notify.create({ type: 'positive', message: 'Wrestler removed' })
      return true
    } catch (error: unknown) {
      Notify.create({ type: 'negative', message: errorMessage(error, 'Failed to remove wrestler') })
      return false
    } finally {
      saving.value = false
    }
  }

  function byId(id: string): Wrestler | null {
    return wrestlers.value.find((w) => w.id === id) ?? null
  }

  return {
    wrestlers,
    ordered,
    activeRoster,
    details,
    loading,
    saving,
    subscribe,
    unsubscribeFromWrestlers,
    loadDetail,
    create,
    update,
    remove,
    byId,
  }
})
