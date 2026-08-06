import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from 'src/firebase'
import { Notify } from 'quasar'
import { errorCode } from 'src/utils/errors'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAdmin = ref(false)
  const isReady = ref(false)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  async function checkAdminStatus(uid: string): Promise<boolean> {
    try {
      const adminDoc = await getDoc(doc(db, 'admins', uid))
      return adminDoc.exists()
    } catch (error) {
      console.error('Error checking admin status', error)
      return false
    }
  }

  async function init() {
    if (isReady.value) return

    return new Promise<void>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        void (async () => {
          user.value = firebaseUser

          if (firebaseUser) {
            isAdmin.value = await checkAdminStatus(firebaseUser.uid)
          } else {
            isAdmin.value = false
          }

          isReady.value = true
          unsubscribe() // we only need this once for initial load
          resolve()
        })()
      })
    })
  }

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      user.value = credential.user
      isAdmin.value = await checkAdminStatus(credential.user.uid)

      if (!isAdmin.value) {
        Notify.create({
          type: 'warning',
          message: 'Login successful but you do not have admin access yet. Contact the site owner.',
        })
        await signOut(auth)
        user.value = null
        return false
      }

      Notify.create({
        type: 'positive',
        message: 'Welcome back, admin!',
      })
      return true
    } catch (error: unknown) {
      let message = 'Login failed. Please check your credentials.'
      if (errorCode(error) === 'auth/invalid-credential') {
        message = 'Invalid email or password.'
      }
      Notify.create({ type: 'negative', message })
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Creates the Firebase Auth account and files a pending access request.
   * Deliberately signs the user back out: the account has no privileges until
   * an existing admin creates /admins/{uid} in the Firebase console.
   */
  async function requestAccess(payload: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    password: string
  }) {
    loading.value = true
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        payload.email,
        payload.password,
      )

      // Field set must match isValidAccessRequest() in firestore.rules.
      await setDoc(doc(db, 'accessRequests', credential.user.uid), {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        ...(payload.phone ? { phone: payload.phone } : {}),
        createdAt: serverTimestamp(),
      })

      await signOut(auth)
      user.value = null
      isAdmin.value = false

      Notify.create({
        type: 'positive',
        timeout: 6000,
        message: "Request submitted — you'll get access once an admin approves it.",
      })
      return true
    } catch (error: unknown) {
      const code = errorCode(error)
      let message = 'Could not submit your request. Please try again.'
      if (code === 'auth/email-already-in-use') {
        message = 'An account with that email already exists. Try signing in instead.'
      } else if (code === 'auth/weak-password') {
        message = 'Password must be at least 6 characters.'
      } else if (code === 'auth/invalid-email') {
        message = 'That email address is not valid.'
      } else if (code === 'permission-denied') {
        // Account exists but the request doc was rejected; sign out so the user
        // is not left in a half-registered state.
        message = 'Your account was created but the request could not be saved. Contact the site owner.'
        await signOut(auth)
        user.value = null
      }
      Notify.create({ type: 'negative', message, timeout: 6000 })
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await signOut(auth)
      user.value = null
      isAdmin.value = false
      Notify.create({ type: 'info', message: 'Logged out successfully' })
    } catch {
      Notify.create({ type: 'negative', message: 'Logout failed' })
    }
  }

  return {
    user,
    isAdmin,
    isAuthenticated,
    isReady,
    loading,
    init,
    login,
    logout,
    requestAccess,
  }
})
