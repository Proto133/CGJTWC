// Firebase (and most SDKs) throw untyped values. `catch (e: any)` silences the
// linter but loses all safety, so narrow explicitly instead.

/** Returns the `code` property of a thrown value, or '' when absent. */
export function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''
}

/** Returns a human-readable message for a thrown value, falling back to `fallback`. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String(error.message)
    if (message) return message
  }
  return fallback
}
