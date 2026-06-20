/**
 * Secure AES-256-GCM local vault encryption utilizing native browser WebCrypto API.
 * This guarantees user credentials remain 100% encrypted in client storage
 * using their customized Master Password.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plain-text payload with a user password.
 * Returns a dot-separated string containing: Base64(salt) . Base64(iv) . Base64(ciphertext)
 */
export async function encryptData(data: string, password: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(data)
  );

  // Convert binary arrays to Base64 to safely store in localStorage
  const saltB64 = btoa(String.fromCharCode(...salt));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `${saltB64}.${ivB64}.${cipherB64}`;
}

/**
 * Decrypt a cipher-text payload using the configured user password.
 * Throws an error if the password is incorrect or the payload is compromised.
 */
export async function decryptData(encrypted: string, password: string): Promise<string> {
  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid cipher segment count");
  }

  const salt = Uint8Array.from(atob(parts[0]), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));

  const key = await deriveKey(password, salt);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return decoder.decode(decrypted);
}

/**
 * Fast verification key setup.
 * Stores a signature for master password check without keeping the raw secret.
 */
export async function generatePasswordVerifier(password: string): Promise<string> {
  // Encrypt a known string 'valid_signature' with the password.
  // If we can later decrypt it, the password was correct.
  return encryptData("VALID_SESSION_SIGNATURE", password);
}
