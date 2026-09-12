import crypto from 'crypto';

/**
 * ENCRYPTION_KEY must be a 32-byte key encoded as hex.
 * Generate one with: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
 * Then set it in your .env.local or Vercel env vars as ENCRYPTION_KEY=<the-hex-string>
 */

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.ENCRYPTION_KEY;

  if (!keyEnv) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
    );
  }

  let key: Buffer;
  try {
    // Assume the key is hex-encoded
    key = Buffer.from(keyEnv, 'hex');
  } catch (e) {
    throw new Error(
      'ENCRYPTION_KEY is not a valid hex string'
    );
  }

  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes (256 bits), but got ${key.length} bytes. ` +
      'Generate a new one with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
    );
  }

  return key;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a colon-separated string containing (base64-encoded):
 * iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a string produced by encrypt().
 * Expects format: iv:authTag:ciphertext (all base64-encoded)
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error(
      'Invalid ciphertext format. Expected "iv:authTag:ciphertext"'
    );
  }

  const [ivB64, authTagB64, encryptedB64] = parts;

  let iv: Buffer;
  let authTag: Buffer;
  let encrypted: Buffer;

  try {
    iv = Buffer.from(ivB64, 'base64');
    authTag = Buffer.from(authTagB64, 'base64');
    encrypted = Buffer.from(encryptedB64, 'base64');
  } catch (e) {
    throw new Error('Failed to decode ciphertext from base64');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (e) {
    throw new Error(
      'Decryption failed. This may indicate a corrupted ciphertext or wrong encryption key.'
    );
  }
}
