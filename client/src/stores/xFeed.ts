import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from 'src/firebase'
import type { XFeed } from 'src/types'

/**
 * The club's X posts, fetched server-side by the scheduled GitHub Action and
 * cached in Firestore.
 *
 * Read-only by design: the browser has no write path to this document, so the
 * store deliberately exposes no mutations. A failed fetch leaves the previous
 * contents in place rather than blanking the panel.
 */
export const useXFeedStore = defineStore('xFeed', () => {
  const feed = ref<XFeed | null>(null)
  const loaded = ref(false)
  let unsubscribe: (() => void) | null = null

  const posts = computed(() => feed.value?.posts ?? [])
  const hasPosts = computed(() => posts.value.length > 0)
  const author = computed(() => feed.value?.author ?? null)

  /** Idempotent: safe to call from more than one component. */
  function subscribe() {
    if (unsubscribe) return

    unsubscribe = onSnapshot(
      doc(db, 'social', 'xFeed'),
      (snap) => {
        feed.value = snap.exists() ? (snap.data() as XFeed) : null
        loaded.value = true
      },
      (error) => {
        // Not fatal: the component falls back to a link to the profile.
        console.error('X feed listener error:', error)
        loaded.value = true
      },
    )
  }

  function unsubscribeFromXFeed() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  return { feed, loaded, posts, hasPosts, author, subscribe, unsubscribeFromXFeed }
})
