import { HubApiClient } from '@antiphon/api';

export const apiClient = new HubApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174',
});
