<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Dialog } from 'quasar'
import { useWrestlersStore } from 'stores/wrestlers'
import { useMatchesStore } from 'stores/matches'
import WrestlerStatsDialog from 'components/admin/WrestlerStatsDialog.vue'
import { currentSeason, divisionLabel, ikwfDivision, squadForDivision } from 'src/utils/season'
import { recordLabel, summarise } from 'src/utils/wrestlerStats'
import { parseStoredDate } from 'src/utils/usDate'
import type { Wrestler, WrestlerPrivate } from 'src/types'

/**
 * The roster.
 *
 * Deliberately minimal for now: enough to get wrestlers into the system so
 * bouts can be scored against them. Converting registrants in bulk, with
 * duplicate detection, comes next and will be the usual way records appear.
 */

const store = useWrestlersStore()
const matchesStore = useMatchesStore()
const season = currentSeason()

const statsOpen = ref(false)
const statsFor = ref<Wrestler | null>(null)

function openStats(wrestler: Wrestler) {
  statsFor.value = wrestler
  statsOpen.value = true
}

/** Season record, computed from the bouts already in memory. */
function record(wrestler: Wrestler): string {
  return recordLabel(summarise(matchesStore.forWrestler(wrestler.id)))
}

const showForm = ref(false)
const editingId = ref<string | null>(null)

interface FormState {
  firstName: string
  lastName: string
  weightClass: string
  active: boolean
  published: boolean
  // internal only
  dob: string
  grade: string
  usawNumber: string
  guardianName: string
  guardianEmail: string
  guardianPhone: string
  notes: string
}

function blankForm(): FormState {
  return {
    firstName: '', lastName: '', weightClass: '',
    active: true,
    // Off by default. Publishing a child is a decision, not a side effect of
    // adding them to the roster.
    published: false,
    dob: '', grade: '', usawNumber: '',
    guardianName: '', guardianEmail: '', guardianPhone: '', notes: '',
  }
}

const form = ref<FormState>(blankForm())

onMounted(() => {
  store.subscribe()
  matchesStore.subscribeSeason(season)
})
onBeforeUnmount(() => {
  store.unsubscribeFromWrestlers()
  matchesStore.unsubscribeFromMatches()
})

const dobInvalid = computed(() =>
  form.value.dob.trim() !== '' && parseStoredDate(form.value.dob) === null)

/** Shown live as the date of birth is typed, so a typo is obvious. */
const derivedDivision = computed(() => ikwfDivision(form.value.dob, season))

const canSave = computed(() =>
  form.value.firstName.trim() !== ''
  && form.value.lastName.trim() !== ''
  && !dobInvalid.value)

function openNew() {
  editingId.value = null
  form.value = blankForm()
  showForm.value = true
}

async function openEdit(wrestler: Wrestler) {
  const detail = await store.loadDetail(wrestler.id)
  form.value = {
    firstName: wrestler.firstName,
    lastName: wrestler.lastName,
    weightClass: wrestler.weightClass ?? '',
    active: wrestler.active,
    published: wrestler.published,
    dob: detail.dob ?? '',
    grade: detail.grade ?? '',
    usawNumber: detail.usawNumber ?? '',
    guardianName: detail.guardianName ?? '',
    guardianEmail: detail.guardianEmail ?? '',
    guardianPhone: detail.guardianPhone ?? '',
    notes: detail.notes ?? '',
  }
  editingId.value = wrestler.id
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingId.value = null
}

async function save() {
  if (!canSave.value) return
  const f = form.value

  const division = ikwfDivision(f.dob, season)
  const pub = {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    weightClass: f.weightClass.trim(),
    season,
    active: f.active,
    published: f.published,
    // Stored rather than computed at render, because a bio card is public and
    // the date of birth it derives from is not.
    ...(division ? { division } : {}),
  }
  const priv: WrestlerPrivate = {
    dob: f.dob.trim(),
    grade: f.grade.trim(),
    usawNumber: f.usawNumber.trim(),
    guardianName: f.guardianName.trim(),
    guardianEmail: f.guardianEmail.trim(),
    guardianPhone: f.guardianPhone.trim(),
    notes: f.notes.trim(),
  }

  const ok = editingId.value
    ? await store.update(editingId.value, pub, priv)
    : await store.create(pub, priv)

  if (ok) closeForm()
}

function confirmDelete(wrestler: Wrestler) {
  Dialog.create({
    title: `Remove ${wrestler.firstName} ${wrestler.lastName}?`,
    message:
      'This deletes the roster entry and their contact details. Their recorded '
      + 'bouts are left in place. To take a wrestler off the public site '
      + 'without losing anything, untick Published instead.',
    cancel: true,
    persistent: true,
    ok: { label: 'Remove', color: 'negative', unelevated: true, noCaps: true },
  }).onOk(() => {
    void store.remove(wrestler.id)
  })
}

function squadOf(wrestler: Wrestler): string {
  return squadForDivision(wrestler.division ?? null) ?? ''
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-sm q-gutter-sm">
      <div class="text-h6">Roster</div>
      <q-space />
      <q-btn
        outline
        no-caps
        icon="sports_score"
        label="Score a bout"
        to="/admin/score"
      />
      <q-btn color="primary" unelevated no-caps icon="add" label="Add wrestler" @click="openNew" />
    </div>

    <div class="settings-note settings-note--inline q-mb-md">
      Season {{ season }}. IKWF division and practice squad are worked out from
      the date of birth, using age on 31 December, so neither needs maintaining.
      Converting registrants in bulk comes next.
    </div>

    <q-card v-if="showForm" flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">
          {{ editingId ? 'Edit' : 'Add' }} wrestler
        </div>

        <div class="block-label">Shown on a bio card</div>
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-4">
            <q-input v-model="form.firstName" label="First name *" outlined dense />
          </div>
          <div class="col-12 col-sm-4">
            <q-input v-model="form.lastName" label="Last name *" outlined dense />
          </div>
          <div class="col-12 col-sm-4">
            <q-input v-model="form.weightClass" label="Weight class" outlined dense />
          </div>
          <div class="col-12 col-sm-6">
            <q-toggle v-model="form.active" label="On the roster this season" />
          </div>
          <div class="col-12 col-sm-6">
            <q-toggle
              v-model="form.published"
              label="May appear on the public site"
            />
          </div>
        </div>

        <div class="private-block">
          <div class="block-label block-label--private">
            <q-icon name="lock" size="15px" class="q-mr-xs" />
            Internal only — never shown on the site
          </div>

          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-4">
              <q-input
                v-model="form.dob"
                label="Date of birth"
                placeholder="YYYY/MM/DD"
                outlined
                dense
                :error="dobInvalid"
                error-message="Use YYYY/MM/DD"
                :hint="derivedDivision
                  ? `${divisionLabel(derivedDivision)} — ${squadForDivision(derivedDivision)}`
                  : 'Sets the IKWF division'"
              />
            </div>
            <div class="col-6 col-sm-4">
              <q-input v-model="form.grade" label="Grade" outlined dense />
            </div>
            <div class="col-6 col-sm-4">
              <q-input v-model="form.usawNumber" label="USAW number" outlined dense />
            </div>
            <div class="col-12 col-sm-4">
              <q-input v-model="form.guardianName" label="Guardian" outlined dense />
            </div>
            <div class="col-12 col-sm-4">
              <q-input v-model="form.guardianEmail" label="Guardian email" outlined dense />
            </div>
            <div class="col-12 col-sm-4">
              <q-input v-model="form.guardianPhone" label="Guardian phone" outlined dense />
            </div>
            <div class="col-12">
              <q-input v-model="form.notes" label="Notes" outlined dense autogrow />
            </div>
          </div>
        </div>

        <div class="row q-gutter-sm justify-end q-mt-md">
          <q-btn flat no-caps label="Cancel" @click="closeForm" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="editingId ? 'Save' : 'Add wrestler'"
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

    <div v-else-if="store.ordered.length === 0" class="empty-state">
      No wrestlers yet.
    </div>

    <q-list v-else bordered separator class="rounded-borders">
      <!-- The row itself opens the wrestler's bouts. Editing the roster entry
           and editing their results are different jobs, so the pencil stays a
           separate target and stops the row's own click. -->
      <q-item
        v-for="wrestler in store.ordered"
        :key="wrestler.id"
        clickable
        :aria-label="`Bouts for ${wrestler.firstName} ${wrestler.lastName}`"
        @click="openStats(wrestler)"
      >
        <q-item-section>
          <q-item-label class="row items-center q-gutter-xs">
            <span class="text-weight-medium">
              {{ wrestler.lastName }}, {{ wrestler.firstName }}
            </span>
            <q-badge v-if="!wrestler.active" outline color="grey-7" label="inactive" />
            <q-badge
              v-if="wrestler.published"
              outline
              color="primary"
              label="public"
            />
          </q-item-label>
          <q-item-label caption>
            <template v-if="wrestler.division">
              {{ divisionLabel(wrestler.division) }} · {{ squadOf(wrestler) }}
            </template>
            <template v-else>No date of birth recorded</template>
            <template v-if="wrestler.weightClass"> · {{ wrestler.weightClass }}</template>
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="row items-center q-gutter-xs">
            <div class="record-value" :title="`${wrestler.firstName}'s season record`">
              {{ record(wrestler) }}
            </div>
            <q-btn
              dense
              flat
              icon="edit"
              aria-label="Edit wrestler"
              @click.stop="openEdit(wrestler)"
            />
            <q-btn
              dense
              flat
              icon="delete"
              color="negative"
              aria-label="Remove wrestler"
              @click.stop="confirmDelete(wrestler)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <WrestlerStatsDialog v-model="statsOpen" :wrestler="statsFor" />
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

/* A value rather than a control: the whole row is the control now. */
.record-value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--navy-800);
  min-width: 52px;
  text-align: right;
}
</style>
