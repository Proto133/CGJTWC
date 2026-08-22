/**
 * Client-side encryption for stored account passwords.
 *
 * Threat model, stated plainly so nobody mistakes this for more than it is.
 *
 * PROTECTS AGAINST: the database contents leaking. If the Firestore rules are
 * ever misconfigured — which has happened on this project before — an attacker
 * gets ciphertext rather than passwords. The passphrase is never written to
 * Firestore, never put in the bundle, and never persisted to storage; it exists
 * only as a derived key in memory for the length of a session.
 *
 * DOES NOT PROTECT AGAINST: a compromised admin browser or machine, since the
 * plaintext is by definition visible there once unlocked. It also cannot revoke
 * access from one person without changing the passphrase and re-encrypting,
 * and it keeps no record of who revealed what.
 *
 * There is no recovery. Losing the passphrase loses the data, which is a
 * property of doing this correctly rather than a missing feature.
 *
 * Construction: PBKDF2-HMAC-SHA256 to derive a 256-bit key, then AES-GCM.
 * GCM is authenticated, so tampering fails decryption instead of returning
 * garbage. Iterations follow the current OWASP guidance for PBKDF2-SHA256.
 */

/**
 * Measured at roughly 60ms for 600k on a modern CPU, which is imperceptible on
 * unlock but also cheap for an attacker, so this is set higher. At ~100ms per
 * guess a leaked vault is materially more expensive to grind through offline.
 */
const PBKDF2_ITERATIONS = 1_000_000
const SALT_BYTES = 16
/** AES-GCM standard nonce length. A fresh one is generated per encryption. */
const IV_BYTES = 12
/** Encrypted at vault creation so a wrong passphrase is detectable up front. */
const VERIFIER_PLAINTEXT = 'trojans-vault-v1'

export interface CipherBlob {
  /** base64 ciphertext (includes the GCM auth tag). */
  ct: string
  /** base64 nonce. */
  iv: string
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Backed by an explicit ArrayBuffer rather than the default ArrayBufferLike,
 * which may be a SharedArrayBuffer and is therefore not a valid BufferSource
 * for the WebCrypto calls below.
 */
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const out = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function generateSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)))
}

/**
 * Stretches the passphrase into an AES key. Deliberately slow: this is the only
 * thing standing between leaked ciphertext and an offline brute-force attack,
 * so passphrase strength and iteration count are what matter here.
 */
export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    // Non-extractable: the key cannot be read back out of memory by app code.
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<CipherBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return { ct: toBase64(ct), iv: toBase64(iv) }
}

/** Throws if the key is wrong or the data was tampered with (GCM auth failure). */
export async function decryptString(key: CryptoKey, blob: CipherBlob): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ct),
  )
  return new TextDecoder().decode(plain)
}

/** Creates the blob used to check a passphrase without decrypting every item. */
export function createVerifier(key: CryptoKey): Promise<CipherBlob> {
  return encryptString(key, VERIFIER_PLAINTEXT)
}

export async function verifyKey(key: CryptoKey, verifier: CipherBlob): Promise<boolean> {
  try {
    return (await decryptString(key, verifier)) === VERIFIER_PLAINTEXT
  } catch {
    // A wrong passphrase surfaces as a GCM authentication failure.
    return false
  }
}

/**
 * Strength gate, so the encryption is not undermined by "trojans123".
 *
 * Length is weighted far above character variety on purpose. Requiring symbols
 * is the classic rule that rejects a strong passphrase like
 * "copper-lantern-fjord-mustard" while happily accepting "Passw0rd!", which has
 * a fraction of the entropy and is far easier to guess. Anything genuinely long
 * is accepted as-is; only shorter ones need to earn it with variety.
 */
export function passphraseProblem(passphrase: string): string | null {
  if (passphrase.length >= 20) return null

  if (passphrase.length < 12) {
    return 'Use at least 12 characters, or a memorable phrase of 20 or more'
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]
    .filter((re) => re.test(passphrase)).length
  if (classes < 3) {
    return 'Short passphrases need a mix of cases, digits or symbols — ' +
      'or just use a longer phrase'
  }

  return null
}
