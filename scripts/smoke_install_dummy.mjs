import { createHash, createPublicKey, verify } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestsRoot = path.join(repoRoot, 'data', 'manifests');
const releasePath = path.join(manifestsRoot, 'releases', 'antiphon-dummy-product.json');
const publicKeyBase64 = fs.readFileSync(path.join(manifestsRoot, 'public-key.txt'), 'utf8').trim();

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
};

const canonical = (value) => JSON.stringify(stable(value));

const rawPublic = Buffer.from(publicKeyBase64, 'base64');
const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
const publicKey = createPublicKey({
  key: Buffer.concat([spkiPrefix, rawPublic]),
  format: 'der',
  type: 'spki',
});

const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));

const unsignedManifest = {
  productId: release.productId,
  version: release.version,
  publishedAt: release.publishedAt,
  notes: release.notes,
  artifacts: release.artifacts,
};

const manifestValid = verify(
  null,
  Buffer.from(canonical(unsignedManifest)),
  publicKey,
  Buffer.from(release.manifestSignature, 'base64')
);

if (!manifestValid) {
  throw new Error('Manifest signature verification failed.');
}

for (const artifact of release.artifacts) {
  const filePath = path.join(manifestsRoot, 'artifacts', path.basename(artifact.url));
  const bytes = fs.readFileSync(filePath);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== artifact.sha256) {
    throw new Error(`SHA mismatch for ${artifact.url}`);
  }

  const unsignedArtifact = {
    os: artifact.os,
    arch: artifact.arch,
    installerType: artifact.installerType,
    installStrategy: artifact.installStrategy,
    url: artifact.url,
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
  };

  const signatureValid = verify(
    null,
    Buffer.from(canonical(unsignedArtifact)),
    publicKey,
    Buffer.from(artifact.signature, 'base64')
  );

  if (!signatureValid) {
    throw new Error(`Artifact signature invalid for ${artifact.url}`);
  }
}

const installRoot = path.join(repoRoot, 'tmp', 'smoke-install');
fs.rmSync(installRoot, { recursive: true, force: true });
fs.mkdirSync(installRoot, { recursive: true });

const macArtifact = release.artifacts.find((artifact) => artifact.os === 'mac') ?? release.artifacts[0];
const artifactZip = path.join(manifestsRoot, 'artifacts', path.basename(macArtifact.url));

if (os.platform() === 'darwin') {
  execFileSync('ditto', ['-x', '-k', artifactZip, installRoot], { stdio: 'inherit' });
} else if (os.platform() === 'win32') {
  execFileSync(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -Path "${artifactZip}" -DestinationPath "${installRoot}" -Force`],
    { stdio: 'inherit' }
  );
} else {
  execFileSync('unzip', ['-o', artifactZip, '-d', installRoot], { stdio: 'inherit' });
}

const expectedPath = path.join(installRoot, macArtifact.installStrategy.executableRelativePath);
if (!fs.existsSync(expectedPath)) {
  throw new Error(`Expected installed path missing: ${expectedPath}`);
}

console.log('Smoke install succeeded:');
console.log(`- Manifest + artifact signatures verified`);
console.log(`- SHA-256 checks passed`);
console.log(`- Extracted artifact into ${installRoot}`);
console.log(`- Verified executable path: ${expectedPath}`);
