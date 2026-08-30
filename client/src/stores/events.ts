import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import { squadsInUse } from 'src/utils/eventGroups'
import type { Event, EventFormPayload } from 'src/types'

export const useEventsStore = defineStore('events', () => {
  const events = ref<Event[]>([])
  const loading = ref(false)
  let unsubscribe: (() => void) | null = null

  function subscribe() {
    if (unsubscribe) return // already listening

    loading.value = true
    const q = query(collection(db, 'events'), orderBy('date', 'asc'))

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        events.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Event, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Events listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load events' })
        loading.value = false
      }
    )
  }

  function unsubscribeFromEvents() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  // Typed off EventFormPayload rather than restating the fields: the inline
  // shape this replaced had already fallen a field behind when `group` was
  // added, which silently dropped it on create.
  async function createEvent(payload: EventFormPayload) {
    try {
      await addDoc(collection(db, 'events'), {
        ...payload,
        date: Timestamp.fromDate(payload.date),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      Notify.create({ type: 'positive', message: 'Event created successfully' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to create event'),
      })
      return false
    }
  }

  // Takes the form payload rather than Partial<Event>: the form supplies a
  // native Date, which is converted to a Timestamp here before writing.
  async function updateEvent(id: string, payload: Partial<EventFormPayload>) {
    try {
      const updateData: Record<string, unknown> = { ...payload, updatedAt: serverTimestamp() }
      if (payload.date instanceof Date) {
        updateData.date = Timestamp.fromDate(payload.date)
      }
      await updateDoc(doc(db, 'events', id), updateData)
      Notify.create({ type: 'positive', message: 'Event updated' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to update event'),
      })
      return false
    }
  }

  async function deleteEvent(id: string) {
    try {
      await deleteDoc(doc(db, 'events', id))
      Notify.create({ type: 'positive', message: 'Event deleted' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to delete event'),
      })
      return false
    }
  }

  // -------------------------------------------------------------------------
  // Bulk operations
  // -------------------------------------------------------------------------

  /** Firestore caps a batch at 500 writes. */
  const BATCH_LIMIT = 500

  function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
  }

  /** True while a bulk operation is in flight, for disabling the UI. */
  const bulkWorking = ref(false)

  /**
   * Creates many events at once, used by the spreadsheet import.
   *
   * Batched rather than looped: a hundred sequential addDoc calls is slow and,
   * worse, a failure halfway leaves a partly imported schedule that an admin
   * then has to unpick by hand.
   */
  async function createMany(payloads: EventFormPayload[]) {
    if (payloads.length === 0) return true
    bulkWorking.value = true

    try {
      for (const group of chunk(payloads, BATCH_LIMIT)) {
        const batch = writeBatch(db)
        for (const payload of group) {
          // doc() with no id generates one client-side, which is what lets a
          // create take part in a batch at all.
          batch.set(doc(collection(db, 'events')), {
            ...payload,
            date: Timestamp.fromDate(payload.date),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
        await batch.commit()
      }

      Notify.create({
        type: 'positive',
        message: `Imported ${payloads.length} event${payloads.length === 1 ? '' : 's'}`,
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to import events'),
      })
      return false
    } finally {
      bulkWorking.value = false
    }
  }

  /**
   * Applies the same field changes to many events.
   *
   * `changes` carries only the fields the admin explicitly chose to change, so
   * an untouched field is never overwritten with a blank.
   */
  async function updateMany(ids: string[], changes: Partial<EventFormPayload>) {
    if (ids.length === 0 || Object.keys(changes).length === 0) return true
    bulkWorking.value = true

    try {
      const data: Record<string, unknown> = { ...changes, updatedAt: serverTimestamp() }
      if (changes.date instanceof Date) data.date = Timestamp.fromDate(changes.date)

      for (const group of chunk(ids, BATCH_LIMIT)) {
        const batch = writeBatch(db)
        for (const id of group) batch.update(doc(db, 'events', id), data)
        await batch.commit()
      }

      Notify.create({
        type: 'positive',
        message: `Updated ${ids.length} event${ids.length === 1 ? '' : 's'}`,
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to update events'),
      })
      return false
    } finally {
      bulkWorking.value = false
    }
  }

  async function deleteMany(ids: string[]) {
    if (ids.length === 0) return true
    bulkWorking.value = true

    try {
      for (const group of chunk(ids, BATCH_LIMIT)) {
        const batch = writeBatch(db)
        for (const id of group) batch.delete(doc(db, 'events', id))
        await batch.commit()
      }

      Notify.create({
        type: 'positive',
        message: `Deleted ${ids.length} event${ids.length === 1 ? '' : 's'}`,
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to delete events'),
      })
      return false
    } finally {
      bulkWorking.value = false
    }
  }

  /**
   * The distinct squad names across the whole schedule, e.g. ['NS', 'TBI'].
   *
   * Derived rather than configured, which is what makes the free-text group
   * field workable: filter chips and the form's suggestions both come from
   * here, so a renamed squad propagates with no migration and no settings edit.
   */
  const squads = computed(() => squadsInUse(events.value))

  /**
   * Midnight this morning, not the current instant.
   *
   * An event's time is free text ("All Day", "4:15-5:15"), so there is no
   * knowing when it ends. Comparing against `now` moved today's tournament into
   * "Past" the moment its start time passed — or immediately, for a date-only
   * event stored at midnight. An event stays upcoming for the whole of its day.
   */
  function startOfToday() {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }

  // Computed helpers
  const upcomingEvents = () => {
    const cutoff = startOfToday()
    return events.value.filter((e) => e.date.toDate() >= cutoff)
  }

  const pastEvents = () => {
    const cutoff = startOfToday()
    return events.value.filter((e) => e.date.toDate() < cutoff)
  }

  return {
    events,
    loading,
    bulkWorking,
    squads,
    subscribe,
    unsubscribeFromEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    createMany,
    updateMany,
    deleteMany,
    upcomingEvents,
    pastEvents,
  }
})
