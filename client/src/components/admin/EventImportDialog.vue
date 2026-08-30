<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Notify } from 'quasar'
import { useEventsStore } from 'stores/events'
import { assetUrl } from 'src/utils/assets'
import {
  EVENT_COLUMNS,
  parseEventsCsv,
  buildEventsTemplateCsv,
  buildEventsExportCsv,
  downloadCsv,
  type ParsedEventRow,
} from 'src/utils/eventsCsv'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', open: boolean): void }>()

const store = useEventsStore()

const file = ref<File | null>(null)
const rows = ref<ParsedEventRow[]>([])
const fatalError = ref<string | null>(null)
const skipDuplicates = ref(true)
const parsing = ref(false)

const columns = EVENT_COLUMNS

// Resolved through assetUrl so the link is correct both at the domain root and
// under a subpath such as the GitHub Pages preview.
const templateCsvUrl = computed(() => assetUrl('templates/Events_Template.csv'))
const templateXlsxUrl = computed(() => assetUrl('templates/Events_Template.xlsx'))

const validRows = computed(() => rows.value.filter((r) => r.payload !== null))
const errorRows = computed(() => rows.value.filter((r) => r.errors.length > 0))
const exampleRows = computed(() => rows.value.filter((r) => r.isExample))
const duplicateRows = computed(() =>
  validRows.value.filter((r) => r.duplicateOf !== null && !r.isExample))

/**
 * What will actually be written if Import is pressed now.
 *
 * Template examples are always excluded, with no override: nobody wants an
 * event called "Tournament A" in Colorado Springs on their schedule.
 */
const rowsToImport = computed(() =>
  validRows.value.filter(
    (r) => !r.isExample && !(skipDuplicates.value && r.duplicateOf),
  ))

function reset() {
  file.value = null
  rows.value = []
  fatalError.value = null
  parsing.value = false
}

function close() {
  emit('update:modelValue', false)
}

// Clear on close rather than on open, so reopening never briefly shows the
// previous file's preview.
watch(() => props.modelValue, (open) => {
  if (!open) reset()
})

async function onFile(picked: File | null) {
  rows.value = []
  fatalError.value = null
  if (!picked) return

  parsing.value = true
  try {
    // Decoded as UTF-8. An xlsx read this way keeps its "PK\x03\x04" prefix,
    // which is how parseEventsCsv recognises and rejects it.
    const text = await picked.text()
    const result = parseEventsCsv(text, store.events)
    rows.value = result.rows
    fatalError.value = result.fatalError
  } catch {
    fatalError.value = 'That file could not be read. Is it still open in Excel?'
  } finally {
    parsing.value = false
  }
}

async function runImport() {
  const payloads = rowsToImport.value.map((r) => r.payload!).filter(Boolean)
  if (payloads.length === 0) {
    Notify.create({ type: 'warning', message: 'Nothing to import' })
    return
  }

  const ok = await store.createMany(payloads)
  if (ok) close()
}

function downloadBlankTemplate() {
  // Generated from the same column definitions the parser uses, so it always
  // matches even if the file in public/templates is out of date.
  downloadCsv('events-template-blank.csv', buildEventsTemplateCsv())
}

function exportCurrent() {
  if (store.events.length === 0) {
    Notify.create({ type: 'warning', message: 'There are no events to export' })
    return
  }
  downloadCsv('events-export.csv', buildEventsExportCsv(store.events))
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="import-card">
      <q-card-section>
        <div class="dialog-title">Import events from a spreadsheet</div>
        <div class="dialog-sub">
          Nothing is saved until you press Import.
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-md">
        <!-- Step 1 -->
        <div>
          <div class="step-label">1. Start from the template</div>
          <div class="q-gutter-sm q-mt-xs">
            <q-btn
              :href="templateCsvUrl"
              download
              outline
              no-caps
              dense
              icon="download"
              label="Template (CSV)"
            />
            <q-btn
              :href="templateXlsxUrl"
              download
              outline
              no-caps
              dense
              icon="download"
              label="Template (Excel)"
            />
            <q-btn
              flat
              no-caps
              dense
              icon="note_add"
              label="Blank headers only"
              @click="downloadBlankTemplate"
            />
            <q-btn
              flat
              no-caps
              dense
              icon="file_upload"
              label="Export current events"
              @click="exportCurrent"
            />
          </div>
          <div class="step-note">
            The template's example rows are recognised and skipped, so you can
            leave them in place. If you use the Excel version, save it as CSV
            before uploading.
          </div>

          <q-expansion-item dense label="What each column expects" class="q-mt-sm">
            <div class="col-help">
              <div v-for="column in columns" :key="column.key" class="col-help__row">
                <span class="col-help__name">
                  {{ column.header }}<span v-if="column.required">*</span>
                </span>
                <span class="col-help__hint">{{ column.hint }}</span>
              </div>
              <div class="col-help__foot">
                * required. Column order does not matter.
              </div>
            </div>
          </q-expansion-item>
        </div>

        <!-- Step 2 -->
        <div>
          <div class="step-label">2. Upload the filled-in CSV</div>
          <q-file
            :model-value="file"
            outlined
            dense
            accept=".csv,text/csv"
            label="Choose a CSV file"
            class="q-mt-xs"
            @update:model-value="(f) => { file = f as File | null; void onFile(file) }"
          >
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>
        </div>

        <div v-if="parsing" class="text-center q-pa-md">
          <q-spinner color="primary" />
        </div>

        <q-banner v-if="fatalError" dense class="bg-red-1 text-negative">
          <template #avatar>
            <q-icon name="error" />
          </template>
          {{ fatalError }}
        </q-banner>

        <!-- Step 3 -->
        <div v-if="rows.length > 0">
          <div class="step-label">3. Check the preview</div>

          <div class="summary q-mt-xs">
            <q-chip dense square color="positive" text-color="white">
              {{ validRows.length }} ready
            </q-chip>
            <q-chip v-if="errorRows.length" dense square color="negative" text-color="white">
              {{ errorRows.length }} with problems
            </q-chip>
            <q-chip v-if="duplicateRows.length" dense square color="warning" text-color="dark">
              {{ duplicateRows.length }} already exist
            </q-chip>
            <q-chip v-if="exampleRows.length" dense square color="grey-5" text-color="white">
              {{ exampleRows.length }} template example{{ exampleRows.length === 1 ? '' : 's' }}
            </q-chip>
          </div>

          <q-checkbox
            v-if="duplicateRows.length"
            v-model="skipDuplicates"
            dense
            class="q-mt-sm"
            :label="`Skip the ${duplicateRows.length} that already exist`"
          />

          <div class="preview q-mt-sm">
            <div
              v-for="row in rows"
              :key="row.rowNumber"
              class="preview__row"
              :class="{
                'preview__row--bad': row.errors.length > 0,
                'preview__row--dupe':
                  row.errors.length === 0 && row.duplicateOf && !row.isExample,
                'preview__row--example': row.isExample,
              }"
            >
              <div class="preview__num">{{ row.rowNumber }}</div>
              <div class="preview__body">
                <div class="preview__title">
                  {{ row.raw.title || '(no title)' }}
                  <span class="preview__meta">
                    {{ row.raw.date }}
                    <template v-if="row.raw.time"> · {{ row.raw.time }}</template>
                    <template v-if="row.raw.type"> · {{ row.raw.type }}</template>
                    <template v-if="row.raw.location"> · {{ row.raw.location }}</template>
                  </span>
                </div>
                <div v-if="row.errors.length" class="preview__errors">
                  {{ row.errors.join(' · ') }}
                </div>
                <div v-else-if="row.isExample" class="preview__dupe">
                  Example row from the template — skipped
                </div>
                <div v-else-if="row.duplicateOf" class="preview__dupe">
                  An event called "{{ row.duplicateOf }}" already exists on this date
                </div>
              </div>
            </div>
          </div>

          <div v-if="errorRows.length" class="step-note">
            Rows with problems are skipped. Fix them in the spreadsheet and
            upload again, or import the rest now and add them by hand.
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" @click="close" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          :disable="rowsToImport.length === 0"
          :loading="store.bulkWorking"
          :label="rowsToImport.length > 0
            ? `Import ${rowsToImport.length} event${rowsToImport.length === 1 ? '' : 's'}`
            : 'Import'"
          @click="runImport"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.import-card {
  width: 720px;
  max-width: 94vw;
}

.dialog-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.15rem;
  text-transform: uppercase;
  color: var(--navy-800);
}

.dialog-sub {
  font-size: 0.86rem;
  color: var(--grey-600);
  margin-top: 2px;
}

.step-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--navy-800);
}

.step-note {
  margin-top: 8px;
  font-size: 0.84rem;
  color: var(--grey-600);
  line-height: 1.5;
}

.col-help {
  padding: 8px 4px;
  font-size: 0.85rem;
}

.col-help__row {
  display: flex;
  gap: 10px;
  padding: 2px 0;
}

.col-help__name {
  min-width: 190px;
  font-weight: 600;
  color: var(--navy-800);
}

.col-help__hint {
  color: var(--grey-600);
}

.col-help__foot {
  margin-top: 6px;
  color: var(--grey-500);
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Capped so a 60-row schedule does not push the buttons off screen. */
.preview {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--grey-200, #e5e7eb);
  border-radius: 8px;
}

.preview__row {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--grey-100, #f3f4f6);
}

.preview__row:last-child {
  border-bottom: none;
}

.preview__row--bad {
  background: rgba(193, 0, 21, 0.05);
}

.preview__row--dupe {
  background: rgba(242, 192, 55, 0.12);
}

/* Muted rather than coloured: an example row is neither a problem nor a
   decision, it is just not going to be imported. */
.preview__row--example {
  background: var(--grey-050, #fafafa);
  opacity: 0.72;
}

.preview__num {
  min-width: 26px;
  font-size: 0.78rem;
  color: var(--grey-400);
  padding-top: 2px;
}

.preview__body {
  min-width: 0;
}

.preview__title {
  font-weight: 600;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.preview__meta {
  font-weight: 400;
  font-size: 0.82rem;
  color: var(--grey-500);
}

.preview__errors {
  font-size: 0.82rem;
  color: var(--negative, #c10015);
  margin-top: 2px;
}

.preview__dupe {
  font-size: 0.82rem;
  color: var(--grey-600);
  margin-top: 2px;
}
</style>
