import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import { useAuthStore } from 'stores/auth'
import type { XMention, XMentionStatus } from 'src/types'

const COLLECTION = 'xMentions'

/**
 * Posts by other people that mention the club.
 *
 * Two separate subscriptions, because the two audiences are allowed to see
 * different things:
 *
 * - `subscribeApproved()` is safe for the public site. The `where` clause is
 *   not just a filter, it is what makes the query legal: security rules only
 *   grant a read when `status == 'approved'`, and Firestore rejects a list
 *   query it cannot prove is within the rules.
 * - `subscribeQueue()` reads the whole collection and therefore only works for
 *   an admin. Calling it while signed out will fail the rules check.
 */
export const useXMentionsStore = defineStore('xMentions', () => {
  const approved = ref<XMention[]>([])
  const queue = ref<XMention[]>([])
  const loading = ref(false)

  let unsubscribeApproved: (() => void) | null = null
  let unsubscribeQueue: (() => void) | null = null

  /** Newest first. createdAt is an ISO string, so a string sort is chronological. */
  function byNewest(items: XMention[]) {
    return [...items].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  function toMentions(docs: { id: string; data: () => unknown }[]) {
    return docs.map((snap) => ({
      ...(snap.data() as Omit<XMention, 'id'>),
      id: snap.id,
    }))
  }

  const pending = computed(() => queue.value.filter((m) => m.status === 'pending'))
  const reviewed = computed(() => queue.value.filter((m) => m.status !== 'pending'))
  const hasApproved = computed(() => approved.value.length > 0)

  function subscribeApproved() {
    if (unsubscribeApproved) return

    const q = query(collection(db, COLLECTION), where('status', '==', 'approved'))
    unsubscribeApproved = onSnapshot(
      q,
      (snapshot) => {
        approved.value = byNewest(toMentions(snapshot.docs))
      },
      (error) => {
        // Not fatal: the panel simply shows no mentions.
        console.error('Approved mentions listener error:', error)
      },
    )
  }

  /** Admin only. */
  function subscribeQueue() {
    if (unsubscribeQueue) return

    loading.value = true
    unsubscribeQueue = onSnapshot(
      collection(db, COLLECTION),
      (snapshot) => {
        queue.value = byNewest(toMentions(snapshot.docs))
        loading.value = false
      },
      (error) => {
        console.error('Mentions queue listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load mentions' })
        loading.value = false
      },
    )
  }

  function unsubscribeFromXMentions() {
    unsubscribeApproved?.()
    unsubscribeQueue?.()
    unsubscribeApproved = null
    unsubscribeQueue = null
  }

  /**
   * The only field a moderator can change. Rules reject any attempt to alter
   * the post content itself, so approved text cannot be swapped afterwards.
   */
  async function setStatus(id: string, status: XMentionStatus) {
    const auth = useAuthStore()
    try {
      await updateDoc(doc(db, COLLECTION, id), {
        status,
        moderatedBy: auth.user?.email ?? '',
        moderatedAt: serverTimestamp(),
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to update mention'),
      })
      return false
    }
  }

  /** Removes it entirely; the next fetch will not re-add it unless X still
   *  returns it, in which case it comes back as pending. */
  async function remove(id: string) {
    try {
      await deleteDoc(doc(db, COLLECTION, id))
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to delete mention'),
      })
      return false
    }
  }

  return {
    approved,
    queue,
    pending,
    reviewed,
    hasApproved,
    loading,
    subscribeApproved,
    subscribeQueue,
    unsubscribeFromXMentions,
    setStatus,
    remove,
  }
})
