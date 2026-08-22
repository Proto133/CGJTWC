import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { db, auth } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import {
  generateSalt,
  deriveKey,
  encryptString,
  decryptString,
  createVerifier,
  verifyKey,
} from 'src/utils/vaultCrypto'
import type { CipherBlob } from 'src/utils/vaultCrypto'
import type { VaultItem, VaultItemInput } from 'src/types'

const META_DOC = 'config'

interface VaultMeta {
  salt: string
  verifier: CipherBlob
}

export const useVaultStore = defineStore('vault', () => {
  const items = ref<VaultItem[]>([])
  const loading = ref(false)
  const busy = ref(false)
  const meta = ref<VaultMeta | null>(null)
  const metaLoaded = ref(false)

  /**
   * The derived key. shallowRef because a CryptoKey must not be made reactive,
   * and this is never persisted anywhere — no localStorage, no Firestore, no
   * cookie. Closing the tab or locking discards it.
   */
  const key = shallowRef<CryptoKey | null>(null)

  const isUnlocked = computed(() => key.value !== null)
  /** False on first run, when no passphrase has been chosen yet. */
  const exists = computed(() => meta.value !== null)

  let unsubscribe: (() => void) | null = null

  async function loadMeta() {
    try {
      const snap = await getDoc(doc(db, 'vaultMeta', META_DOC))
      meta.value = snap.exists() ? (snap.data() as VaultMeta) : null
    } catch (error) {
      console.error('Vault meta read failed:', error)
      meta.value = null
    } finally {
      metaLoaded.value = true
    }
  }

  function subscribe() {
    if (unsubscribe) return
    void loadMeta()

    loading.value = true
    const q = query(collection(db, 'vaultItems'), orderBy('platform', 'asc'))

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        items.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<VaultItem, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Vault listener error:', error)
        loading.value = false
      },
    )
  }

  function unsubscribeFromVault() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    lock()
  }

  /** Discards the key. Everything becomes unreadable again immediately. */
  function lock() {
    key.value = null
  }

  /** First run: choose a passphrase and write the salt plus verifier. */
  async function createVault(passphrase: string) {
    busy.value = true
    try {
      const salt = generateSalt()
      const derived = await deriveKey(passphrase, salt)
      const verifier = await createVerifier(derived)

      await setDoc(doc(db, 'vaultMeta', META_DOC), { salt, verifier })

      meta.value = { salt, verifier }
      key.value = derived
      Notify.create({ type: 'positive', message: 'Vault created and unlocked' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Could not create the vault'),
      })
      return false
    } finally {
      busy.value = false
    }
  }

  async function unlock(passphrase: string) {
    if (!meta.value) return false
    busy.value = true
    try {
      const derived = await deriveKey(passphrase, meta.value.salt)

      // Checked against the stored verifier so a wrong passphrase is reported
      // immediately rather than surfacing later as unreadable items.
      if (!(await verifyKey(derived, meta.value.verifier))) {
        Notify.create({ type: 'negative', message: 'Incorrect passphrase' })
        return false
      }

      key.value = derived
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Could not unlock the vault'),
      })
      return false
    } finally {
      busy.value = false
    }
  }

  /** Decrypts one entry on demand; nothing is bulk-decrypted into memory. */
  async function reveal(item: VaultItem): Promise<string | null> {
    if (!key.value) return null
    try {
      return await decryptString(key.value, item.password)
    } catch {
      // Usually means the item was encrypted under a previous passphrase.
      Notify.create({
        type: 'negative',
        message: 'Could not decrypt this entry with the current passphrase',
      })
      return null
    }
  }

  async function saveItem(input: VaultItemInput, id?: string) {
    if (!key.value) return false
    busy.value = true
    try {
      const password = await encryptString(key.value, input.password)

      const payload = {
        platform: input.platform.trim(),
        label: input.label.trim(),
        ...(input.username?.trim() ? { username: input.username.trim() } : {}),
        ...(input.url?.trim() ? { url: input.url.trim() } : {}),
        ...(input.recoveryEmail?.trim() ? { recoveryEmail: input.recoveryEmail.trim() } : {}),
        ...(input.twoFactor?.trim() ? { twoFactor: input.twoFactor.trim() } : {}),
        ...(input.owner?.trim() ? { owner: input.owner.trim() } : {}),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        password,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email ?? 'unknown',
      }

      if (id) {
        await updateDoc(doc(db, 'vaultItems', id), payload)
      } else {
        await addDoc(collection(db, 'vaultItems'), {
          ...payload,
          createdAt: serverTimestamp(),
        })
      }

      Notify.create({ type: 'positive', message: 'Saved' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Could not save the entry'),
      })
      return false
    } finally {
      busy.value = false
    }
  }

  async function removeItem(id: string) {
    try {
      await deleteDoc(doc(db, 'vaultItems', id))
      Notify.create({ type: 'positive', message: 'Entry deleted' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Could not delete the entry'),
      })
      return false
    }
  }

  /**
   * Re-encrypts every entry under a new passphrase. This is the answer to
   * "someone left the club": a shared secret cannot be revoked per person, so
   * the passphrase has to change and everything has to be rewritten.
   *
   * Deliberately sequential and reported item by item, because a partial
   * failure would leave entries readable only under the old passphrase.
   */
  async function changePassphrase(currentPassphrase: string, nextPassphrase: string) {
    if (!meta.value) return false
    busy.value = true
    try {
      const oldKey = await deriveKey(currentPassphrase, meta.value.salt)
      if (!(await verifyKey(oldKey, meta.value.verifier))) {
        Notify.create({ type: 'negative', message: 'Current passphrase is incorrect' })
        return false
      }

      // Decrypt everything up front: if any entry cannot be read, abort before
      // writing anything rather than ending up half-migrated.
      const plaintexts = new Map<string, string>()
      for (const item of items.value) {
        plaintexts.set(item.id, await decryptString(oldKey, item.password))
      }

      const salt = generateSalt()
      const newKey = await deriveKey(nextPassphrase, salt)
      const verifier = await createVerifier(newKey)

      for (const item of items.value) {
        const plaintext = plaintexts.get(item.id) ?? ''
        await updateDoc(doc(db, 'vaultItems', item.id), {
          password: await encryptString(newKey, plaintext),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email ?? 'unknown',
        })
      }

      await setDoc(doc(db, 'vaultMeta', META_DOC), { salt, verifier })
      meta.value = { salt, verifier }
      key.value = newKey

      Notify.create({
        type: 'positive',
        message: `Passphrase changed and ${items.value.length} entries re-encrypted`,
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Could not change the passphrase'),
        timeout: 8000,
      })
      return false
    } finally {
      busy.value = false
    }
  }

  return {
    items,
    loading,
    busy,
    meta,
    metaLoaded,
    isUnlocked,
    exists,
    subscribe,
    unsubscribeFromVault,
    lock,
    createVault,
    unlock,
    reveal,
    saveItem,
    removeItem,
    changePassphrase,
  }
})
