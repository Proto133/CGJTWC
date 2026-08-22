/**
 * Generates the short code a registrant puts in their Zelle or cheque memo.
 *
 * Zelle offers no way to programmatically confirm an incoming payment, so
 * reconciliation is manual: an admin reads a line on the bank statement and has
 * to find the matching registration. A short code in the memo turns that from
 * guesswork into a lookup.
 *
 * The alphabet deliberately omits I, L, O, U, 0 and 1 so a handwritten code on a
 * cheque cannot be misread, and the result is short enough to type by hand.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
const CODE_LENGTH = 5

export function generatePaymentReference(prefix = 'TWC'): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)

  let code = ''
  for (const byte of bytes) {
    // Modulo bias is irrelevant here: this is a lookup aid, not a secret.
    code += ALPHABET[byte % ALPHABET.length]
  }

  return `${prefix}-${code}`
}

/** Matches the format above; kept in sync with the rule in firestore.rules. */
export const PAYMENT_REFERENCE_PATTERN = /^[A-Z]{2,6}-[A-Z0-9]{4,8}$/
