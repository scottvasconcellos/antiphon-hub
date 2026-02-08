export interface HubPaths {
  licenseDir: string;
  registryFile: string;
  logsDir: string;
  downloadsDir: string;
}

export const getExpectedLicensePath = (platform: string, productId: string): string => {
  if (platform === 'darwin') {
    return `~/Library/Application Support/Antiphon/licenses/${productId}.license`;
  }
  if (platform === 'win32') {
    return `%APPDATA%/Antiphon/licenses/${productId}.license`;
  }
  return `~/.config/Antiphon/licenses/${productId}.license`;
};
