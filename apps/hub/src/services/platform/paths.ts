export type PlatformKind = 'mac' | 'win' | 'linux';

export const detectPlatform = (): PlatformKind => {
  const platform = globalThis.navigator?.platform?.toLowerCase() ?? '';
  if (platform.includes('mac')) {
    return 'mac';
  }
  if (platform.includes('win')) {
    return 'win';
  }
  return 'linux';
};

export const getLogDir = (): string => {
  const platform = detectPlatform();
  if (platform === 'mac') {
    return '~/Library/Application Support/com.Antiphon.Hub/logs';
  }
  if (platform === 'win') {
    return '%APPDATA%\\com.Antiphon.Hub\\logs';
  }
  return '~/.local/share/com.Antiphon.Hub/logs';
};

export const getDefaultDownloadDir = (): string => {
  const platform = detectPlatform();
  if (platform === 'mac') {
    return '~/Library/Application Support/com.Antiphon.Hub/apps';
  }
  if (platform === 'win') {
    return '%LOCALAPPDATA%\\com.Antiphon.Hub\\apps';
  }
  return '~/.local/share/com.Antiphon.Hub/apps';
};
