<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from 'stores/auth'
import { useRoute, useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const mode = ref<'signin' | 'request'>('signin')

const email = ref('')
const password = ref('')
const showPassword = ref(false)

// Request-access fields
const firstName = ref('')
const lastName = ref('')
const phone = ref('')

function switchMode(next: 'signin' | 'request') {
  mode.value = next
  password.value = ''
  showPassword.value = false
}

async function handleLogin() {
  const success = await authStore.login(email.value, password.value)
  if (success) {
    const redirect = (route.query.redirect as string) || '/admin'
    void router.push(redirect)
  }
}

async function handleRequestAccess() {
  const success = await authStore.requestAccess({
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    email: email.value.trim(),
    ...(phone.value.trim() ? { phone: phone.value.trim() } : {}),
    password: password.value,
  })

  if (success) {
    firstName.value = ''
    lastName.value = ''
    phone.value = ''
    password.value = ''
    switchMode('signin')
  }
}
</script>

<template>
  <q-page padding class="flex flex-center">
    <q-card class="admin-card" style="width: 100%; max-width: 380px;">
      <q-card-section>
        <div class="text-h5 text-center text-primary q-mb-lg">
          {{ mode === 'signin' ? 'CGJT Admin Login' : 'Request Admin Access' }}
        </div>

        <!-- SIGN IN -->
        <q-form v-if="mode === 'signin'" @submit.prevent="handleLogin" class="q-gutter-md">
          <q-input
            v-model="email"
            type="email"
            label="Email"
            required
            outlined
            autocomplete="username"
          />

          <q-input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Password"
            required
            outlined
            autocomplete="current-password"
          >
            <template #append>
              <q-icon
                :name="showPassword ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <q-btn
            type="submit"
            label="Sign In"
            color="primary"
            class="full-width q-mt-md"
            :loading="authStore.loading"
          />
        </q-form>

        <!-- REQUEST ACCESS -->
        <q-form v-else @submit.prevent="handleRequestAccess" class="q-gutter-md">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input v-model="firstName" label="First Name *" required outlined />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="lastName" label="Last Name *" required outlined />
            </div>
          </div>

          <q-input
            v-model="email"
            type="email"
            label="Email *"
            required
            outlined
            autocomplete="username"
          />

          <q-input
            v-model="phone"
            type="tel"
            label="Phone (optional)"
            outlined
            autocomplete="tel"
          />

          <q-input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Choose a Password *"
            required
            outlined
            autocomplete="new-password"
            hint="At least 6 characters"
            :rules="[(val: string) => val.length >= 6 || 'Password must be at least 6 characters']"
          >
            <template #append>
              <q-icon
                :name="showPassword ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <q-btn
            type="submit"
            label="Submit Request"
            color="primary"
            class="full-width q-mt-md"
            :loading="authStore.loading"
          />
        </q-form>
      </q-card-section>

      <q-separator />

      <q-card-section class="text-center q-pt-sm">
        <template v-if="mode === 'signin'">
          <div class="text-caption text-grey-6">Need access to manage the site?</div>
          <q-btn flat dense no-caps color="primary" label="Request admin access" @click="switchMode('request')" />
        </template>
        <template v-else>
          <div class="text-caption text-grey-6">Already approved?</div>
          <q-btn flat dense no-caps color="primary" label="Back to sign in" @click="switchMode('signin')" />
        </template>
      </q-card-section>

      <q-card-section class="text-caption text-center text-grey-6 q-pt-none">
        {{
          mode === 'signin'
            ? 'Only authorized club administrators may access this area.'
            : 'Submitting a request does not grant access — an existing admin must approve you first.'
        }}
      </q-card-section>
    </q-card>
  </q-page>
</template>

<style scoped>
</style>
