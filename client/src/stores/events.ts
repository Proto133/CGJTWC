import { defineStore } from 'pinia'
import { ref } from 'vue'
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
} from 'firebase/firestore'
import { db } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import type { Event, EventType, EventFormPayload } from 'src/types'

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

  async function createEvent(payload: {
    title: string
    date: Date
    time?: string
    location: string
    type: EventType
    opponent?: string
    description?: string
  }) {
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

  // Computed helpers
  const upcomingEvents = () => {
    const now = new Date()
    return events.value.filter((e) => {
      const eventDate = e.date.toDate()
      return eventDate >= now
    })
  }

  const pastEvents = () => {
    const now = new Date()
    return events.value.filter((e) => e.date.toDate() < now)
  }

  return {
    events,
    loading,
    subscribe,
    unsubscribeFromEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    upcomingEvents,
    pastEvents,
  }
})
