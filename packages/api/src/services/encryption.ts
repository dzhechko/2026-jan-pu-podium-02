import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class EncryptionService {
  private key: Buffer;

  constructor(hexKey: string) {
    if (hexKey.length < 64) {
      throw new Error('ENCRYPTION_KEY must be at least 64 hex characters (32 bytes)');
    }
    this.key = Buffer.from(hexKey.slice(0, 64), 'hex');
  }

  encrypt(plaintext: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Format: IV (12) + AuthTag (16) + Ciphertext
    return Buffer.concat([iv, authTag, encrypted]);
  }

  decrypt(data: Buffer): string {
    const minLength = IV_LENGTH + AUTH_TAG_LENGTH;
    if (data.length < minLength) {
      throw new Error(`Encrypted data too short: expected at least ${minLength} bytes, got ${data.length}`);
    }

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }
}
