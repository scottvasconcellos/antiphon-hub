import { z } from 'zod';

const installStrategySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('portableZip'),
    executableRelativePath: z.string().min(1),
    destination: z.enum(['user-selected', 'apps-default']),
  }),
  z.object({
    kind: z.literal('macAppCopy'),
    bundleId: z.string().min(1),
    sourceType: z.enum(['dmg', 'zip']),
    destination: z.enum(['/Applications', '~/Applications']),
  }),
  z.object({
    kind: z.literal('macPkg'),
    packageId: z.string().optional(),
  }),
  z.object({
    kind: z.literal('windowsInstaller'),
    installerKind: z.enum(['exe', 'msi']),
    silentArgs: z.array(z.string()).optional(),
    uninstallCommandHint: z.string().optional(),
  }),
]);

export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string(),
  description: z.string(),
  category: z.enum(['composition', 'groove', 'mixing', 'utilities', 'mastering', 'effects']),
  iconPath: z.string().optional(),
  iconUrl: z.string().url().optional(),
  platforms: z.array(
    z.object({
      os: z.enum(['mac', 'win', 'linux']),
      arch: z.enum(['x64', 'arm64']),
      installerType: z.enum(['dmg', 'pkg', 'exe', 'msi', 'zip']),
      installStrategy: installStrategySchema,
    })
  ),
  currentVersion: z.string().min(1),
  releaseChannel: z.enum(['stable', 'beta']),
  purchase: z.object({
    type: z.enum(['serial', 'account']),
    supportsOffline: z.boolean(),
  }),
  licensePolicy: z.object({
    seats: z.number().int().positive(),
    offlineGraceDays: z.number().int().nonnegative(),
    requiresAccount: z.boolean(),
  }),
});

export const catalogSchema = z.array(productSchema);

export const releaseArtifactSchema = z.object({
  os: z.enum(['mac', 'win', 'linux']),
  arch: z.enum(['x64', 'arm64']),
  installerType: z.enum(['dmg', 'pkg', 'exe', 'msi', 'zip']),
  installStrategy: installStrategySchema,
  url: z.string().url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  sizeBytes: z.number().int().positive(),
  signature: z.string().min(20),
});

export const releaseManifestSchema = z.object({
  productId: z.string().min(1),
  version: z.string().min(1),
  publishedAt: z.string().datetime(),
  notes: z.string(),
  artifacts: z.array(releaseArtifactSchema).min(1),
  manifestSignature: z.string().optional(),
});

export const activationRequestSchema = z.object({
  serial: z.string().min(6),
  productId: z.string().min(1),
  deviceFingerprint: z.string().min(12),
});

export const licenseFileSchema = z.object({
  productId: z.string(),
  entitlements: z.array(z.string()),
  issuedAt: z.string().datetime(),
  expiry: z.string().datetime().optional(),
  signature: z.string().min(20),
});

export const activationResponseSchema = z.object({
  token: z.string().min(16),
  licenseFile: licenseFileSchema,
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductOutput = z.output<typeof productSchema>;
export type ReleaseManifestInput = z.input<typeof releaseManifestSchema>;
export type ReleaseManifestOutput = z.output<typeof releaseManifestSchema>;
