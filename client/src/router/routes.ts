import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('pages/IndexPage.vue') },
      { path: 'about', name: 'about', component: () => import('pages/AboutPage.vue') },
      { path: 'staff', name: 'staff', component: () => import('pages/StaffPage.vue') },
      { path: 'register', name: 'register', component: () => import('pages/RegisterPage.vue') },
      { path: 'schedule', name: 'schedule', component: () => import('pages/EventsPage.vue') },
      { path: 'announcements', name: 'announcements', component: () => import('pages/AnnouncementsPage.vue') },
      { path: 'contact', name: 'contact', component: () => import('pages/ContactPage.vue') },
    ],
  },

  // Admin area - uses its own layout
  {
    path: '/admin',
    component: () => import('layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'login',
        name: 'admin-login',
        component: () => import('pages/admin/LoginPage.vue'),
        meta: { requiresAuth: false },
      },
      {
        path: '',
        name: 'admin-dashboard',
        component: () => import('pages/admin/DashboardPage.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },

  // Always leave this as last one
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
