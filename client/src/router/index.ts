import { route } from 'quasar/wrappers'
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import routes from './routes'
import { useAuthStore } from 'stores/auth'

export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })

  // Global auth guard
  Router.beforeEach(async (to) => {
    const authStore = useAuthStore()

    // Wait for auth to be ready on first load
    if (!authStore.isReady) {
      await authStore.init()
    }

    // Use the merged `to.meta` rather than `to.matched.some(...)`: meta from
    // matched records is merged parent → child, so the login route's
    // `requiresAuth: false` correctly overrides the `/admin` parent's `true`.
    // Using `.some()` here made the login page itself look protected and
    // caused an infinite redirect loop back to `/admin/login`.
    const requiresAuth = to.meta.requiresAuth === true

    if (requiresAuth && !authStore.isAdmin) {
      // Not logged in or not an admin → send to login
      return { name: 'admin-login', query: { redirect: to.fullPath } }
    }

    if (to.name === 'admin-login' && authStore.isAdmin) {
      // Already admin, trying to visit login → go to dashboard
      return { name: 'admin-dashboard' }
    }

    return true
  })

  return Router
})
