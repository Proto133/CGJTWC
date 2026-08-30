<script setup lang="ts">
import { ref, computed } from 'vue'
import { Dialog, date as qdate } from 'quasar'
import { useEventsStore } from 'stores/events'
import EventForm from 'components/admin/EventForm.vue'
import EventImportDialog from 'components/admin/EventImportDialog.vue'
import EventBulkEditDialog from 'components/admin/EventBulkEditDialog.vue'
import { eventSquads, matchesGroupFilter } from 'src/utils/eventGroups'
import { groupByMonth } from 'src/utils/eventPeriods'
import type { Event, EventFormPayload, EventType } from 'src/types'

/**
 * The events tab, lifted out of DashboardPage.
 *
 * Moved because a full season is around seventy events, which needs searching,
 * filtering and grouping to stay usable, and none of that belongs in a page
 * component already responsible for nine other tabs.
 */

const store = useEventsStore()

const showForm = ref(false)
const editing = ref<Partial<Event> | null>(null)
const importOpen = ref(false)
const bulkEditOpen = ref(false)

/** Ids of ticked events. Cleared after any bulk action completes. */
const selectedIds = ref<string[]>([])

// ----- filtering -----

type Range = 'upcoming' | 'past' | 'all'
const range = ref<Range>('upcoming')
const search = ref('')
const typeFilter = ref<EventType[]>([])
const squadFilter = ref<string[]>([])

const EVENT_TYPE_OPTIONS: EventType[] = ['practice', 'dual', 'tournament', 'other']

const inRange = computed<Event[]>(() => {
  if (range.value === 'upcoming') return store.upcomingEvents()
  // Most recent first, so a mistake made last week is near the top.
  if (range.value === 'past') return [...store.pastEvents()].reverse()
  return store.events
})

const visible = computed(() => {
  const needle = search.value.trim().toLowerCase()

  return inRange.value.filter((event) => {
    if (typeFilter.value.length > 0 && !typeFilter.value.includes(event.type)) {
      return false
    }
    if (!matchesGroupFilter(event.group, squadFilter.value, store.squads)) {
      return false
    }
    if (needle === '') return true

    // Location and opponent are searched too: "where is the Elgin one" and
    // "which duals are against Cary-Grove" are both real admin questions.
    return [event.title, event.location, event.opponent, event.description, event.group]
      .some((field) => (field ?? '').toLowerCase().includes(needle))
  })
})

const months = computed(() =>
  groupByMonth(visible.value, (event) => event.date.toDate()))

const filtersActive = computed(() =>
  search.value.trim() !== ''
  || typeFilter.value.length > 0
  || squadFilter.value.length > 0
  || range.value !== 'all')

function clearFilters() {
  search.value = ''
  typeFilter.value = []
  squadFilter.value = []
  range.value = 'all'
}

// ----- selection -----

const visibleIds = computed(() => visible.value.map((e) => e.id))

const allVisibleSelected = computed(() =>
  visibleIds.value.length > 0
  && visibleIds.value.every((id) => selectedIds.value.includes(id)))

/**
 * Selected rows the current filter is hiding.
 *
 * Surfaced because bulk delete acts on the selection, not on what is on screen.
 * Without this an admin could select forty rows, narrow the filter to three,
 * press Delete selected and lose all forty.
 */
const hiddenSelectedCount = computed(() =>
  selectedIds.value.filter((id) => !visibleIds.value.includes(id)).length)

function toggleEvent(id: string, checked: boolean) {
  selectedIds.value = checked
    ? [...selectedIds.value, id]
    : selectedIds.value.filter((existing) => existing !== id)
}

/** Acts on the filtered rows only, which is what "select all" reads as here. */
function toggleAllVisible(checked: boolean) {
  if (checked) {
    const merged = new Set([...selectedIds.value, ...visibleIds.value])
    selectedIds.value = [...merged]
  } else {
    selectedIds.value = selectedIds.value.filter((id) => !visibleIds.value.includes(id))
  }
}

function confirmBulkDelete() {
  const count = selectedIds.value.length
  const hidden = hiddenSelectedCount.value
  Dialog.create({
    title: `Delete ${count} event${count === 1 ? '' : 's'}?`,
    message: hidden > 0
      ? `${hidden} of them ${hidden === 1 ? 'is' : 'are'} hidden by the current `
        + 'filter and will also be deleted. They are removed from the public '
        + 'schedule immediately. This cannot be undone.'
      : 'They are removed from the public schedule immediately. This cannot be undone.',
    cancel: true,
    persistent: true,
    ok: { label: `Delete ${count}`, color: 'negative', unelevated: true, noCaps: true },
  }).onOk(() => {
    void store.deleteMany([...selectedIds.value]).then((ok) => {
      if (ok) selectedIds.value = []
    })
  })
}

// ----- single event editing -----

function openNew() {
  editing.value = null
  showForm.value = true
}

function openEdit(event: Event) {
  editing.value = { ...event }
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
}

async function save(payload: EventFormPayload) {
  const success = editing.value?.id
    ? await store.updateEvent(editing.value.id, payload)
    : await store.createEvent(payload)

  if (success) closeForm()
}

function confirmDelete(id: string) {
  Dialog.create({
    title: 'Delete Event?',
    message: 'This action cannot be undone.',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void store.deleteEvent(id)
  })
}

function formatDay(event: Event) {
  return qdate.formatDate(event.date.toDate(), 'ddd, MMM D YYYY')
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-md q-gutter-sm">
      <div class="text-h6">Manage Events</div>
      <q-space />
      <q-btn
        outline
        no-caps
        icon="upload_file"
        label="Import spreadsheet"
        @click="importOpen = true"
      />
      <q-btn color="primary" unelevated no-caps icon="add" label="New Event" @click="openNew" />
    </div>

    <!-- Filters, because a season is roughly seventy events and the flat list
         this replaced offered no way to find one. -->
    <div class="filters">
      <q-input
        v-model="search"
        outlined
        dense
        clearable
        debounce="150"
        placeholder="Search title, location, opponent"
        class="filters__search"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>

      <q-select
        v-model="typeFilter"
        :options="EVENT_TYPE_OPTIONS"
        outlined
        dense
        multiple
        use-chips
        label="Type"
        class="filters__select"
      />

      <q-select
        v-if="store.squads.length > 0"
        v-model="squadFilter"
        :options="store.squads"
        outlined
        dense
        multiple
        use-chips
        label="Squad"
        class="filters__select"
      />

      <q-btn-toggle
        v-model="range"
        toggle-color="primary"
        text-color="primary"
        color="white"
        no-caps
        dense
        unelevated
        class="filters__range"
        :options="[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' },
          { label: 'All', value: 'all' },
        ]"
      />
    </div>

    <div class="filters__summary">
      <span>
        Showing {{ visible.length }} of {{ store.events.length }} event{{ store.events.length === 1 ? '' : 's' }}
      </span>
      <q-btn
        v-if="filtersActive"
        flat
        dense
        no-caps
        size="sm"
        label="Show all"
        @click="clearFilters"
      />
    </div>

    <!-- Only appears once something is ticked, so it never takes up space
         during ordinary single-event editing. -->
    <div v-if="selectedIds.length > 0" class="bulk-bar">
      <span class="bulk-bar__count">{{ selectedIds.length }} selected</span>
      <span v-if="hiddenSelectedCount > 0" class="bulk-bar__hidden">
        including {{ hiddenSelectedCount }} hidden by the filter
      </span>
      <q-space />
      <q-btn dense flat no-caps icon="edit" label="Edit selected" @click="bulkEditOpen = true" />
      <q-btn
        dense
        flat
        no-caps
        color="negative"
        icon="delete"
        label="Delete selected"
        @click="confirmBulkDelete"
      />
      <q-btn dense flat no-caps label="Clear" @click="selectedIds = []" />
    </div>

    <q-card v-if="showForm" flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">
          {{ editing?.id ? 'Edit' : 'Create' }} Event
        </div>
        <EventForm
          :model-value="editing || undefined"
          @save="save"
          @cancel="closeForm"
        />
      </q-card-section>
    </q-card>

    <div v-if="store.loading" class="text-center q-pa-lg">
      <q-spinner color="primary" />
    </div>

    <div v-else-if="store.events.length === 0" class="empty-state">
      No events yet. Click "New Event" to get started.
    </div>

    <div v-else-if="visible.length === 0" class="empty-state">
      Nothing matches these filters.
      <q-btn flat dense no-caps size="sm" label="Show all" @click="clearFilters" />
    </div>

    <template v-else>
      <q-list bordered separator class="rounded-borders">
        <q-item dense class="select-all-row">
          <q-item-section side>
            <q-checkbox
              :model-value="allVisibleSelected"
              dense
              @update:model-value="toggleAllVisible"
            />
          </q-item-section>
          <q-item-section class="text-caption text-grey-6">
            Select all {{ visible.length }} shown
          </q-item-section>
        </q-item>

        <template v-for="month in months" :key="month.key">
          <q-item dense class="month-row">
            <q-item-section class="month-row__label">
              {{ month.label }}
              <span class="month-row__count">
                {{ month.events.length }} event{{ month.events.length === 1 ? '' : 's' }}
              </span>
            </q-item-section>
          </q-item>

          <q-item v-for="event in month.events" :key="event.id">
            <q-item-section side>
              <q-checkbox
                :model-value="selectedIds.includes(event.id)"
                dense
                :aria-label="`Select ${event.title}`"
                @update:model-value="(v: boolean) => toggleEvent(event.id, v)"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label class="row items-center q-gutter-xs">
                <span class="text-weight-medium">{{ event.title }}</span>
                <q-badge outline color="grey-7" :label="event.type" />
                <q-badge
                  v-for="squad in eventSquads(event.group, store.squads)"
                  :key="squad"
                  outline
                  color="primary"
                  :label="squad"
                />
              </q-item-label>
              <q-item-label caption>
                {{ formatDay(event) }}
                <template v-if="event.time"> · {{ event.time }}</template>
                · {{ event.location }}
                <template v-if="event.opponent"> · vs {{ event.opponent }}</template>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="q-gutter-xs">
                <q-btn dense flat icon="edit" aria-label="Edit event" @click="openEdit(event)" />
                <q-btn
                  dense
                  flat
                  icon="delete"
                  color="negative"
                  aria-label="Delete event"
                  @click="confirmDelete(event.id)"
                />
              </div>
            </q-item-section>
          </q-item>
        </template>
      </q-list>
    </template>

    <EventImportDialog v-model="importOpen" />
    <EventBulkEditDialog
      v-model="bulkEditOpen"
      :ids="selectedIds"
      @done="selectedIds = []"
    />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
}

.filters__search {
  flex: 2 1 220px;
  min-width: 0;
}

.filters__select {
  flex: 1 1 150px;
  min-width: 0;
}

.filters__range {
  border: 1px solid var(--grey-200);
  border-radius: 999px;
  overflow: hidden;
}

.filters__summary {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 8px 0 10px;
  font-size: 0.84rem;
  color: var(--grey-600);
}

.bulk-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  background: var(--grey-100, #f3f4f6);
  border: 1px solid var(--grey-200, #e5e7eb);
  border-radius: 8px;
  padding: 6px 10px;
  margin-bottom: 10px;
}

.bulk-bar__count {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--navy-800);
}

.bulk-bar__hidden {
  font-size: 0.8rem;
  color: var(--negative, #c10015);
}

.select-all-row {
  background: var(--grey-050, #fafafa);
}

.month-row {
  background: var(--grey-100, #f3f4f6);
}

.month-row__label {
  font-weight: 700;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--navy-800);
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.month-row__count {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--grey-500);
}
</style>
