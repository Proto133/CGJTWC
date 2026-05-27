import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from 'src/firebase'
import { Notify } from 'quasar'

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
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        user.value = firebaseUser

        if (firebaseUser) {
          isAdmin.value = await checkAdminStatus(firebaseUser.uid)
        } else {
          isAdmin.value = false
        }

        isReady.value = true
        unsubscribe() // we only need this once for initial load
        resolve()
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
    } catch (error: any) {
      let message = 'Login failed. Please check your credentials.'
      if (error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.'
      }
      Notify.create({ type: 'negative', message })
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
    } catch (error) {
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
  }
})
