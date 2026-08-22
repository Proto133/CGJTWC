import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from 'src/firebase'
import { Notify } from 'quasar'
import { errorMessage } from 'src/utils/errors'
import {
  defaultOrganization,
  buildSocialLinks,
  buildXHandle,
  buildCityState,
  buildAddressLines,
  buildMailtoHref,
  buildCopyrightLine,
} from 'src/config/organization'
import type { OrganizationSettings } from 'src/config/organization'

const SETTINGS_DOC = 'organization'

/** A partial override: any section may be absent, any field within it may be absent. */
type SettingsOverride = {
  [K in keyof OrganizationSettings]?: Partial<OrganizationSettings[K]>
}

/**
 * Merges an override section over its defaults, ignoring keys whose value is
 * absent or an empty string. That is what makes a blank field in the admin form
 * fall back to the value in organization.ts rather than blanking the site.
 * Arrays are replaced wholesale, since a venue list is edited as a unit.
 */
function mergeSection<T extends object>(defaults: T, override?: Partial<T>): T {
  if (!override) return defaults
  const result = { ...defaults }

  for (const key of Object.keys(override) as (keyof T)[]) {
    const value = override[key]
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    result[key] = value as T[keyof T]
  }

  return result
}

export const useSettingsStore = defineStore('settings', () => {
  const override = ref<SettingsOverride | null>(null)
  const loaded = ref(false)
  const saving = ref(false)
  let unsubscribe: (() => void) | null = null

  /** Live values: Firestore override on top of the file defaults. */
  const org = computed<OrganizationSettings>(() => ({
    identity: mergeSection(defaultOrganization.identity, override.value?.identity),
    contact: mergeSection(defaultOrganization.contact, override.value?.contact),
    location: mergeSection(defaultOrganization.location, override.value?.location),
    social: mergeSection(defaultOrganization.social, override.value?.social),
    program: mergeSection(defaultOrganization.program, override.value?.program),
    payment: mergeSection(defaultOrganization.payment, override.value?.payment),
    content: mergeSection(defaultOrganization.content, override.value?.content),
  }))

  // Derived values must be computed, not constants, so they track admin edits.
  const socialLinks = computed(() => buildSocialLinks(org.value.social))
  const xSocial = computed(() => socialLinks.value.find((l) => l.key === 'x') ?? null)
  const xHandle = computed(() => buildXHandle(org.value.social))
  const cityState = computed(() => buildCityState(org.value.location))
  const addressLines = computed(() => buildAddressLines(org.value.location))
  const mailtoHref = computed(() => buildMailtoHref(org.value.contact.email))
  const copyrightLine = computed(() =>
    buildCopyrightLine(org.value.identity.name, cityState.value))

  /** Idempotent: safe to call from more than one layout. */
  function subscribe() {
    if (unsubscribe) return

    unsubscribe = onSnapshot(
      doc(db, 'settings', SETTINGS_DOC),
      (snap) => {
        override.value = snap.exists() ? snap.data() : null
        loaded.value = true
      },
      (error) => {
        // Not fatal: the site renders from the file defaults.
        console.error('Settings listener error:', error)
        loaded.value = true
      },
    )
  }

  function unsubscribeFromSettings() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  /** Writes the whole override document. Admin only, enforced by rules. */
  async function save(next: SettingsOverride) {
    saving.value = true
    try {
      await setDoc(doc(db, 'settings', SETTINGS_DOC), {
        ...next,
        updatedAt: serverTimestamp(),
      })
      Notify.create({ type: 'positive', message: 'Settings saved' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to save settings'),
      })
      return false
    } finally {
      saving.value = false
    }
  }

  /** Deletes the override document so the file defaults apply again. */
  async function resetToDefaults() {
    saving.value = true
    try {
      await deleteDoc(doc(db, 'settings', SETTINGS_DOC))
      Notify.create({ type: 'info', message: 'Reset to the values in organization.ts' })
      return true
    } catch (error: unknown) {
      Notify.create({
        type: 'negative',
        message: errorMessage(error, 'Failed to reset settings'),
      })
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    override,
    loaded,
    saving,
    org,
    socialLinks,
    xSocial,
    xHandle,
    cityState,
    addressLines,
    mailtoHref,
    copyrightLine,
    subscribe,
    unsubscribeFromSettings,
    save,
    resetToDefaults,
  }
})
