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
  Registration,
  RegistrationFormPayload,
  RegistrationStatus,
  PaymentConfirmationInput,
} from 'src/types'

export const useRegistrationsStore = defineStore('registrations', () => {
  /**
   * Only ever populated for admins. Security rules deny reads to everyone else,
   * so `subscribe()` must not be called from public pages.
   */
  const registrations = ref<Registration[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  /** Id of the registration currently being written to, for per-row spinners. */
  const working = ref<string | null>(null)
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
        // A list even for a single wrestler, so the stored shape is uniform.
        wrestlers: payload.wrestlers,
        guardian: payload.guardian,
        address: payload.address,
        emergency: payload.emergency,
        payment: {
          ...payload.payment,
          // Rules reject any other value here: a registrant cannot declare
          // themselves paid, only an admin can, and only with confirmation detail.
          status: 'unpaid',
        },
        // These were previously missing, so the volunteer and referral answers
        // were collected by the form and then dropped here without a trace.
        // Forwarding the whole payload wholesale is deliberately avoided: rules
        // whitelist keys, so an unexpected one rejects the entire submission.
        ...(payload.volunteer ? { volunteer: payload.volunteer } : {}),
        ...(payload.referralSource ? { referralSource: payload.referralSource } : {}),
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

  /**
   * Records or clears a payment.
   *
   * Uses dotted field paths so the registrant-supplied part of the payment map
   * (method, tier, amount due, reference) is preserved. Security rules refuse a
   * 'paid' status without a confirmation reference, a positive amount and a
   * received date, so the identifying detail cannot be omitted.
   */
  async function recordPayment(id: string, input: PaymentConfirmationInput) {
    working.value = id
    try {
      const settled = input.status === 'paid'

      await updateDoc(doc(db, 'registrations', id), {
        'payment.status': input.status,
        'payment.confirmationRef': input.confirmationRef.trim(),
        'payment.amountReceived': input.amountReceived,
        'payment.receivedAt': input.receivedAt,
        ...(input.depositedAt ? { 'payment.depositedAt': input.depositedAt } : {}),
        ...(input.notes ? { 'payment.notes': input.notes } : {}),
        // Who signed off, for the audit trail.
        'payment.confirmedBy': settled ? (auth.currentUser?.email ?? 'unknown') : '',
        'payment.confirmedAt': serverTimestamp(),
      })

      Notify.create({ type: 'positive', message: `Payment marked ${input.status}` })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to record the payment'),
      })
      return false
    } finally {
      working.value = null
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
    working,
    subscribe,
    unsubscribeFromRegistrations,
    submit,
    recordPayment,
    setStatus,
    remove,
  }
})
