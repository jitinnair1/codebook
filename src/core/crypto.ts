// src/core/crypto.ts
// Web Crypto API AES-GCM (256-bit) encryption for sensitive credentials in local storage
const ENTROPY_KEY = '_cb_sec_entropy_v1';
const SALT_STRING = 'codebook-ai-keystore-v1';

async function getOrCreateCryptoKey(): Promise<CryptoKey | null> {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
        return null;
    }

    try {
        let rawEntropy = localStorage.getItem(ENTROPY_KEY);
        if (!rawEntropy) {
            const randomBytes = new Uint8Array(32);
            window.crypto.getRandomValues(randomBytes);
            rawEntropy = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem(ENTROPY_KEY, rawEntropy);
        }

        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(rawEntropy),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        const salt = encoder.encode(SALT_STRING);
        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    } catch (err) {
        console.warn('[crypto] Could not derive Web Crypto key:', err);
        return null;
    }
}

export async function encryptSecret(plaintext: string): Promise<string> {
    if (!plaintext) return '';
    try {
        const key = await getOrCreateCryptoKey();
        if (!key) return plaintext;

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(plaintext)
        );

        const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
        const ctHex = Array.from(new Uint8Array(ciphertextBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        return `enc:v1:${ivHex}:${ctHex}`;
    } catch (e) {
        console.warn('[crypto] Failed to encrypt secret, falling back:', e);
        return plaintext;
    }
}

export async function decryptSecret(encryptedPayload: string): Promise<string> {
    if (!encryptedPayload) return '';
    if (!encryptedPayload.startsWith('enc:v1:')) {
        // Plaintext fallback for legacy / unencrypted entries
        return encryptedPayload;
    }

    try {
        const parts = encryptedPayload.split(':');
        if (parts.length !== 4) return '';
        const ivHex = parts[2];
        const ctHex = parts[3];

        const ivMatches = ivHex.match(/.{1,2}/g);
        const ctMatches = ctHex.match(/.{1,2}/g);
        if (!ivMatches || !ctMatches) return '';

        const iv = new Uint8Array(ivMatches.map(byte => parseInt(byte, 16)));
        const ct = new Uint8Array(ctMatches.map(byte => parseInt(byte, 16)));

        const key = await getOrCreateCryptoKey();
        if (!key) return '';

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ct
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
    } catch (e) {
        console.warn('[crypto] Failed to decrypt secret:', e);
        return '';
    }
}
