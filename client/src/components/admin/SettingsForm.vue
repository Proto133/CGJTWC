<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Dialog } from 'quasar'
import { useSettingsStore } from 'stores/settings'
import { defaultOrganization } from 'src/config/organization'
import type { OrganizationSettings } from 'src/config/organization'

const settings = useSettingsStore()

/** Deep clone so editing never mutates the store or the module defaults. */
function clone(value: OrganizationSettings): OrganizationSettings {
  return JSON.parse(JSON.stringify(value)) as OrganizationSettings
}

const form = ref<OrganizationSettings>(clone(settings.org))

// Re-seed when the remote document changes (for example after a reset), but not
// while the admin is mid-edit on their own save.
watch(() => settings.org, (next) => {
  if (!settings.saving) form.value = clone(next)
}, { deep: true })

/**
 * Only persist what actually differs from organization.ts. Anything left at its
 * default stays absent from the override document, so a later edit to the file
 * still flows through to the site.
 */
function buildOverride() {
  const override: Record<string, Record<string, unknown>> = {}
  const sections = Object.keys(defaultOrganization) as (keyof OrganizationSettings)[]

  for (const section of sections) {
    const defaults = defaultOrganization[section] as unknown as Record<string, unknown>
    const current = form.value[section] as unknown as Record<string, unknown>
    const changed: Record<string, unknown> = {}

    for (const key of Object.keys(defaults)) {
      if (JSON.stringify(current[key]) !== JSON.stringify(defaults[key])) {
        changed[key] = current[key]
      }
    }

    if (Object.keys(changed).length > 0) override[section] = changed
  }

  return override
}

const changedCount = computed(() =>
  Object.values(buildOverride()).reduce((sum, section) => sum + Object.keys(section).length, 0))

async function handleSave() {
  await settings.save(buildOverride())
}

function confirmReset() {
  Dialog.create({
    title: 'Reset to file defaults?',
    message:
      'This deletes the saved overrides so the site uses the values in ' +
      'src/config/organization.ts again. Your edits will be lost.',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void settings.resetToDefaults()
  })
}

function addVenue() {
  form.value.location.venues.push('')
}
function removeVenue(index: number) {
  form.value.location.venues.splice(index, 1)
}
function addOffering() {
  form.value.content.offerings.push('')
}
function removeOffering(index: number) {
  form.value.content.offerings.splice(index, 1)
}

function addMailLine() {
  form.value.payment.mailingAddress.push('')
}
function removeMailLine(index: number) {
  form.value.payment.mailingAddress.splice(index, 1)
}

function addTier() {
  form.value.payment.tiers.push({
    // Stable key stored on registrations; generated once so renaming the label
    // later does not orphan existing records.
    id: `tier-${Date.now().toString(36)}`,
    label: '',
    amount: 0,
    description: '',
  })
}
function removeTier(index: number) {
  form.value.payment.tiers.splice(index, 1)
}
</script>

<template>
  <q-form @submit.prevent="handleSave">
    <div class="settings-note">
      Values left at their defaults are not saved, so they keep following
      <code>src/config/organization.ts</code>. Only your changes are stored.
    </div>

    <q-list bordered class="rounded-borders">
      <!-- Identity -->
      <q-expansion-item label="Identity" icon="badge" default-opened>
        <div class="q-pa-md q-gutter-md">
          <q-input v-model="form.identity.name" label="Full name" outlined />
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input v-model="form.identity.shortName" label="Short name" outlined />
            </div>
          </div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input v-model="form.identity.brandLine1" label="Header line 1" outlined />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="form.identity.brandLine2" label="Header line 2" outlined />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="form.identity.heroLine1" label="Hero line 1" outlined />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="form.identity.heroLine2" label="Hero line 2" outlined />
            </div>
          </div>
          <q-input v-model="form.identity.heroTagline" label="Hero tagline" outlined />
          <q-input v-model="form.identity.footerTagline" label="Footer tagline" outlined />
        </div>
      </q-expansion-item>

      <q-separator />

      <!-- Contact -->
      <q-expansion-item label="Contact" icon="mail">
        <div class="q-pa-md q-gutter-md">
          <q-input v-model="form.contact.email" type="email" label="Email" outlined />
          <q-input
            v-model="form.contact.phone"
            type="tel"
            label="Phone (optional)"
            outlined
            hint="Leave empty to hide the phone row on the contact page"
          />
        </div>
      </q-expansion-item>

      <q-separator />

      <!-- Location -->
      <q-expansion-item label="Location" icon="place">
        <div class="q-pa-md q-gutter-md">
          <div>
            <div class="field-group-label">Venues</div>
            <div
              v-for="(_, index) in form.location.venues"
              :key="`venue-${index}`"
              class="row items-center no-wrap q-gutter-sm q-mb-sm"
            >
              <q-input
                v-model="form.location.venues[index]"
                outlined
                dense
                class="col"
                :label="`Venue ${index + 1}`"
              />
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                :aria-label="`Remove venue ${index + 1}`"
                @click="removeVenue(index)"
              />
            </div>
            <q-btn flat dense no-caps icon="add" label="Add venue" @click="addVenue" />
          </div>

          <div class="row q-col-gutter-sm">
            <div class="col-8">
              <q-input v-model="form.location.city" label="City" outlined />
            </div>
            <div class="col-4">
              <q-input v-model="form.location.state" label="State" outlined />
            </div>
          </div>
        </div>
      </q-expansion-item>

      <q-separator />

      <!-- Social -->
      <q-expansion-item label="Social accounts" icon="share">
        <div class="q-pa-md q-gutter-md">
          <div class="settings-note settings-note--inline">
            Handle or full URL. Leave empty to hide that account everywhere.
          </div>
          <q-input v-model="form.social.x" label="X" outlined placeholder="CGJTWrestling" />
          <q-input v-model="form.social.facebook" label="Facebook" outlined />
          <q-input v-model="form.social.instagram" label="Instagram" outlined />
        </div>
      </q-expansion-item>

      <q-separator />

      <!-- Program -->
      <q-expansion-item label="Program facts" icon="sports">
        <div class="q-pa-md q-gutter-md">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-4">
              <q-input v-model="form.program.grades" label="Grades" outlined />
            </div>
            <div class="col-12 col-sm-4">
              <q-input v-model="form.program.skillLevels" label="Skill levels" outlined />
            </div>
            <div class="col-12 col-sm-4">
              <q-input v-model="form.program.seasonMonths" label="Season" outlined />
            </div>
          </div>
        </div>
      </q-expansion-item>

      <q-separator />

      <!-- Payment -->
      <q-expansion-item label="Payment &amp; pricing" icon="payments">
        <div class="q-pa-md q-gutter-md">
          <div class="settings-note settings-note--inline">
            Zelle has no API for confirming incoming payments, so registrations
            are reconciled by hand. Each one gets a reference code for the memo;
            an admin confirms it in the Registrations tab.
          </div>

          <q-input
            v-model="form.payment.zelleTag"
            label="Zelle tag or email"
            outlined
            hint="Shown to registrants who choose Zelle"
          />
          <q-input
            v-model="form.payment.zelleQrImageUrl"
            label="Zelle QR image URL (optional)"
            outlined
            hint="Paste the QR your banking app generates — a scannable Zelle QR cannot be generated here"
          />

          <q-input
            v-model="form.payment.checkPayableTo"
            label="Make checks payable to"
            outlined
          />

          <div>
            <div class="field-group-label">Mailing address for checks</div>
            <div
              v-for="(_, index) in form.payment.mailingAddress"
              :key="`mail-${index}`"
              class="row items-center no-wrap q-gutter-sm q-mb-sm"
            >
              <q-input
                v-model="form.payment.mailingAddress[index]"
                outlined
                dense
                class="col"
                :label="`Line ${index + 1}`"
              />
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                :aria-label="`Remove address line ${index + 1}`"
                @click="removeMailLine(index)"
              />
            </div>
            <q-btn flat dense no-caps icon="add" label="Add line" @click="addMailLine" />
          </div>

          <q-input
            v-model="form.payment.instructions"
            type="textarea"
            label="Payment instructions"
            outlined
            autogrow
          />

          <div>
            <div class="field-group-label">Pricing tiers</div>
            <div
              v-for="(tier, index) in form.payment.tiers"
              :key="tier.id"
              class="tier-row"
            >
              <div class="row q-col-gutter-sm items-start">
                <div class="col-12 col-sm-5">
                  <q-input
                    v-model="tier.label"
                    outlined
                    dense
                    label="Label"
                    placeholder="Early Registration"
                  />
                </div>
                <div class="col-8 col-sm-3">
                  <q-input
                    v-model.number="tier.amount"
                    type="number"
                    outlined
                    dense
                    label="Amount"
                    prefix="$"
                    min="0"
                  />
                </div>
                <div class="col-4 col-sm-4 text-right">
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    color="negative"
                    :aria-label="`Remove tier ${index + 1}`"
                    @click="removeTier(index)"
                  />
                </div>
                <div class="col-12">
                  <q-input
                    v-model="tier.description"
                    outlined
                    dense
                    label="Description"
                  />
                </div>
              </div>
            </div>
            <q-btn flat dense no-caps icon="add" label="Add tier" @click="addTier" />
          </div>
        </div>
      </q-expansion-item>

      <q-separator />

      <!-- Content -->
      <q-expansion-item label="Page copy" icon="article">
        <div class="q-pa-md q-gutter-md">
          <q-input
            v-model="form.content.aboutTeaser"
            type="textarea"
            label="Home page about teaser"
            outlined
            autogrow
          />
          <q-input
            v-model="form.content.aboutIntro"
            type="textarea"
            label="About page intro"
            outlined
            autogrow
          />

          <div>
            <div class="field-group-label">What we offer</div>
            <div
              v-for="(_, index) in form.content.offerings"
              :key="`offering-${index}`"
              class="row items-center no-wrap q-gutter-sm q-mb-sm"
            >
              <q-input
                v-model="form.content.offerings[index]"
                outlined
                dense
                class="col"
                :label="`Item ${index + 1}`"
              />
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                :aria-label="`Remove item ${index + 1}`"
                @click="removeOffering(index)"
              />
            </div>
            <q-btn flat dense no-caps icon="add" label="Add item" @click="addOffering" />
          </div>

          <q-input
            v-model="form.content.values"
            type="textarea"
            label="Values paragraph"
            outlined
            autogrow
          />
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input v-model="form.content.ctaHeading" label="CTA heading" outlined />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="form.content.ctaText" label="CTA text" outlined />
            </div>
          </div>
          <q-input
            v-model="form.content.contactIntro"
            type="textarea"
            label="Contact page intro"
            outlined
            autogrow
          />
        </div>
      </q-expansion-item>
    </q-list>

    <div class="row items-center q-gutter-sm q-mt-md">
      <q-btn
        type="submit"
        color="primary"
        unelevated
        no-caps
        label="Save settings"
        :loading="settings.saving"
      />
      <q-btn
        flat
        no-caps
        color="negative"
        label="Reset to file defaults"
        :disable="settings.saving"
        @click="confirmReset"
      />
      <q-space />
      <div class="text-caption text-grey-6">
        {{ changedCount }} field{{ changedCount === 1 ? '' : 's' }} differ from defaults
      </div>
    </div>
  </q-form>
</template>

<style scoped>
.settings-note {
  background: var(--grey-050);
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 0.85rem;
  color: var(--grey-600);
  margin-bottom: 14px;
  line-height: 1.5;
}

.settings-note--inline {
  margin-bottom: 0;
}

.field-group-label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--grey-400);
  margin-bottom: 8px;
}

.tier-row {
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-sm);
  padding: 10px;
  margin-bottom: 10px;
}

code {
  background: var(--grey-100);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.82em;
  overflow-wrap: anywhere;
}
</style>
