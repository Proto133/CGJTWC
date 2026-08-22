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
import { db, auth } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import type {
  Ticket,
  TicketComment,
  TicketFormPayload,
  TicketStatus,
  TicketPriority,
} from 'src/types'

export const useTicketsStore = defineStore('tickets', () => {
  /** Admin-only; rules deny reads to everyone else. */
  const tickets = ref<Ticket[]>([])
  const loading = ref(false)
  const working = ref<string | null>(null)

  /** Comment threads, keyed by ticket id and loaded on demand. */
  const comments = ref<Record<string, TicketComment[]>>({})

  let unsubscribe: (() => void) | null = null
  const commentUnsubs = new Map<string, () => void>()

  function subscribe() {
    if (unsubscribe) return

    loading.value = true
    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'))

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        tickets.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Ticket, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Tickets listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load tickets' })
        loading.value = false
      },
    )
  }

  function unsubscribeFromTickets() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    commentUnsubs.forEach((stop) => stop())
    commentUnsubs.clear()
  }

  /** Threads are only watched while a ticket is expanded, to limit listeners. */
  function subscribeComments(ticketId: string) {
    if (commentUnsubs.has(ticketId)) return

    const q = query(
      collection(db, 'tickets', ticketId, 'comments'),
      orderBy('createdAt', 'asc'),
    )

    const stop = onSnapshot(
      q,
      (snapshot) => {
        comments.value = {
          ...comments.value,
          [ticketId]: snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<TicketComment, 'id'>),
          })),
        }
      },
      (error) => {
        console.error('Comments listener error:', error)
      },
    )

    commentUnsubs.set(ticketId, stop)
  }

  function unsubscribeComments(ticketId: string) {
    const stop = commentUnsubs.get(ticketId)
    if (stop) {
      stop()
      commentUnsubs.delete(ticketId)
    }
  }

  async function createTicket(payload: TicketFormPayload) {
    working.value = 'new'
    try {
      await addDoc(collection(db, 'tickets'), {
        ...payload,
        ...(payload.pageUrl ? { pageUrl: payload.pageUrl } : {}),
        // Rules pin this: everything starts open and only an owner advances it.
        status: 'open',
        // Attribution must match the caller; rules reject anything else.
        createdByUid: auth.currentUser?.uid ?? '',
        createdByEmail: auth.currentUser?.email ?? '',
        createdAt: serverTimestamp(),
      })
      Notify.create({ type: 'positive', message: 'Submitted. Thanks!' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to submit'),
      })
      return false
    } finally {
      working.value = null
    }
  }

  /** Owner only. Rules reject this for plain admins. */
  async function setStatus(id: string, status: TicketStatus) {
    working.value = id
    try {
      await updateDoc(doc(db, 'tickets', id), { status, updatedAt: serverTimestamp() })
      Notify.create({ type: 'positive', message: `Moved to ${status}` })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Only the owner can change status'),
      })
      return false
    } finally {
      working.value = null
    }
  }

  /** Owner only. */
  async function setPriority(id: string, priority: TicketPriority) {
    working.value = id
    try {
      await updateDoc(doc(db, 'tickets', id), { priority, updatedAt: serverTimestamp() })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Only the owner can change priority'),
      })
      return false
    } finally {
      working.value = null
    }
  }

  /** Owner only. */
  async function removeTicket(id: string) {
    working.value = id
    try {
      await deleteDoc(doc(db, 'tickets', id))
      Notify.create({ type: 'positive', message: 'Ticket deleted' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Only the owner can delete tickets'),
      })
      return false
    } finally {
      working.value = null
    }
  }

  async function addComment(ticketId: string, body: string) {
    try {
      await addDoc(collection(db, 'tickets', ticketId, 'comments'), {
        body,
        // Rules require these to match the caller, so nobody can post as someone else.
        authorUid: auth.currentUser?.uid ?? '',
        authorEmail: auth.currentUser?.email ?? '',
        createdAt: serverTimestamp(),
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to post comment'),
      })
      return false
    }
  }

  async function removeComment(ticketId: string, commentId: string) {
    try {
      await deleteDoc(doc(db, 'tickets', ticketId, 'comments', commentId))
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to delete comment'),
      })
      return false
    }
  }

  return {
    tickets,
    comments,
    loading,
    working,
    subscribe,
    unsubscribeFromTickets,
    subscribeComments,
    unsubscribeComments,
    createTicket,
    setStatus,
    setPriority,
    removeTicket,
    addComment,
    removeComment,
  }
})
