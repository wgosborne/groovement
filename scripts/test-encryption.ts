import { config } from 'dotenv';

config({ path: '.env.local' });

import crypto from 'crypto';

/**
 * Test script for encryption/decryption.
 * Run with: npx tsx scripts/test-encryption.ts
 *
 * If ENCRYPTION_KEY is not set, this script generates one and prints it.
 * Copy the printed key into your .env.local or Vercel environment variables.
 */

function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function main() {
  let encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    console.log('[!] ENCRYPTION_KEY not found in environment.');
    encryptionKey = generateEncryptionKey();
    console.log(`\n[*] Generated a new encryption key:\n\n  ${encryptionKey}\n`);
    console.log('[+] Copy this and add it to your .env.local or Vercel environment variables:\n');
    console.log(`  ENCRYPTION_KEY=${encryptionKey}\n`);
    process.env.ENCRYPTION_KEY = encryptionKey;
  } else {
    console.log('[OK] ENCRYPTION_KEY is set in environment.\n');
  }

  // Dynamically import the encryption functions after setting the env var
  const { encrypt, decrypt } = await import('../lib/encryption');

  const plaintext = 'Hello, this is a secret message!';
  console.log(`[->] Original plaintext: "${plaintext}"\n`);

  let ciphertext: string;
  try {
    ciphertext = encrypt(plaintext);
    console.log(`[==] Encrypted:        "${ciphertext}"\n`);
  } catch (e) {
    console.error('[XX] Encryption failed:', (e as Error).message);
    process.exit(1);
  }

  let decrypted: string;
  try {
    decrypted = decrypt(ciphertext);
    console.log(`[<-] Decrypted:        "${decrypted}"\n`);
  } catch (e) {
    console.error('[XX] Decryption failed:', (e as Error).message);
    process.exit(1);
  }

  if (decrypted === plaintext) {
    console.log('[OK] Success! Encrypted and decrypted text matches.\n');
  } else {
    console.error(
      `[XX] Mismatch! Expected "${plaintext}" but got "${decrypted}"\n`
    );
    process.exit(1);
  }

  // Test with another message
  const plaintext2 = 'Another secret with special chars: !@#$%^&*()';
  console.log(`\n[->] Testing with special characters: "${plaintext2}"\n`);

  try {
    const ciphertext2 = encrypt(plaintext2);
    const decrypted2 = decrypt(ciphertext2);

    if (decrypted2 === plaintext2) {
      console.log('[OK] Special characters test passed!\n');
    } else {
      console.error('[XX] Special characters test failed!\n');
      process.exit(1);
    }
  } catch (e) {
    console.error('[XX] Test failed:', (e as Error).message);
    process.exit(1);
  }

  console.log('[***] All tests passed!\n');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
