import CryptoJS from "crypto-js";

// A secure, randomly generated key is crucial.
// For a real application, this should be managed securely and not hardcoded.
// For example, load it from an environment variable.
const SECRET_KEY = process.env.NEXT_PUBLIC_CRYPTO_SECRET_KEY || "default-secret-key-for-dev-12345";

if (process.env.NODE_ENV === "development" && SECRET_KEY === "default-secret-key-for-dev-12345") {
  console.warn(
    "Warning: Using a default, insecure secret key for encryption. " +
    "For production, set NEXT_PUBLIC_CRYPTO_SECRET_KEY in your environment variables."
  );
}

/**
 * Encrypts a string using AES.
 * @param {string} text - The plaintext to encrypt.
 * @returns {string} The encrypted ciphertext.
 */
export const encrypt = (text: string): string => {
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

/**
 * Decrypts a string using AES.
 * @param {string} ciphertext - The ciphertext to decrypt.
 * @returns {string | null} The decrypted plaintext or null if decryption fails.
 */
export const decrypt = (ciphertext: string): string | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    // If the decrypted string is empty, it means the key was likely wrong.
    if (!originalText) {
      return null;
    }
    return originalText;
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
};
