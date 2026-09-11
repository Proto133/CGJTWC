import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  collection,
  onSnapshot,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  increment,
} from 'firebase/firestore'
import { db } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import { useAuthStore } from 'stores/auth'
import type { AdminThread, AdminThreadMessage } from 'src/types'

/**
 * Admin discussion threads.
 *
 *   adminThreads/{id}                the topic
 *   adminThreads/{id}/messages/{id}  the replies
 *
 * Threads rather than a flat chat: nothing can notify anyone without Cloud
 * Functions, and an asynchronous board is honest about that where a chat is
 * not.
 */

/** Firestore caps a batch at 500 writes. */
const BATCH_LIMIT = 500

export const useAdminThreadsStore = defineStore('adminThreads', () => {
  const threads = ref<AdminThread[]>([])
  const messages = ref<AdminThreadMessage[]>([])
  const loading = ref(false)
  const messagesLoading = ref(false)
  const working = ref(false)

  let unsubscribeThreads: (() => void) | null = null
  let unsubscribeMessages: (() => void) | null = null
  /** Which thread `messages` currently holds, so a stale listener is obvious. */
  const openThreadId = ref<string | null>(null)

  /**
   * Pinned first, then open before resolved, then by most recent activity.
   *
   * Sorted here rather than in the query: three keys would need a composite
   * index for what will only ever be a short list.
   */
  const ordered = computed(() =>
    [...threads.value].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
      const aTime = a.lastMessageAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0
      const bTime = b.lastMessageAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0
      return bTime - aTime
    }))

  function subscribe() {
    if (unsubscribeThreads) return

    loading.value = true
    unsubscribeThreads = onSnapshot(
      collection(db, 'adminThreads'),
      (snapshot) => {
        threads.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AdminThread, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Admin threads listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load discussions' })
        loading.value = false
      },
    )
  }

  /** Messages are only streamed for the thread actually being read. */
  function openThread(threadId: string) {
    closeThread()
    openThreadId.value = threadId
    messagesLoading.value = true

    unsubscribeMessages = onSnapshot(
      query(collection(db, 'adminThreads', threadId, 'messages'), orderBy('createdAt', 'asc')),
      (snapshot) => {
        messages.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AdminThreadMessage, 'id'>),
        }))
        messagesLoading.value = false
      },
      (error) => {
        console.error('Thread messages listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load replies' })
        messagesLoading.value = false
      },
    )
  }

  function closeThread() {
    if (unsubscribeMessages) {
      unsubscribeMessages()
      unsubscribeMessages = null
    }
    openThreadId.value = null
    messages.value = []
  }

  function unsubscribeFromThreads() {
    if (unsubscribeThreads) {
      unsubscribeThreads()
      unsubscribeThreads = null
    }
    closeThread()
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  function author() {
    const auth = useAuthStore()
    return {
      uid: auth.user?.uid ?? '',
      email: auth.user?.email ?? '',
    }
  }

  /**
   * Creates a thread and its opening message together.
   *
   * One batch, so a thread can never exist with the message that explains it
   * missing.
   */
  async function createThread(title: string, body: string) {
    const { uid, email } = author()
    if (!uid) return false

    working.value = true
    try {
      const threadRef = doc(collection(db, 'adminThreads'))
      const batch = writeBatch(db)

      batch.set(threadRef, {
        title: title.trim(),
        createdByUid: uid,
        createdByEmail: email,
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        messageCount: 1,
        pinned: false,
        resolved: false,
      })
      batch.set(doc(collection(threadRef, 'messages')), {
        body: body.trim(),
        authorUid: uid,
        authorEmail: email,
        createdAt: serverTimestamp(),
      })

      await batch.commit()
      Notify.create({ type: 'positive', message: 'Topic started' })
      return threadRef.id
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to start the topic'),
      })
      return false
    } finally {
      working.value = false
    }
  }

  /**
   * Posts a reply and moves the thread's activity stamp in the same batch.
   *
   * Batched because the stamp is what the list sorts on: written separately, a
   * failure would leave a thread with a new reply sitting at the bottom of the
   * list as though nothing had happened.
   */
  async function postMessage(threadId: string, body: string) {
    const { uid, email } = author()
    if (!uid) return false

    working.value = true
    try {
      const threadRef = doc(db, 'adminThreads', threadId)
      const batch = writeBatch(db)

      batch.set(doc(collection(threadRef, 'messages')), {
        body: body.trim(),
        authorUid: uid,
        authorEmail: email,
        createdAt: serverTimestamp(),
      })
      batch.update(threadRef, {
        lastMessageAt: serverTimestamp(),
        // Server-side increment, so two admins replying at once cannot
        // overwrite each other's count with a stale read.
        messageCount: increment(1),
      })

      await batch.commit()
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to post the reply'),
      })
      return false
    } finally {
      working.value = false
    }
  }

  async function setFlags(threadId: string, flags: { pinned?: boolean; resolved?: boolean }) {
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'adminThreads', threadId), flags)
      await batch.commit()
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to update the topic'),
      })
      return false
    }
  }

  async function deleteMessage(threadId: string, messageId: string) {
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'adminThreads', threadId, 'messages', messageId))
      batch.update(doc(db, 'adminThreads', threadId), { messageCount: increment(-1) })
      await batch.commit()
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to delete the reply'),
      })
      return false
    }
  }

  /**
   * Deletes a thread and every message in it.
   *
   * The messages must be removed explicitly. Firestore does not delete a
   * subcollection when its parent goes, so deleting only the thread would leave
   * the whole discussion in the database, unreachable from the UI and still
   * readable by anyone with console access.
   */
  async function deleteThread(threadId: string) {
    working.value = true
    try {
      const threadRef = doc(db, 'adminThreads', threadId)
      const snapshot = await getDocs(collection(threadRef, 'messages'))

      // Chunked: a long-running topic could exceed the 500-write batch cap.
      const refs = snapshot.docs.map((d) => d.ref)
      for (let i = 0; i < refs.length; i += BATCH_LIMIT - 1) {
        const batch = writeBatch(db)
        for (const ref of refs.slice(i, i + BATCH_LIMIT - 1)) batch.delete(ref)
        await batch.commit()
      }

      const finalBatch = writeBatch(db)
      finalBatch.delete(threadRef)
      await finalBatch.commit()

      if (openThreadId.value === threadId) closeThread()
      Notify.create({ type: 'positive', message: 'Topic deleted' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to delete the topic'),
      })
      return false
    } finally {
      working.value = false
    }
  }

  return {
    threads,
    ordered,
    messages,
    loading,
    messagesLoading,
    working,
    openThreadId,
    subscribe,
    unsubscribeFromThreads,
    openThread,
    closeThread,
    createThread,
    postMessage,
    setFlags,
    deleteMessage,
    deleteThread,
  }
})
