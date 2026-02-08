import type { BootstrapStatus } from '@/services/bootstrap/types';
import type { HubSettings } from '@/state/hub-store';

export type SelfTestStatus = 'PASS' | 'FAIL' | 'SKIPPED';

export interface SelfTestCheck {
  id: string;
  phase: string;
  name: string;
  status: SelfTestStatus;
  details: string;
  remediationHint?: string;
}

export interface SelfTestRuntimeSummary {
  platformDetected: boolean;
  isTauri: boolean;
  mockMode: boolean;
  os: string;
  arch: string;
  version: string;
  buildMode: string;
}

export interface SelfTestReport {
  timestamp: string;
  runtime: SelfTestRuntimeSummary;
  checks: SelfTestCheck[];
  summary: {
    pass: number;
    fail: number;
    skipped: number;
  };
}

export interface DiagnosticsContext {
  bootstrapStatus: BootstrapStatus;
  runtimeMode?: 'tauri' | 'mock';
  platform?: { os: 'mac' | 'win' | 'linux'; arch: 'x64' | 'arm64' };
  appVersion: string;
  buildMode: string;
  settings: HubSettings;
  openLogsHandler: () => Promise<string>;
}

