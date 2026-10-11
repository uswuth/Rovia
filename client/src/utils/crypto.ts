export const decryptCredential = async (
  cipherPayload: string,
  secret: string = 'IntellMeet@RootSecret2026'
): Promise<string> => {
  if (!cipherPayload) return '';
  try {
    const parts = cipherPayload.split(':');
    if (parts.length !== 3) {
      return cipherPayload;
    }
    const [ivHex, tagHex, dataHex] = parts;

    const hexToBytes = (hex: string): Uint8Array => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      return bytes;
    };

    const iv = hexToBytes(ivHex);
    const tag = hexToBytes(tagHex);
    const data = hexToBytes(dataHex);

    const combined = new Uint8Array(data.length + tag.length);
    combined.set(data);
    combined.set(tag, data.length);

    const enc = new TextEncoder();
    const keyHash = await window.crypto.subtle.digest('SHA-256', enc.encode(secret));
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyHash,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      cryptoKey,
      combined as BufferSource
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('Failed to decrypt credential payload', err);
    return cipherPayload;
  }
};
