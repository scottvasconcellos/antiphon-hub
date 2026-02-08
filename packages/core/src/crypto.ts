import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

const textEncoder = new TextEncoder();

const toUint8Array = (input: Uint8Array | string): Uint8Array =>
  typeof input === 'string' ? textEncoder.encode(input) : input;

const base64ToBytes = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const sha256Hex = async (input: Uint8Array | string): Promise<string> => {
  const digest = sha256(toUint8Array(input));
  return bytesToHex(digest);
};

export const verifySha256 = async (
  input: Uint8Array | string,
  expectedSha256Hex: string
): Promise<boolean> => {
  const digest = await sha256Hex(input);
  return digest.toLowerCase() === expectedSha256Hex.toLowerCase();
};

export const verifyEd25519Signature = async (
  payload: Uint8Array | string,
  signatureBase64: string,
  publicKeyBase64: string
): Promise<boolean> => {
  const payloadBytes = toUint8Array(payload);
  const signatureBytes = base64ToBytes(signatureBase64);
  const publicKeyBytes = base64ToBytes(publicKeyBase64);
  return ed25519.verify(signatureBytes, payloadBytes, publicKeyBytes);
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue(obj[key]);
        return acc;
      }, {});
  }
  return value;
};

export const canonicalJson = (value: unknown): string => JSON.stringify(stableValue(value));

export const verifyManifestSignature = async (
  manifestPayload: unknown,
  signatureBase64: string,
  publicKeyBase64: string
): Promise<boolean> => verifyEd25519Signature(canonicalJson(manifestPayload), signatureBase64, publicKeyBase64);
