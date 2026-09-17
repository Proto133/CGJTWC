<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWrestlersStore } from 'stores/wrestlers'
import {
  compareDob,
  draftFromRegistrant,
  nameMatches,
} from 'src/utils/registrantConversion'
import { currentSeason, divisionLabel, squadForDivision } from 'src/utils/season'
import { toUsDate } from 'src/utils/registration'
import type { MatchVerdict } from 'src/utils/registrantConversion'
import type {
  Registration,
  RegistrationWrestler,
  Wrestler,
  WrestlerPrivate,
} from 'src/types'

/**
 * Adding one child from a registration to the roster.
 *
 * One child at a time rather than a whole family in a click. Siblings are
 * routinely in different situations — one returning, one new — and a single
 * button for the household would have to pick one behaviour for all of them.
 *
 * The review step exists for two things the admin cannot see on the
 * registration: the division the date of birth works out to, and whether this
 * child is already on the roster.
 */

const props = defineProps<{
  modelValue: boolean
  registration: Registration | null
  registrant: RegistrationWrestler | null
}>()

const emit = defineEmits<{ (e: 'update:modelValue', open: boolean): void }>()

const wrestlersStore = useWrestlersStore()
const season = currentSeason()

const draft = computed(() =>
  props.registration && props.registrant
    ? draftFromRegistrant(props.registration, props.registrant, season)
    : null)

const division = computed(() => draft.value?.pub.division ?? null)

/** Roster entries sharing this name, which is as far as public data goes. */
const candidates = computed<Wrestler[]>(() =>
  props.registrant ? nameMatches(wrestlersStore.ordered, props.registrant) : [])

/**
 * The date of birth settles it, and it is private, so it is fetched only for
 * the handful of name matches and only once the dialog is actually open.
 */
const checking = ref(false)
const verdicts = ref<Map<string, MatchVerdict>>(new Map())

watch(
  () => [props.modelValue, props.registrant] as const,
  async ([open]) => {
    verdicts.value = new Map()
    if (!open || candidates.value.length === 0) return

    checking.value = true
    try {
      const found = new Map<string, MatchVerdict>()
      for (const candidate of candidates.value) {
        const detail = await wrestlersStore.loadDetail(candidate.id)
        found.set(candidate.id, compareDob(props.registrant?.dob, detail.dob))
      }
      verdicts.value = found
    } finally {
      checking.value = false
    }
  },
  { immediate: true },
)

/** The one that is almost certainly this child, if any. */
const sameChild = computed<Wrestler | null>(() =>
  candidates.value.find((c) => verdicts.value.get(c.id) === 'sameChild') ?? null)

const namesakes = computed(() =>
  candidates.value.filter((c) => verdicts.value.get(c.id) !== 'sameChild'))

function close() {
  emit('update:modelValue', false)
}

async function addToRoster() {
  const d = draft.value
  if (!d) return
  const id = await wrestlersStore.create(d.pub, d.priv)
  if (id) close()
}

/**
 * A wrestler who was here before gets their existing record brought forward,
 * not a second one.
 *
 * The whole reason a wrestler record outlives a season is so results follow the
 * child. Creating a fresh record for a returning wrestler would split their
 * history in two and neither half would be right.
 */
async function reEnrol() {
  const d = draft.value
  const existing = sameChild.value
  if (!d || !existing) return

  // The store writes the private half with set(), which replaces the whole
  // document, so the existing record has to be read and merged under the new
  // details. Passing the registration's fields alone would wipe anything a
  // registration does not carry.
  const current = await wrestlersStore.loadDetail(existing.id)
  const merged: WrestlerPrivate = { ...current, ...d.priv }

  // Contact details are refreshed from the new signup, which is the most recent
  // thing the family has told us. Notes are the exception: by now they may be a
  // coach's own writing, and the signup answers must not paint over it.
  if (current.notes) merged.notes = current.notes

  const ok = await wrestlersStore.update(
    existing.id,
    {
      season,
      active: true,
      // Re-derived: a year has passed, so the band has probably moved.
      ...(d.pub.division ? { division: d.pub.division } : {}),
    },
    merged,
  )
  if (ok) close()
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card v-if="draft && registrant" class="convert-card">
      <q-card-section>
        <div class="dialog-title">Add to roster</div>
        <div class="dialog-sub">{{ draft.pub.firstName }} {{ draft.pub.lastName }}</div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div v-if="checking" class="checking">
          <q-spinner size="16px" class="q-mr-xs" />
          Checking whether they are already on the roster…
        </div>

        <!-- The case worth interrupting for. A second record would split this
             child's results across two entries. -->
        <div v-else-if="sameChild" class="flag flag--stop">
          <q-icon name="error" size="16px" class="q-mr-xs" />
          <div>
            <strong>{{ sameChild.firstName }} {{ sameChild.lastName }}</strong>
            is already on the roster with the same date of birth. Bring that
            record forward rather than creating a second one, or their results
            end up split between two entries.
          </div>
        </div>

        <div v-else-if="namesakes.length" class="flag flag--warn">
          <q-icon name="info" size="16px" class="q-mr-xs" />
          <div>
            The roster already has
            {{ namesakes.length === 1 ? 'a wrestler' : 'wrestlers' }} called
            {{ draft.pub.firstName }} {{ draft.pub.lastName }} with a different
            date of birth. Worth a look before adding another.
          </div>
        </div>

        <dl class="summary">
          <dt>Born</dt>
          <dd>{{ toUsDate(registrant.dob) || 'Not given' }}</dd>

          <dt>Division</dt>
          <dd>
            <template v-if="division">
              {{ divisionLabel(division) }} · {{ squadForDivision(division) }} squad
            </template>
            <!-- Left unset on purpose rather than rounded into Senior. -->
            <span v-else class="summary__gap">
              None — this date of birth is outside the IKWF bands for {{ season }}
            </span>
          </dd>

          <dt>Grade</dt>
          <dd>{{ draft.priv.grade || 'Not given' }}</dd>

          <dt>Guardian</dt>
          <dd>{{ draft.priv.guardianName || 'Not given' }}</dd>

          <dt>Season</dt>
          <dd>{{ season }}</dd>
        </dl>

        <p class="note">
          Contact details and date of birth go to the private half of the record,
          which never reaches the public site. They will not appear anywhere
          public until someone ticks that separately.
        </p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          v-if="sameChild"
          unelevated
          no-caps
          color="primary"
          label="Bring their record forward"
          :loading="wrestlersStore.saving"
          @click="reEnrol"
        />
        <q-btn
          v-else
          unelevated
          no-caps
          color="primary"
          label="Add to roster"
          :disable="checking"
          :loading="wrestlersStore.saving"
          @click="addToRoster"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.convert-card {
  width: 480px;
  max-width: 94vw;
}

.dialog-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.2rem;
  text-transform: uppercase;
  color: var(--navy-800);
}

.dialog-sub {
  font-size: 0.9rem;
  color: var(--grey-600);
}

.checking {
  display: flex;
  align-items: center;
  font-size: 0.84rem;
  color: var(--grey-600);
  margin-bottom: 12px;
}

.flag {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  font-size: 0.84rem;
  line-height: 1.5;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin-bottom: 14px;
}

.flag--stop {
  background: rgba(193, 0, 21, 0.08);
  color: var(--negative, #c10015);
}

.flag--warn {
  background: var(--grey-050, #fafafa);
  border: 1px solid var(--grey-200);
  color: var(--grey-600);
}

.summary {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 14px;
  margin: 0;
  font-size: 0.88rem;
}

.summary dt {
  color: var(--grey-500);
}

.summary dd {
  margin: 0;
  color: var(--navy-800);
  font-weight: 600;
}

.summary__gap {
  font-weight: 400;
  color: var(--negative, #c10015);
}

.note {
  margin: 14px 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--grey-500);
}
</style>
