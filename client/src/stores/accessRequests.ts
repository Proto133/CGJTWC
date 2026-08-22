import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore'
import { db, auth } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import type { AccessRequest } from 'src/types'

export const useAccessRequestsStore = defineStore('accessRequests', () => {
  /** Admin-only: security rules deny these reads to everyone else. */
  const requests = ref<AccessRequest[]>([])
  const loading = ref(false)
  const working = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  function subscribe() {
    if (unsubscribe) return

    loading.value = true
    const q = query(collection(db, 'accessRequests'), orderBy('createdAt', 'desc'))

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        requests.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AccessRequest, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Access requests listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load access requests' })
        loading.value = false
      },
    )
  }

  function unsubscribeFromAccessRequests() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  /**
   * Grants admin access.
   *
   * The request's document ID is the requester's Auth UID, so approval means
   * creating /admins/{sameId} — existence of that document is what the app and
   * the security rules check. Creating the admin doc and clearing the request
   * run in one batch so we can never end up having granted access while the
   * request still sits in the queue, or vice versa.
   */
  async function approve(request: AccessRequest) {
    working.value = request.id
    try {
      const batch = writeBatch(db)

      batch.set(doc(db, 'admins', request.id), {
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.email,
        ...(request.phone ? { phone: request.phone } : {}),
        addedAt: serverTimestamp(),
        // Useful for auditing who let this person in.
        addedBy: auth.currentUser?.email ?? 'unknown',
      })

      batch.delete(doc(db, 'accessRequests', request.id))

      await batch.commit()

      Notify.create({
        type: 'positive',
        message: `${request.firstName} ${request.lastName} is now an admin`,
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to approve the request'),
      })
      return false
    } finally {
      working.value = null
    }
  }

  /** Declines a request by deleting it. The Auth account itself is untouched. */
  async function reject(request: AccessRequest) {
    working.value = request.id
    try {
      await deleteDoc(doc(db, 'accessRequests', request.id))
      Notify.create({ type: 'info', message: 'Request declined' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to decline the request'),
      })
      return false
    } finally {
      working.value = null
    }
  }

  return {
    requests,
    loading,
    working,
    subscribe,
    unsubscribeFromAccessRequests,
    approve,
    reject,
  }
})
