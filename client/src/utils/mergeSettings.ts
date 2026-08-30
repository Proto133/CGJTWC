/**
 * Merges a saved settings override over the file defaults.
 *
 * Lives here rather than in the settings store so it can be reasoned about and
 * tested on its own: the store imports Firebase, which needs browser
 * environment variables just to be loaded.
 *
 * A key only reaches the override document if its value differs from the file
 * default — see buildOverride() in SettingsForm — so a key being present here
 * means an admin deliberately set it.
 *
 * Blank strings are ignored, which is what makes clearing a text field fall
 * back to organization.ts rather than blanking the site.
 *
 * Empty arrays are NOT ignored. They used to be, which meant no list with a
 * non-empty default could ever be cleared from the dashboard: the empty array
 * was saved, then discarded here, and the default reappeared. Deleting the last
 * featured post looked like the save had silently failed. A list is edited as a
 * unit, and an empty one is the legitimate result of removing every row.
 */
export function mergeSection<T extends object>(defaults: T, override?: Partial<T>): T {
  if (!override) return defaults
  const result = { ...defaults }

  for (const key of Object.keys(override) as (keyof T)[]) {
    const value = override[key]
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    result[key] = value as T[keyof T]
  }

  return result
}
