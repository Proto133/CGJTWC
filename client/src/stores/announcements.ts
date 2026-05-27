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
} from 'firebase/firestore'
import { db } from 'src/firebase'
import { Notify } from 'quasar'
import type { Announcement } from 'src/types'

export const useAnnouncementsStore = defineStore('announcements', () => {
  const announcements = ref<Announcement[]>([])
  const loading = ref(false)
  let unsubscribe: (() => void) | null = null

  function subscribe() {
    if (unsubscribe) return

    loading.value = true
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        announcements.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Announcement, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Announcements listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load announcements' })
        loading.value = false
      }
    )
  }

  function unsubscribeFromAnnouncements() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  async function createAnnouncement(payload: {
    title: string
    body: string
    pinned?: boolean
  }) {
    try {
      await addDoc(collection(db, 'announcements'), {
        ...payload,
        pinned: payload.pinned ?? false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      Notify.create({ type: 'positive', message: 'Announcement published' })
      return true
    } catch (error: any) {
      Notify.create({ type: 'negative', message: error.message || 'Failed to publish announcement' })
      return false
    }
  }

  async function updateAnnouncement(id: string, payload: Partial<Announcement>) {
    try {
      await updateDoc(doc(db, 'announcements', id), {
        ...payload,
        updatedAt: serverTimestamp(),
      })
      Notify.create({ type: 'positive', message: 'Announcement updated' })
      return true
    } catch (error: any) {
      Notify.create({ type: 'negative', message: error.message || 'Failed to update announcement' })
      return false
    }
  }

  async function deleteAnnouncement(id: string) {
    try {
      await deleteDoc(doc(db, 'announcements', id))
      Notify.create({ type: 'positive', message: 'Announcement deleted' })
      return true
    } catch (error: any) {
      Notify.create({ type: 'negative', message: error.message || 'Failed to delete announcement' })
      return false
    }
  }

  const pinnedAnnouncements = () => announcements.value.filter((a) => a.pinned)
  const regularAnnouncements = () => announcements.value.filter((a) => !a.pinned)

  return {
    announcements,
    loading,
    subscribe,
    unsubscribeFromAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    pinnedAnnouncements,
    regularAnnouncements,
  }
})
