import {
  activationRequestSchema,
  activationResponseSchema,
  catalogSchema,
  releaseManifestSchema,
  type ActivationRequest,
  type ActivationResponse,
  type Product,
  type ReleaseManifest,
} from '@antiphon/core';
import { z } from 'zod';

const entitlementsSchema = z.array(
  z.object({
    productId: z.string(),
    entitlement: z.string(),
    tier: z.enum(['perpetual', 'trial', 'subscription']).default('perpetual'),
  })
);

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export class HubApiClient {
  private readonly baseUrl: string;

  private readonly timeoutMs: number;

  private readonly fetcher: typeof fetch;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.fetcher = config.fetcher ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit, schema: z.ZodSchema<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status}) for ${path}`);
      }

      const payload = (await response.json()) as unknown;
      return schema.parse(payload);
    } finally {
      clearTimeout(timer);
    }
  }

  getCatalog(): Promise<Product[]> {
    return this.request('/catalog', { method: 'GET' }, catalogSchema);
  }

  getReleaseManifest(productId: string): Promise<ReleaseManifest> {
    return this.request(`/releases/${productId}`, { method: 'GET' }, releaseManifestSchema);
  }

  activate(request: ActivationRequest): Promise<ActivationResponse> {
    const payload = activationRequestSchema.parse(request);
    return this.request('/activate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, activationResponseSchema);
  }

  getAccountProducts(
    token?: string
  ): Promise<Array<{ productId: string; entitlement: string; tier?: 'perpetual' | 'trial' | 'subscription' }>> {
    return this.request(
      '/account/products',
      {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      entitlementsSchema
    );
  }
}
