export const brandTokens = {
  color: {
    absoluteBlack: '#000000',
    carbon: '#1A1A1A',
    graphite: '#333333',
    steel: '#666666',
    mist: '#B3B3B3',
    pureWhite: '#FFFFFF',
    success: '#4F7A5A',
    warning: '#9A8250',
    error: '#8A4E4E',
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    headingTracking: '-0.015em',
  },
} as const;

export type BrandTokens = typeof brandTokens;
