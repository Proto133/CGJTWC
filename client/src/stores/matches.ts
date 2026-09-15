import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import { useAuthStore } from 'stores/auth'
import type { Match } from 'src/types'

/**
 * Bouts.
 *
 * A top-level collection rather than a subcollection under each wrestler, so
 * "how did the team do at this tournament" is an ordinary query on eventId
 * rather than a collection group query needing a wildcard rule.
 */

export type NewMatch = Omit<Match, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'date'>
  & { date: Date }

export const useMatchesStore = defineStore('matches', () => {
  const matches = ref<Match[]>([])
  const loading = ref(false)
  const saving = ref(false)
  let unsubscribe: (() => void) | null = null
  let subscribedSeason: string | null = null

  /**
   * Season-scoped on purpose.
   *
   * Every question asked of this data is about one season, and loading a club's
   * entire history to show the current one would grow without limit.
   */
  function subscribeSeason(season: string) {
    if (subscribedSeason === season && unsubscribe) return
    unsubscribeFromMatches()

    subscribedSeason = season
    loading.value = true

    unsubscribe = onSnapshot(
      query(collection(db, 'matches'), where('season', '==', season)),
      (snapshot) => {
        matches.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Match, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Matches listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load results' })
        loading.value = false
      },
    )
  }

  function unsubscribeFromMatches() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    subscribedSeason = null
    matches.value = []
  }

  function forWrestler(wrestlerId: string): Match[] {
    return matches.value.filter((m) => m.wrestlerId === wrestlerId)
  }

  function forEvent(eventId: string): Match[] {
    return matches.value.filter((m) => m.eventId === eventId)
  }

  /**
   * Writes a finished bout.
   *
   * One write at the end rather than per call during the match: gyms have poor
   * signal, and a bout held in local state until it is over needs nothing from
   * the network while it is being scored.
   */
  async function add(input: NewMatch) {
    saving.value = true
    try {
      const auth = useAuthStore()
      // Undefined keys are stripped rather than written: the rules whitelist
      // rejects unknown keys, and Firestore refuses undefined values outright.
      const payload: Record<string, unknown> = {
        ...Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined && value !== ''),
        ),
        date: Timestamp.fromDate(input.date),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: auth.user?.uid ?? '',
      }

      const ref = await addDoc(collection(db, 'matches'), payload)
      Notify.create({ type: 'positive', message: 'Bout saved' })
      return ref.id
    } catch (error: unknown) {
      Notify.create({ type: 'negative', message: errorMessage(error, 'Failed to save the bout') })
      return null
    } finally {
      saving.value = false
    }
  }

  async function update(id: string, changes: Partial<Omit<Match, 'id'>>) {
    saving.value = true
    try {
      await updateDoc(doc(db, 'matches', id), { ...changes, updatedAt: serverTimestamp() })
      Notify.create({ type: 'positive', message: 'Bout updated' })
      return true
    } catch (error: unknown) {
      Notify.create({ type: 'negative', message: errorMessage(error, 'Failed to update the bout') })
      return false
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string) {
    try {
      await deleteDoc(doc(db, 'matches', id))
      Notify.create({ type: 'positive', message: 'Bout deleted' })
      return true
    } catch (error: unknown) {
      Notify.create({ type: 'negative', message: errorMessage(error, 'Failed to delete the bout') })
      return false
    }
  }

  return {
    matches,
    loading,
    saving,
    subscribeSeason,
    unsubscribeFromMatches,
    forWrestler,
    forEvent,
    add,
    update,
    remove,
  }
})
