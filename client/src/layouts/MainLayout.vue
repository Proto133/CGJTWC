<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const leftDrawerOpen = ref(false)

const navLinks = [
  { label: 'Home', to: '/', icon: 'home' },
  { label: 'About', to: '/about', icon: 'info' },
  { label: 'Schedule', to: '/schedule', icon: 'event' },
  { label: 'Announcements', to: '/announcements', icon: 'campaign' },
  { label: 'Contact', to: '/contact', icon: 'mail' },
]

function toggleDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Top Navigation -->
    <q-header class="bg-primary text-white" elevated>
      <q-toolbar class="q-px-md">
        <!-- Logo / Brand -->
        <q-toolbar-title class="text-h6 text-weight-bold">
          <router-link to="/" class="text-white" style="text-decoration: none">
           <q-avatar icon="../../public/assets/JTWC.png"/> Trojans Wrestling Club
          </router-link>
        </q-toolbar-title>

        <!-- Desktop Nav -->
        <div class="desktop-only q-gutter-x-sm">
          <q-btn
            v-for="link in navLinks"
            :key="link.to"
            flat
            :to="link.to"
            :label="link.label"
            :active="route.path === link.to"
            class="text-white"
          />
          <q-btn
            to="/admin"
            flat
            dense
            icon="admin_panel_settings"
            label="Admin"
            class="q-ml-md"
          />
        </div>

        <!-- Mobile Hamburger -->
        <q-btn
          flat
          dense
          round
          icon="menu"
          class="mobile-only"
          @click="toggleDrawer"
        />
      </q-toolbar>
    </q-header>

    <!-- Mobile Drawer -->
    <q-drawer
      v-model="leftDrawerOpen"
      bordered
      class="mobile-only"
    >
      <q-list>
        <q-item
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          clickable
          v-ripple
          @click="leftDrawerOpen = false"
        >
          <q-item-section avatar>
            <q-icon :name="link.icon" />
          </q-item-section>
          <q-item-section>{{ link.label }}</q-item-section>
        </q-item>

        <q-separator />

        <q-item to="/admin" clickable v-ripple @click="leftDrawerOpen = false">
          <q-item-section avatar>
            <q-icon name="admin_panel_settings" />
          </q-item-section>
          <q-item-section>Admin Login</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <!-- Page Content -->
    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Footer -->
    <footer class="site-footer q-pa-md q-mt-xl">
      <div class="row justify-between items-center q-col-gutter-md">
        <div>
          <div class="text-h6 text-weight-bold">Cary Grove Junior Trojans</div>
          <div class="text-caption">Building champions on and off the mat</div>
        </div>

        <div class="text-right text-caption">
          <div>© {{ new Date().getFullYear() }} CGJT Wrestling</div>
          <div>
            <a href="https://x.com/_wetesy_" target="_blank" class="q-ml-sm">X</a>
            <a href="mailto:admin@trojanswrestlingclub.com" class="q-ml-sm">Email</a>
          </div>
        </div>
      </div>
    </footer>
  </q-layout>
</template>

<style scoped>
.text-gold {
  color: #C9A227;
}
</style>
