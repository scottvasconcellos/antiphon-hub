export const errorCodes = {
  MANIFEST_INVALID: 'MANIFEST_INVALID',
  MANIFEST_SIGNATURE_INVALID: 'MANIFEST_SIGNATURE_INVALID',
  ARTIFACT_HASH_MISMATCH: 'ARTIFACT_HASH_MISMATCH',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  INSTALL_FAILED: 'INSTALL_FAILED',
  LICENSE_INVALID: 'LICENSE_INVALID',
  LICENSE_SIGNATURE_INVALID: 'LICENSE_SIGNATURE_INVALID',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

export class HubError extends Error {
  public readonly code: ErrorCode;

  public readonly details?: string;

  constructor(code: ErrorCode, message: string, details?: string) {
    super(message);
    this.name = 'HubError';
    this.code = code;
    this.details = details;
  }
}
