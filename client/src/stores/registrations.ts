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
import { errorMessage } from 'src/utils/errors'
import type { Registration, RegistrationFormPayload, RegistrationStatus } from 'src/types'

export const useRegistrationsStore = defineStore('registrations', () => {
  /**
   * Only ever populated for admins. Security rules deny reads to everyone else,
   * so `subscribe()` must not be called from public pages.
   */
  const registrations = ref<Registration[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  let unsubscribe: (() => void) | null = null

  /** Admin-only. Newest first. */
  function subscribe() {
    if (unsubscribe) return

    loading.value = true
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'))

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        registrations.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Registration, 'id'>),
        }))
        loading.value = false
      },
      (error) => {
        console.error('Registrations listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load registrations' })
        loading.value = false
      },
    )
  }

  function unsubscribeFromRegistrations() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  /**
   * Public submission. Shape and field names must match isValidRegistration()
   * in firebase/firestore.rules, which whitelists every key.
   */
  async function submit(payload: RegistrationFormPayload) {
    submitting.value = true
    try {
      await addDoc(collection(db, 'registrations'), {
        wrestler: payload.wrestler,
        guardian: payload.guardian,
        address: payload.address,
        emergency: payload.emergency,
        ...(payload.notes ? { notes: payload.notes } : {}),
        // Rules require exactly this value on create; only admins can advance it.
        status: 'new',
        createdAt: serverTimestamp(),
      })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Could not submit the registration. Please try again.'),
        timeout: 6000,
      })
      return false
    } finally {
      submitting.value = false
    }
  }

  async function setStatus(id: string, status: RegistrationStatus) {
    try {
      await updateDoc(doc(db, 'registrations', id), { status })
      Notify.create({ type: 'positive', message: `Marked as ${status}` })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to update status'),
      })
      return false
    }
  }

  async function remove(id: string) {
    try {
      await deleteDoc(doc(db, 'registrations', id))
      Notify.create({ type: 'positive', message: 'Registration deleted' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to delete registration'),
      })
      return false
    }
  }

  return {
    registrations,
    loading,
    submitting,
    subscribe,
    unsubscribeFromRegistrations,
    submit,
    setStatus,
    remove,
  }
})
