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

function addFeaturedPost() {
  form.value.social.featuredPosts.push('')
}
function removeFeaturedPost(index: number) {
  form.value.social.featuredPosts.splice(index, 1)
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

/**
 * Base tiers offered as pairing targets. Excludes additional rates, since one
 * sibling rate cannot belong to another.
 */
const baseTierOptions = computed(() =>
  form.value.payment.tiers
    .filter((t) => !t.additional && t.label.trim() !== '')
    .map((t) => ({ label: t.label, value: t.id })))

/**
 * Clearing the flag also clears the pairing, so a tier flipped back to a base
 * fee cannot keep a stale `appliesTo` pointing at another tier.
 */
function onAdditionalToggle(index: number, value: boolean) {
  const tier = form.value.payment.tiers[index]
  if (!tier) return
  tier.additional = value
  if (!value) delete tier.appliesTo
}

/** Additional rates that have not been pointed at a base tier yet. */
const unpairedAdditional = computed(() =>
  form.value.payment.tiers.filter((t) => t.additional && !t.appliesTo))

function addFaq() {
  form.value.content.faqs.push({
    // Generated once, so reordering or rewording does not remount panels or
    // change which entry the public page considers stable.
    id: `faq-${Date.now().toString(36)}`,
    question: '',
    answer: '',
  })
}

function removeFaq(index: number) {
  form.value.content.faqs.splice(index, 1)
}

/**
 * Array order is display order on /faq, so reordering needs to be possible
 * without deleting and retyping an entry.
 */
function moveFaq(index: number, delta: number) {
  const list = form.value.content.faqs
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  if (item) list.splice(target, 0, item)
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
          <q-input v-model="form.social.x" label="X" outlined placeholder="CaryTrojansWC" />
          <q-input v-model="form.social.facebook" label="Facebook" outlined />
          <q-input v-model="form.social.instagram" label="Instagram" outlined />

          <div>
            <div class="field-group-label">Featured posts on the home page</div>
            <div class="settings-note settings-note--inline q-mb-sm">
              Paste the link to a post. X often serves nothing for a profile
              timeline on a new account, but individual posts embed reliably.
              Listing any here replaces the timeline with those posts.
            </div>
            <div
              v-for="(_, index) in form.social.featuredPosts"
              :key="`post-${index}`"
              class="row items-center no-wrap q-gutter-sm q-mb-sm"
            >
              <q-input
                v-model="form.social.featuredPosts[index]"
                outlined
                dense
                class="col"
                :label="`Post ${index + 1}`"
                placeholder="https://x.com/CaryTrojansWC/status/…"
              />
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                :aria-label="`Remove post ${index + 1}`"
                @click="removeFeaturedPost(index)"
              />
            </div>
            <q-btn flat dense no-caps icon="add" label="Add post" @click="addFeaturedPost" />
          </div>
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
            <div class="settings-note settings-note--inline">
              Mark a tier as an additional-wrestler rate and say which base fee
              it goes with. Additional rates are never shown as a choice on the
              form — they are added once per wrestler after the first.
            </div>

            <div v-if="unpairedAdditional.length" class="tier-warning">
              <q-icon name="warning" size="16px" class="q-mr-xs" />
              {{ unpairedAdditional.length }} additional rate{{
                unpairedAdditional.length === 1 ? '' : 's'
              }} not linked to a base fee. Until linked, siblings on those
              registrations will not be charged.
            </div>

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
                <div class="col-12 col-sm-6">
                  <q-toggle
                    :model-value="tier.additional === true"
                    label="Additional-wrestler rate"
                    dense
                    @update:model-value="(v: boolean) => onAdditionalToggle(index, v)"
                  />
                </div>
                <div v-if="tier.additional" class="col-12 col-sm-6">
                  <q-select
                    v-model="tier.appliesTo"
                    :options="baseTierOptions"
                    outlined
                    dense
                    emit-value
                    map-options
                    label="Applies to"
                    hint="The base fee this sibling rate accompanies"
                  />
                </div>
              </div>
            </div>
            <q-btn flat dense no-caps icon="add" label="Add tier" @click="addTier" />
          </div>
        </div>
      </q-expansion-item>

      <q-separator />

      <!-- FAQ -->
      <q-expansion-item label="FAQ" icon="help_outline">
        <div class="q-pa-md q-gutter-md">
          <div class="settings-note settings-note--inline">
            Shown at <code>/faq</code> in this order. Entries missing a question
            or an answer are skipped on the public page, so a half-finished one
            is safe to leave here.
          </div>

          <q-input
            v-model="form.content.faqIntro"
            type="textarea"
            label="Intro paragraph (optional)"
            outlined
            autogrow
          />

          <div>
            <div class="field-group-label">Questions</div>
            <div
              v-for="(faq, index) in form.content.faqs"
              :key="faq.id"
              class="tier-row"
            >
              <div class="row items-center q-gutter-xs q-mb-xs">
                <span class="faq-index">{{ index + 1 }}</span>
                <q-space />
                <q-btn
                  flat
                  round
                  dense
                  icon="arrow_upward"
                  :disable="index === 0"
                  :aria-label="`Move question ${index + 1} up`"
                  @click="moveFaq(index, -1)"
                />
                <q-btn
                  flat
                  round
                  dense
                  icon="arrow_downward"
                  :disable="index === form.content.faqs.length - 1"
                  :aria-label="`Move question ${index + 1} down`"
                  @click="moveFaq(index, 1)"
                />
                <q-btn
                  flat
                  round
                  dense
                  icon="delete"
                  color="negative"
                  :aria-label="`Remove question ${index + 1}`"
                  @click="removeFaq(index)"
                />
              </div>
              <q-input
                v-model="faq.question"
                outlined
                dense
                label="Question"
                class="q-mb-sm"
              />
              <q-input
                v-model="faq.answer"
                type="textarea"
                outlined
                dense
                autogrow
                label="Answer"
              />
            </div>
            <q-btn flat dense no-caps icon="add" label="Add question" @click="addFaq" />
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
.faq-index {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--grey-400);
}

.tier-warning {
  margin: 6px 0 10px;
  font-size: 0.85rem;
  color: var(--negative, #c10015);
}
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
