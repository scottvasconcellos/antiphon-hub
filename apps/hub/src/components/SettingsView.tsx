import { Button, Card, Input } from '@antiphon/ui';
import type { HubSettings } from '@/state/hub-store';

interface SettingsViewProps {
  settings: HubSettings;
  isMockMode: boolean;
  resolvedDownloadPath: string;
  onSave: (settings: HubSettings) => void;
  onBrowseDownloadLocation: () => void;
  onCopyDownloadPath: () => void;
  onVerifyInstalled: () => void;
  onOpenLogs: () => void;
  onExportSupportBundle: () => void;
}

export const SettingsView = ({
  settings,
  isMockMode,
  resolvedDownloadPath,
  onSave,
  onBrowseDownloadLocation,
  onCopyDownloadPath,
  onVerifyInstalled,
  onOpenLogs,
  onExportSupportBundle,
}: SettingsViewProps) => {
  const next = { ...settings };
  const displayedPath = settings.downloadLocation ?? resolvedDownloadPath;
  return (
    <Card className="hub-settings" elevated>
      <h2>Settings</h2>

      <Input
        label="Download location"
        value={settings.downloadLocation ?? ''}
        placeholder="Default Antiphon folder"
        hint="Leave empty to use the default Antiphon folder."
        onChange={(event) => {
          next.downloadLocation = event.target.value;
          onSave(next);
        }}
      />

      <div className="hub-settings-path" aria-label="Resolved download path">
        <span className="hub-settings-path__label">Resolved path:</span>
        <code>{displayedPath}</code>
        <Button variant="ghost" onClick={onCopyDownloadPath}>
          Copy
        </Button>
      </div>

      <div className="hub-settings__actions">
        <Button variant="secondary" onClick={onBrowseDownloadLocation}>
          Browse…
        </Button>
      </div>

      <label className="hub-settings__checkbox">
        <input
          type="checkbox"
          checked={settings.autoUpdateChecks}
          onChange={(event) => onSave({ ...settings, autoUpdateChecks: event.target.checked })}
        />
        Auto-update checks
      </label>

      <label className="hub-settings__checkbox">
        <input
          type="checkbox"
          checked={settings.uiSoundsEnabled}
          onChange={(event) => onSave({ ...settings, uiSoundsEnabled: event.target.checked })}
        />
        UI sounds
      </label>

      <div className="hub-settings__actions">
        <Button
          variant="secondary"
          onClick={onVerifyInstalled}
          aria-label="Verify installed apps"
          title={isMockMode ? 'Mock action only. No system changes.' : undefined}
        >
          Verify installed apps
        </Button>
        <Button variant="secondary" onClick={onOpenLogs}>
          Open logs
        </Button>
        <Button variant="secondary" onClick={onExportSupportBundle}>
          Export support bundle
        </Button>
      </div>

      {isMockMode ? (
        <small className="hub-settings-note">Mock mode: integrity checks and system actions are disabled.</small>
      ) : null}
    </Card>
  );
};
