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
import type { StaffMember, StaffFormPayload } from 'src/types'

export const useStaffStore = defineStore('staff', () => {
  const staff = ref<StaffMember[]>([])
  const loading = ref(false)
  let unsubscribe: (() => void) | null = null

  function subscribe() {
    if (unsubscribe) return

    loading.value = true
    // Single-field sort, so no composite index is required.
    const q = query(collection(db, 'staff'), orderBy('order', 'asc'))

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        staff.value = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<StaffMember, 'id'>),
          }))
          // Secondary sort by surname for members sharing an order value.
          .sort((a, b) => a.order - b.order || a.lastName.localeCompare(b.lastName))
        loading.value = false
      },
      (error) => {
        console.error('Staff listener error:', error)
        Notify.create({ type: 'negative', message: 'Failed to load staff' })
        loading.value = false
      },
    )
  }

  function unsubscribeFromStaff() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  async function createStaff(payload: StaffFormPayload) {
    try {
      await addDoc(collection(db, 'staff'), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      Notify.create({ type: 'positive', message: 'Staff member added' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to add staff member'),
      })
      return false
    }
  }

  async function updateStaff(id: string, payload: Partial<StaffFormPayload>) {
    try {
      await updateDoc(doc(db, 'staff', id), {
        ...payload,
        updatedAt: serverTimestamp(),
      })
      Notify.create({ type: 'positive', message: 'Staff member updated' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to update staff member'),
      })
      return false
    }
  }

  async function deleteStaff(id: string) {
    try {
      await deleteDoc(doc(db, 'staff', id))
      Notify.create({ type: 'positive', message: 'Staff member removed' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to remove staff member'),
      })
      return false
    }
  }

  return {
    staff,
    loading,
    subscribe,
    unsubscribeFromStaff,
    createStaff,
    updateStaff,
    deleteStaff,
  }
})
