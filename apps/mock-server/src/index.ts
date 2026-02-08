import { createPrivateKey, sign } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { activationRequestSchema, catalogSchema, releaseManifestSchema } from '@antiphon/core';

const app = express();
app.use(cors());
app.use(express.json());

const manifestsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data/manifests');
const releaseDir = path.join(manifestsDir, 'releases');
const artifactsDir = path.join(manifestsDir, 'artifacts');

const privateKeyPem = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIOOLQrvEkstwbLoN0JFHLkug0nCiGfdpA7PX51vfOQL+
-----END PRIVATE KEY-----`;

const publicKeyBase64 = fs.readFileSync(path.join(manifestsDir, 'public-key.txt'), 'utf8').trim();
const privateKey = createPrivateKey(privateKeyPem);

const loadCatalog = () => {
  const raw = fs.readFileSync(path.join(manifestsDir, 'catalog.json'), 'utf8');
  return catalogSchema.parse(JSON.parse(raw));
};

const loadRelease = (productId: string) => {
  const target = path.join(releaseDir, `${productId}.json`);
  if (!fs.existsSync(target)) {
    return null;
  }
  const raw = fs.readFileSync(target, 'utf8');
  return releaseManifestSchema.parse(JSON.parse(raw));
};

const signObject = (payload: Record<string, unknown>) =>
  sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64');

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/public-key', (_, res) => {
  res.json({ key: publicKeyBase64, algorithm: 'Ed25519' });
});

app.get('/catalog', (_, res) => {
  res.json(loadCatalog());
});

app.get('/releases/:productId', (req, res) => {
  const release = loadRelease(req.params.productId);
  if (!release) {
    res.status(404).json({ error: 'Release not found.' });
    return;
  }
  res.json(release);
});

app.post('/activate', (req, res) => {
  const parse = activationRequestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid activation request', issues: parse.error.issues });
    return;
  }

  const { productId, deviceFingerprint, serial } = parse.data;
  const tokenPayload = {
    productId,
    serialHint: `${serial.slice(0, 4)}-****`,
    deviceFingerprint,
    issuedAt: new Date().toISOString(),
    entitlements: ['launch', 'updates'],
  };

  const tokenSignature = signObject(tokenPayload);
  const token = Buffer.from(JSON.stringify({ payload: tokenPayload, signature: tokenSignature })).toString('base64');

  const licensePayload = {
    productId,
    entitlements: ['launch', 'updates'],
    issuedAt: tokenPayload.issuedAt,
  };

  res.json({
    token,
    licenseFile: {
      ...licensePayload,
      signature: signObject(licensePayload),
    },
  });
});

app.get('/account/products', (req, res) => {
  const hasToken = typeof req.header('Authorization') === 'string';
  if (!hasToken) {
    res.status(401).json({ error: 'Unauthorized: missing bearer token.' });
    return;
  }

  const catalog = loadCatalog();
  const entitlements = catalog.map((product) => ({
    productId: product.id,
    entitlement: 'owned',
    tier: 'perpetual',
  }));
  res.json(entitlements);
});

app.use('/artifacts', express.static(artifactsDir));

const port = Number(process.env.MOCK_API_PORT ?? 5174);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-server] running on http://localhost:${port}`);
});
