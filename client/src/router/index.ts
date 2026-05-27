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
  Router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()

    // Wait for auth to be ready on first load
    if (!authStore.isReady) {
      await authStore.init()
    }

    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

    if (requiresAuth && !authStore.isAdmin) {
      // Not logged in or not an admin → send to login
      next({ name: 'admin-login', query: { redirect: to.fullPath } })
    } else if (to.name === 'admin-login' && authStore.isAdmin) {
      // Already admin, trying to visit login → go to dashboard
      next({ name: 'admin-dashboard' })
    } else {
      next()
    }
  })

  return Router
})
