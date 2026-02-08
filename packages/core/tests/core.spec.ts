import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  releaseManifestSchema,
  transitionDownloadState,
  verifyEd25519Signature,
  verifySha256,
} from '../src/index';

describe('core validation', () => {
  it('parses release manifest', () => {
    const parsed = releaseManifestSchema.parse({
      productId: 'antiphon-groove-01',
      version: '1.0.0',
      publishedAt: new Date().toISOString(),
      notes: 'Initial.',
      artifacts: [
        {
          os: 'mac',
          arch: 'arm64',
          installerType: 'zip',
          installStrategy: {
            kind: 'portableZip',
            executableRelativePath: 'Dummy Product.app',
            destination: 'apps-default',
          },
          url: 'https://example.com/app.zip',
          sha256: 'a'.repeat(64),
          sizeBytes: 123,
          signature: 'ZmFrZVNpZ25hdHVyZUJhc2U2NEVuY29kZWQ=',
        },
      ],
    });

    expect(parsed.productId).toBe('antiphon-groove-01');
  });

  it('verifies sha256 digest', async () => {
    const helloDigest = createHash('sha256').update('hello').digest('hex');
    expect(await verifySha256('hello', helloDigest)).toBe(true);
  });

  it('verifies ed25519 signatures', async () => {
    const privateKey = createPrivateKey({
      key: Buffer.from('302e020100300506032b6570042204201010101010101010101010101010101010101010101010101010101010101010', 'hex'),
      format: 'der',
      type: 'pkcs8',
    });
    const publicKey = createPublicKey(privateKey);

    const payload = Buffer.from('manifest-payload', 'utf8');
    const signature = sign(null, payload, privateKey);

    const publicDer = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
    const rawPublic = publicDer.subarray(publicDer.length - 32);

    const result = await verifyEd25519Signature(
      payload,
      signature.toString('base64'),
      rawPublic.toString('base64')
    );

    expect(result).toBe(true);
  });

  it('transitions through valid download states', () => {
    let current = transitionDownloadState('idle', 'QUEUE');
    current = transitionDownloadState(current, 'START');
    current = transitionDownloadState(current, 'DOWNLOADED');
    current = transitionDownloadState(current, 'VERIFY_OK');
    current = transitionDownloadState(current, 'INSTALL_OK');
    expect(current).toBe('complete');
  });
});
