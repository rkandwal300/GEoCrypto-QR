"use client";

import CryptoJS from "crypto-js";

// WARNING: Storing secret keys in client-side code is not secure for production applications.
// This should be handled via a secure backend or environment variables not exposed to the client.
// For this demonstration, we use a hardcoded key as specified.
const SECRET_KEY =
  process.env.NEXT_PUBLIC_CRYPTO_SECRET_KEY || "my-secret-key";

export const encryptData = (data: object): string => {
  const str = JSON.stringify(data);
  return CryptoJS.AES.encrypt(str, SECRET_KEY).toString();
};

export const decryptData = (cipherText: string): object => {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error("Decryption resulted in an empty string. The key may be incorrect or data corrupted.");
    }
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error(
      "Failed to decrypt data. The QR code may be invalid, corrupted, or encrypted with a different key."
    );
  }
};
