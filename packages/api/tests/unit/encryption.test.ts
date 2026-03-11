import { describe, it, expect } from 'vitest';
import { EncryptionService } from '../../src/services/encryption.js';

describe('EncryptionService', () => {
  const key = 'a'.repeat(64);
  const service = new EncryptionService(key);

  it('encrypts and decrypts phone number correctly', () => {
    const phone = '+79001234567';
    const encrypted = service.encrypt(phone);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(phone);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const phone = '+79001234567';
    const enc1 = service.encrypt(phone);
    const enc2 = service.encrypt(phone);
    expect(enc1.equals(enc2)).toBe(false);
  });

  it('handles Cyrillic text', () => {
    const text = 'Привет мир';
    const encrypted = service.encrypt(text);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it('handles empty string', () => {
    const encrypted = service.encrypt('');
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('fails with tampered ciphertext', () => {
    const encrypted = service.encrypt('test');
    encrypted[encrypted.length - 1] ^= 0xff;
    expect(() => service.decrypt(encrypted)).toThrow();
  });

  it('pads short keys to 64 hex chars', () => {
    const shortKeyService = new EncryptionService('abc');
    const phone = '+79001234567';
    const encrypted = shortKeyService.encrypt(phone);
    const decrypted = shortKeyService.decrypt(encrypted);
    expect(decrypted).toBe(phone);
  });
});
