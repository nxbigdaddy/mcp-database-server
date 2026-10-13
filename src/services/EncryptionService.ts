import CryptoJS from 'crypto-js';
import { config } from '@/config';

class EncryptionService {
  private key: string;

  constructor() {
    this.key = config.encryptionKey || this.generateKey();
  }

  private generateKey(): string {
    console.warn('No encryption key provided, using auto-generated key (not recommended for production)');
    return CryptoJS.lib.WordArray.random(16).toString();
  }

  encrypt(text: string): string {
    if (!text) return text;
    return CryptoJS.AES.encrypt(text, this.key).toString();
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) return ciphertext;
    const bytes = CryptoJS.AES.decrypt(ciphertext, this.key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  hash(text: string): string {
    return CryptoJS.SHA256(text).toString();
  }
}

export const encryptionService = new EncryptionService();
