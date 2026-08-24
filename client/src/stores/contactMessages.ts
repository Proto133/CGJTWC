import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import { useAuthStore } from 'stores/auth'
import type { ContactMessage, ContactMessageStatus, ContactFormPayload } from 'src/types'

const COLLECTION = 'contactMessages'

/**
 * Messages from the public contact form.
 *
 * `submit` runs signed out; everything else requires an admin. Rules enforce
 * that split, so a failure here is a genuine error rather than something to
 * paper over — the previous implementation faked success and silently dropped
 * every message.
 */
export const useContactMessagesStore = defineStore('contactMessages', () => {
  const messages = ref<ContactMessage[]>([])
  const loading = ref(false)
  const sending = ref(false)
  let unsubscribe: (() => void) | null = null

  const newMessages = computed(() => messages.value.filter((m) => m.status === 'new'))

  /** Public. Returns false on failure so the page can tell the truth. */
  async function submit(payload: ContactFormPayload) {
    sending.value = true
    try {
      await addDoc(collection(db, COLLECTION), {
        name: payload.name.trim(),
        email: payload.email.trim(),
        message: payload.message.trim(),
        // Rules pin both of these; sending anything else is rejected.
        status: 'new',
        createdAt: serverTimestamp(),
      })
      return true
    } catch (error: unknown) {
      console.error('Contact message failed to send:', error)
      return false
    } finally {
      sending.value = false
    }
  }

  /** Admin only. */
  function subscribe() {
    if (unsubscribe) return

    loading.value = true
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        messages.value = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as Omit<ContactMessage, 'id'>),
          id: docSnap.id,
        }))
        loading.value = false
      },
      (error) => {
        console.error('Contact messages listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load messages' })
        loading.value = false
      },
    )
  }

  function unsubscribeFromContactMessages() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  /**
   * Triage fields only. Rules reject any attempt to change what the sender
   * wrote, so the record of the original message cannot drift.
   */
  async function update(
    id: string,
    changes: { status?: ContactMessageStatus; assignedTo?: string; adminNotes?: string },
  ) {
    const auth = useAuthStore()
    try {
      await updateDoc(doc(db, COLLECTION, id), {
        ...changes,
        updatedAt: serverTimestamp(),
        updatedBy: auth.user?.email ?? '',
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to update message'),
      })
      return false
    }
  }

  async function remove(id: string) {
    try {
      await deleteDoc(doc(db, COLLECTION, id))
      Notify.create({ type: 'positive', message: 'Message deleted' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to delete message'),
      })
      return false
    }
  }

  return {
    messages,
    newMessages,
    loading,
    sending,
    submit,
    subscribe,
    unsubscribeFromContactMessages,
    update,
    remove,
  }
})
