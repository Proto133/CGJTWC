<script setup lang="ts">
import { computed, ref } from 'vue'
import { Dialog } from 'quasar'
import { useSponsorsStore } from 'stores/sponsors'
import {
  describeChange,
  effectiveValue,
  groupByTier,
  isSafeUrl,
  tierLabel,
  unrankedSponsors,
  type SplitInput,
} from 'src/utils/sponsors'
import { parseUsDate } from 'src/utils/usDate'
import type { Sponsor, SponsorPrivate, SponsorTier } from 'src/types'

/**
 * The sponsors tab.
 *
 * Handles both halves of a sponsor record. The private block is kept visually
 * distinct throughout, because the single worst outcome here is an admin
 * pasting a contact number into the blurb, which is world-readable.
 */

const store = useSponsorsStore()

const showForm = ref(false)
const editingId = ref<string | null>(null)

interface FormState {
  name: string
  blurb: string
  logoUrl: string
  websiteUrl: string
  phone: string
  facebook: string
  instagram: string
  x: string
  linkedin: string
  tier: SponsorTier
  order: number
  active: boolean
  // internal only
  contactName: string
  contactEmail: string
  contactPhone: string
  amount: number | null
  inKindValue: number | null
  tierLocked: boolean
  termStart: string
  termEnd: string
  notes: string
}

function blankForm(): FormState {
  return {
    name: '', blurb: '', logoUrl: '', websiteUrl: '', phone: '',
    facebook: '', instagram: '', x: '', linkedin: '',
    tier: 'bronze', order: 0, active: true,
    contactName: '', contactEmail: '', contactPhone: '',
    amount: null, inKindValue: null, tierLocked: false,
    termStart: '', termEnd: '', notes: '',
  }
}

const form = ref<FormState>(blankForm())

const groups = computed(() => groupByTier(store.sponsors))

/** Effective value for the row, from the private cache once it is loaded. */
function valueOf(id: string): number {
  return effectiveValue(store.details.get(id) ?? {})
}

function detailOf(id: string): SponsorPrivate {
  return store.details.get(id) ?? {}
}

const splitInputs = computed<SplitInput[]>(() =>
  store.sponsors.map((s) => ({
    id: s.id,
    name: s.name,
    tier: s.tier,
    amount: detailOf(s.id).amount,
    inKindValue: detailOf(s.id).inKindValue,
    tierLocked: detailOf(s.id).tierLocked,
  })))

const unranked = computed(() => unrankedSponsors(splitInputs.value))

/** A term that has run out. Never auto-hides; the switch stays manual. */
function termExpired(id: string): boolean {
  const end = detailOf(id).termEnd
  if (!end) return false
  const parsed = parseUsDate(end.replace(/\//g, '-'))
  return parsed !== null && parsed < new Date()
}

async function openNew() {
  await store.loadAllDetails()
  editingId.value = null
  form.value = blankForm()
  showForm.value = true
}

async function openEdit(sponsor: Sponsor) {
  await store.loadAllDetails()
  const detail = await store.loadDetail(sponsor.id)

  form.value = {
    name: sponsor.name,
    blurb: sponsor.blurb ?? '',
    logoUrl: sponsor.logoUrl ?? '',
    websiteUrl: sponsor.websiteUrl ?? '',
    phone: sponsor.phone ?? '',
    facebook: sponsor.socials?.facebook ?? '',
    instagram: sponsor.socials?.instagram ?? '',
    x: sponsor.socials?.x ?? '',
    linkedin: sponsor.socials?.linkedin ?? '',
    tier: sponsor.tier,
    order: sponsor.order,
    active: sponsor.active,
    contactName: detail.contactName ?? '',
    contactEmail: detail.contactEmail ?? '',
    contactPhone: detail.contactPhone ?? '',
    amount: detail.amount ?? null,
    inKindValue: detail.inKindValue ?? null,
    tierLocked: detail.tierLocked ?? false,
    termStart: detail.termStart ?? '',
    termEnd: detail.termEnd ?? '',
    notes: detail.notes ?? '',
  }
  editingId.value = sponsor.id
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingId.value = null
}

/**
 * The four social fields, so the inputs and their examples stay in one place.
 *
 * Every one of these must be a full http(s) URL, because that is what the
 * security rules enforce. Without a matching check here the rules would refuse
 * the write and the admin would see a generic save failure naming no field.
 */
const socialFields = [
  { key: 'facebook', label: 'Facebook', example: 'https://facebook.com/yourbusiness' },
  { key: 'instagram', label: 'Instagram', example: 'https://instagram.com/yourbusiness' },
  { key: 'x', label: 'X', example: 'https://x.com/yourbusiness' },
  { key: 'linkedin', label: 'LinkedIn', example: 'https://linkedin.com/company/yourbusiness' },
] as const

type UrlField = 'logoUrl' | 'websiteUrl' | typeof socialFields[number]['key']

function urlInvalid(field: UrlField): boolean {
  const value = form.value[field].trim()
  return value !== '' && !isSafeUrl(value)
}

/**
 * Adds the scheme to a bare domain on blur, e.g. "facebook.com/acme".
 *
 * Only ever prepends https:// to something already shaped like a domain. A
 * bare handle such as "@acme" is left alone to fail validation visibly, since
 * turning it into a URL would mean guessing the profile path — LinkedIn alone
 * has both /company/ and /in/, and picking wrong produces a link that looks
 * right and goes nowhere.
 */
function normaliseUrl(field: UrlField) {
  const value = form.value[field].trim()
  if (value === '' || isSafeUrl(value)) {
    form.value[field] = value
    return
  }
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(value)) {
    form.value[field] = `https://${value}`
  }
}

const badLogo = computed(() => urlInvalid('logoUrl'))
const badWebsite = computed(() => urlInvalid('websiteUrl'))
const badSocials = computed(() => socialFields.some((f) => urlInvalid(f.key)))

const canSave = computed(() =>
  form.value.name.trim() !== ''
  && !badLogo.value
  && !badWebsite.value
  && !badSocials.value)

function buildPayload() {
  const f = form.value
  return {
    public: {
      name: f.name.trim(),
      blurb: f.blurb.trim(),
      logoUrl: f.logoUrl.trim(),
      websiteUrl: f.websiteUrl.trim(),
      phone: f.phone.trim(),
      socials: {
        facebook: f.facebook.trim(),
        instagram: f.instagram.trim(),
        x: f.x.trim(),
        linkedin: f.linkedin.trim(),
      },
      tier: f.tier,
      order: f.order,
      active: f.active,
    },
    private: {
      contactName: f.contactName.trim(),
      contactEmail: f.contactEmail.trim(),
      contactPhone: f.contactPhone.trim(),
      amount: f.amount ?? 0,
      inKindValue: f.inKindValue ?? 0,
      tierLocked: f.tierLocked,
      termStart: f.termStart.trim(),
      termEnd: f.termEnd.trim(),
      notes: f.notes.trim(),
    },
  }
}

async function save() {
  if (!canSave.value) return
  const payload = buildPayload()
  const ok = editingId.value
    ? await store.update(editingId.value, payload)
    : await store.create(payload)
  if (ok) closeForm()
}

function confirmDelete(sponsor: Sponsor) {
  Dialog.create({
    title: `Remove ${sponsor.name}?`,
    message:
      'This deletes the sponsor and its contact and donation record, and '
      + 'removes it from the public page immediately. This cannot be undone.',
    cancel: true,
    persistent: true,
    ok: { label: 'Remove', color: 'negative', unelevated: true, noCaps: true },
  }).onOk(() => {
    void store.remove(sponsor.id)
  })
}

/**
 * Forces a pass of the split, showing what will move before writing anything.
 *
 * Saves already rebalance, so this is for after a change made elsewhere, or
 * simply to see where things stand.
 */
async function recalculate() {
  const changes = await store.previewRecalculation()

  if (changes.length === 0) {
    Dialog.create({
      title: 'Tiers are up to date',
      message: 'Nothing would move.',
      ok: { label: 'Close', flat: true, noCaps: true },
    })
    return
  }

  Dialog.create({
    title: `Move ${changes.length} sponsor${changes.length === 1 ? '' : 's'}?`,
    message: changes.map(describeChange).join('<br>'),
    html: true,
    cancel: true,
    ok: { label: 'Apply', color: 'primary', unelevated: true, noCaps: true },
  }).onOk(() => {
    void store.applyRecalculation(changes)
  })
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-md q-gutter-sm">
      <div class="text-h6">Sponsors</div>
      <q-space />
      <q-btn
        outline
        no-caps
        icon="calculate"
        label="Recalculate tiers"
        :loading="store.saving"
        @click="recalculate"
      />
      <q-btn color="primary" unelevated no-caps icon="add" label="Add Sponsor" @click="openNew" />
    </div>

    <div class="settings-note settings-note--inline q-mb-md">
      Tiers are worked out from cash plus in-kind value, split into thirds:
      top third Gold, middle Silver, bottom Bronze. They are recalculated
      whenever a sponsor is added, edited or removed, so an early sponsor can be
      moved down by later, larger ones. Tick <strong>Lock tier</strong> on
      anyone that must not move.
    </div>

    <div v-if="unranked.length" class="unranked-note">
      <q-icon name="info" size="16px" class="q-mr-xs" />
      {{ unranked.length }} sponsor{{ unranked.length === 1 ? '' : 's' }} with no
      amount recorded {{ unranked.length === 1 ? 'is' : 'are' }} left out of the
      split rather than dropped to Bronze:
      {{ unranked.map((s) => s.name).join(', ') }}
    </div>

    <q-card v-if="showForm" flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">
          {{ editingId ? 'Edit' : 'Add' }} Sponsor
        </div>

        <div class="block-label">Shown on the public page</div>
        <div class="q-gutter-md q-mb-lg">
          <q-input v-model="form.name" label="Company name *" outlined />
          <q-input
            v-model="form.blurb"
            type="textarea"
            label="Card copy"
            hint="Supplied by the business. Plain text; it is published as written."
            outlined
            autogrow
          />
          <q-input
            v-model="form.logoUrl"
            label="Logo URL"
            outlined
            :error="badLogo"
            error-message="Must be a full link starting http:// or https://"
            hint="Direct link to the image file, e.g. https://acme.com/logo.png. Uploads arrive with the storage work."
            @blur="normaliseUrl('logoUrl')"
          />
          <q-input
            v-model="form.websiteUrl"
            label="Website"
            outlined
            :error="badWebsite"
            error-message="Must be a full link starting http:// or https://"
            hint="https://acme.com"
            @blur="normaliseUrl('websiteUrl')"
          />
          <q-input
            v-model="form.phone"
            label="Business phone"
            outlined
            hint="The company's public line. Shown on the sponsorship page."
          />
          <div class="social-note">
            Socials need the full link from the address bar, not a handle. Typing
            a bare domain is fine — it gets the https:// added for you.
          </div>
          <div class="row q-col-gutter-sm">
            <div v-for="field in socialFields" :key="field.key" class="col-12 col-sm-6">
              <q-input
                v-model="form[field.key]"
                :label="field.label"
                :hint="field.example"
                :error="urlInvalid(field.key)"
                error-message="Must be a full link starting http:// or https://"
                outlined
                dense
                @blur="normaliseUrl(field.key)"
              />
            </div>
          </div>
          <div class="row q-col-gutter-sm items-center">
            <div class="col-12 col-sm-4">
              <q-input
                v-model.number="form.order"
                type="number"
                label="Order within tier"
                outlined
                dense
                min="0"
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-toggle v-model="form.active" label="Shown on the site" />
            </div>
          </div>
        </div>

        <!-- Visually separated on purpose. Everything above this line is
             world-readable; everything below it is admin-only. -->
        <div class="private-block">
          <div class="block-label block-label--private">
            <q-icon name="lock" size="15px" class="q-mr-xs" />
            Internal only — never shown on the site
          </div>

          <div class="q-gutter-md">
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-4">
                <q-input v-model="form.contactName" label="Contact name" outlined dense />
              </div>
              <div class="col-12 col-sm-4">
                <q-input v-model="form.contactEmail" label="Contact email" outlined dense />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  v-model="form.contactPhone"
                  label="Contact phone (internal)"
                  outlined
                  dense
                  hint="Often a mobile. Never published — use Business phone above for that."
                />
              </div>
            </div>

            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-4">
                <q-input
                  v-model.number="form.amount"
                  type="number"
                  label="Cash donation"
                  prefix="$"
                  outlined
                  dense
                  min="0"
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  v-model.number="form.inKindValue"
                  type="number"
                  label="In-kind value"
                  prefix="$"
                  outlined
                  dense
                  min="0"
                  hint="Estimated worth of donated goods or services"
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  :model-value="`$${(form.amount ?? 0) + (form.inKindValue ?? 0)}`"
                  label="Counts as"
                  outlined
                  dense
                  readonly
                />
              </div>
            </div>

            <q-toggle
              v-model="form.tierLocked"
              label="Lock tier — keep this sponsor out of the automatic split"
            />

            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="form.termStart"
                  label="Term start"
                  placeholder="YYYY/MM/DD"
                  outlined
                  dense
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="form.termEnd"
                  label="Term end"
                  placeholder="YYYY/MM/DD"
                  outlined
                  dense
                />
              </div>
            </div>

            <q-input
              v-model="form.notes"
              type="textarea"
              label="Notes"
              outlined
              dense
              autogrow
            />
          </div>
        </div>

        <div class="row q-gutter-sm justify-end q-mt-md">
          <q-btn flat no-caps label="Cancel" @click="closeForm" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="editingId ? 'Save sponsor' : 'Add sponsor'"
            :disable="!canSave"
            :loading="store.saving"
            @click="save"
          />
        </div>
      </q-card-section>
    </q-card>

    <div v-if="store.loading" class="text-center q-pa-lg">
      <q-spinner color="primary" />
    </div>

    <div v-else-if="store.sponsors.length === 0" class="empty-state">
      No sponsors yet. Click "Add Sponsor" to get started.
    </div>

    <q-list v-else bordered separator class="rounded-borders">
      <template v-for="group in groups" :key="group.tier">
        <q-item dense class="tier-row">
          <q-item-section class="tier-row__label">
            {{ group.label }}
            <span class="tier-row__count">{{ group.sponsors.length }}</span>
          </q-item-section>
        </q-item>

        <q-item v-for="sponsor in group.sponsors" :key="sponsor.id">
          <q-item-section avatar>
            <q-avatar rounded size="42px" color="grey-2">
              <img v-if="isSafeUrl(sponsor.logoUrl)" :src="sponsor.logoUrl" :alt="sponsor.name" />
              <span v-else class="text-caption text-grey-7">
                {{ sponsor.name.charAt(0) }}
              </span>
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label class="row items-center q-gutter-xs">
              <span class="text-weight-medium">{{ sponsor.name }}</span>
              <q-badge v-if="!sponsor.active" outline color="grey-7" label="hidden" />
              <q-badge
                v-if="detailOf(sponsor.id).tierLocked"
                outline
                color="primary"
                label="locked"
              />
              <q-badge
                v-if="termExpired(sponsor.id)"
                outline
                color="negative"
                label="term ended"
              />
            </q-item-label>
            <q-item-label caption>
              {{ tierLabel(sponsor.tier) }} · order {{ sponsor.order }}
              <template v-if="valueOf(sponsor.id) > 0">
                · counts as ${{ valueOf(sponsor.id) }}
              </template>
              <template v-else> · no amount recorded</template>
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="q-gutter-xs">
              <q-btn
                dense
                flat
                icon="edit"
                aria-label="Edit sponsor"
                @click="openEdit(sponsor)"
              />
              <q-btn
                dense
                flat
                icon="delete"
                color="negative"
                aria-label="Remove sponsor"
                @click="confirmDelete(sponsor)"
              />
            </div>
          </q-item-section>
        </q-item>
      </template>
    </q-list>
  </div>
</template>

<style scoped>
.block-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--grey-500);
  margin-bottom: 10px;
}

.private-block {
  border: 1px solid var(--grey-300);
  border-left: 4px solid var(--navy-800);
  border-radius: var(--radius-sm);
  background: var(--grey-050);
  padding: 14px;
}

.block-label--private {
  color: var(--navy-800);
  display: flex;
  align-items: center;
}

.social-note {
  font-size: 0.8rem;
  color: var(--grey-500);
  line-height: 1.5;
}

.unranked-note {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 0.84rem;
  color: var(--grey-600);
  margin-bottom: 10px;
}

.tier-row {
  background: var(--grey-100);
}

.tier-row__label {
  font-weight: 700;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--navy-800);
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.tier-row__count {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--grey-500);
}
</style>
